import * as core from '@actions/core'
import * as github from '@actions/github'

const urlParse =
	/\/(?<ownerType>orgs|users)\/(?<ownerName>[^/]+)\/projects\/(?<projectNumber>\d+)/

interface ProjectNodeIDResponse {
	organization?: {
		projectV2: {
			id: string
		}
	}
	user?: {
		projectV2: {
			id: string
		}
	}
}

interface ProjectAddItemResponse {
	addProjectV2ItemById: {
		item: {
			id: string
		}
	}
}

interface ProjectV2AddDraftIssueResponse {
	addProjectV2DraftIssue: {
		projectItem: {
			id: string
		}
	}
}

interface ProjectItemsResponse {
	node: {
		items: {
			nodes: Array<{
				content?: {
					id?: string
				}
			}>
			pageInfo: {
				hasNextPage: boolean
				endCursor: string | null
			}
		}
	}
}

interface SearchItem {
	node_id: string
	number: number
	html_url: string
	title: string
	labels: { name: string }[]
	repository_url: string
	created_at: Date
}

interface SummaryMetrics {
	added: { title: string; url: string; repo: string; created: Date }[]
	skipped: { title: string; url: string; repo: string }[]
	failed: { title: string; url: string; repo: string; reason: string }[]
}

export async function addToProject(): Promise<void> {
	const projectUrl = core.getInput('project-url', { required: true })
	const ghToken = core.getInput('github-token', { required: true })
	const labeled =
		core
			.getInput('labeled')
			.split(',')
			.map((l) => l.trim().toLowerCase())
			.filter((l) => l.length > 0) ?? []
	const labelOperator = core
		.getInput('label-operator')
		.trim()
		.toLocaleLowerCase()
	const inputRepo = core.getInput('repo').trim()

	// NEW: Read the dry-run boolean input parameter (defaults to false if not passed or invalid)
	const dryRun = core.getInput('dry-run') === 'true'

	const octokit = github.getOctokit(ghToken)

	core.debug(`Project URL: ${projectUrl}`)

	const urlMatch = projectUrl.match(urlParse)

	if (!urlMatch) {
		throw new Error(
			`Invalid project URL: ${projectUrl}. Project URL should match the format <GitHub server domain name>/<orgs-or-users>/<ownerName>/projects/<projectNumber>`
		)
	}
	const projectOwnerName = urlMatch.groups?.ownerName
	const projectNumber = parseInt(urlMatch.groups?.projectNumber ?? '', 10)
	const ownerType = urlMatch.groups?.ownerType
	const ownerTypeQuery = mustGetOwnerTypeQuery(ownerType)

	const contextOwner = inputRepo
		? inputRepo.split('/')[0]
		: github.context.repo.owner

	core.debug(`Project owner: ${projectOwnerName}`)
	core.debug(`Project number: ${projectNumber}`)
	core.debug(`Project owner type: ${ownerType}`)

	const searchQueryPrefix = [`is:open`, `archived:false`]

	if (inputRepo.length > 0) {
		core.info(`Searching for open items in the repository: ${inputRepo}`)
		searchQueryPrefix.push(`repo:${inputRepo}`)
	} else {
		core.info(`Searching for open items owned by: ${contextOwner}`)
		searchQueryPrefix.push(
			ownerType === 'orgs' ? `org:${contextOwner}` : `user:${contextOwner}`
		)
	}

	let searchQuery = `${searchQueryPrefix.join(' ')}`

	if (labeled.length > 0) {
		if (labelOperator === 'and') {
			searchQuery += ` ${labeled.map((l) => `label:"${l}"`).join(' ')}`
		} else if (labelOperator === 'not') {
			searchQuery += ` ${labeled.map((l) => `-label:"${l}"`).join(' ')}`
		} else {
			searchQuery += ` label:${labeled.map((l) => `"${l}"`).join(',')}`
		}
	}

	core.info(`Executing global search query: "${searchQuery}"`)
	const discoveredItems = (await octokit.paginate(
		octokit.rest.search.issuesAndPullRequests,
		{
			q: searchQuery,
			per_page: 100,
		}
	)) as unknown as SearchItem[]

	core.info(
		`Found ${discoveredItems.length} matching items across the environment.`
	)

	const metrics: SummaryMetrics = { added: [], skipped: [], failed: [] }

	if (discoveredItems.length === 0) {
		await writeJobSummary(metrics, searchQuery, projectUrl, dryRun)
		return
	}

	const idResp = await octokit.graphql<ProjectNodeIDResponse>(
		`query getProject($projectOwnerName: String!, $projectNumber: Int!) {
      ${ownerTypeQuery}(login: $projectOwnerName) {
        projectV2(number: $projectNumber) {
          id
        }
      }
    }`,
		{
			projectOwnerName,
			projectNumber,
		}
	)
	const projectId = idResp[ownerTypeQuery]?.projectV2.id
	const processedItemIds: string[] = []

	core.debug(`Project node ID: ${projectId}`)

	// Pre-fetch existing project items to detect duplicates before attempting mutations
	const existingContentIds = new Set<string>()
	{
		let cursor: string | null = null
		do {
			const itemsResp: ProjectItemsResponse =
				await octokit.graphql<ProjectItemsResponse>(
					`query getProjectItems($projectId: ID!, $cursor: String) {
              node(id: $projectId) {
                ... on ProjectV2 {
                  items(first: 100, after: $cursor) {
                    nodes { content { ... on Issue { id } ... on PullRequest { id } } }
                    pageInfo { hasNextPage endCursor }
                  }
                }
              }
            }`,
					{ projectId, cursor }
				)
			for (const node of itemsResp.node.items.nodes) {
				if (node.content?.id) existingContentIds.add(node.content.id)
			}
			const hasNextPage: boolean = itemsResp.node.items.pageInfo.hasNextPage
			const endCursor: string | null = itemsResp.node.items.pageInfo.endCursor
			cursor = hasNextPage ? endCursor : null
		} while (cursor !== null)
	}

	for (const issue of discoveredItems) {
		// core.debug(`Processing item: ${JSON.stringify(issue, null, 2)}`)
		const issueLabels: string[] = (issue?.labels ?? []).map(
			(l: { name: string }) => l.name.toLowerCase()
		)
		const repoParts = (issue.repository_url.split('/repos/')[1] ?? '').split(
			'/'
		)
		const issueOwnerName = repoParts[0]
		const repoName = repoParts[1] || 'unknown-repo'
		const itemData = {
			title: issue.title,
			url: issue.html_url,
			repo: repoName,
			created: new Date(issue.created_at ?? ''),
		}

		core.debug(`Issue/PR owner: ${issueOwnerName}`)
		core.debug(`Issue/PR labels: ${issueLabels.join(', ')}`)

		if (labelOperator === 'and') {
			if (!labeled.every((l) => issueLabels.includes(l))) {
				metrics.skipped.push({
					...itemData,
					title: `${itemData.title} (Failed Local Label Validation)`,
				})
				continue
			}
		} else if (labelOperator === 'not') {
			if (labeled.length > 0 && issueLabels.some((l) => labeled.includes(l))) {
				metrics.skipped.push({
					...itemData,
					title: `${itemData.title} (Failed Local Label Validation)`,
				})
				continue
			}
		} else {
			if (labeled.length > 0 && !issueLabels.some((l) => labeled.includes(l))) {
				metrics.skipped.push({
					...itemData,
					title: `${itemData.title} (Failed Local Label Validation)`,
				})
				continue
			}
		}

		const contentId = issue?.node_id

		core.debug(`Content ID: ${contentId}`)

		if (contentId && existingContentIds.has(contentId)) {
			core.info(
				dryRun
					? `[Dry Run] Item already in project (would skip): ${issue.html_url}`
					: `Item already in project (skipping): ${issue.html_url}`
			)
			metrics.skipped.push(itemData)
			continue
		} else {
			if (dryRun) {
				core.info(`[Dry Run] Would process item: ${issue.html_url}`)
				metrics.added.push(itemData)
				continue
			}
			core.info(`Processing item: ${issue.html_url}`)
		}

		// Next, use the GraphQL API to add the issue to the project.
		// If the issue has the same owner as the project, we can directly
		// add a project item. Otherwise, we add a draft issue.
		if (issueOwnerName === projectOwnerName) {
			core.info('Creating project item')

			try {
				const addResp = await octokit.graphql<ProjectAddItemResponse>(
					`mutation addIssueToProject($input: AddProjectV2ItemByIdInput!) {
            addProjectV2ItemById(input: $input) {
              item {
                id
              }
            }
          }`,
					{ input: { projectId, contentId } }
				)
				processedItemIds.push(addResp.addProjectV2ItemById.item.id)
				metrics.added.push(itemData)
			} catch (error) {
				if (isAlreadyInProjectError(error)) {
					core.warning(`Item already in project (skipping): ${issue.html_url}`)
					metrics.skipped.push(itemData)
					continue
				}
				core.error(
					`Failed to add item: ${error instanceof Error ? error.message : String(error)}`
				)
				metrics.failed.push({
					...itemData,
					reason: error instanceof Error ? error.message : String(error),
				})
			}
		} else {
			core.info('Creating draft issue in project')

			try {
				const addResp = await octokit.graphql<ProjectV2AddDraftIssueResponse>(
					`mutation addDraftIssueToProject($projectId: ID!, $title: String!) {
            addProjectV2DraftIssue(input: { projectId: $projectId, title: $title }) {
              projectItem {
                id
              }
            }
          }`,
					{ projectId, title: issue?.html_url }
				)
				processedItemIds.push(addResp.addProjectV2DraftIssue.projectItem.id)
				metrics.added.push(itemData)
			} catch (error) {
				if (isAlreadyInProjectError(error)) {
					core.warning(`Item already in project (skipping): ${issue.html_url}`)
					metrics.skipped.push(itemData)
					continue
				}
				core.error(
					`Failed to add item: ${error instanceof Error ? error.message : String(error)}`
				)
				metrics.failed.push({
					...itemData,
					reason: error instanceof Error ? error.message : String(error),
				})
			}
		}
	}

	core.info(`items: ${processedItemIds.join(',')}`)
	core.setOutput('items', processedItemIds.join(','))

	await writeJobSummary(metrics, searchQuery, projectUrl, dryRun)
}

async function writeJobSummary(
	metrics: SummaryMetrics,
	query: string,
	projectUrl: string,
	dryRun: boolean
): Promise<void> {
	// NEW: Append a clear visual indicator if the run was a simulated Dry Run
	const headingText = dryRun
		? '🔍 Organization Project Automation Summary (DRY RUN)'
		: '📋 Organization Project Automation Summary'

	const addedLabel = dryRun
		? '🔮 Items That Would Be Added'
		: '✅ Items Newly Added'

	core.summary
		.addHeading(headingText)
		.addRaw(
			`<p>Target Project Board: <a href="${projectUrl}">${projectUrl}</a></p>`
		)
		.addRaw(`<p>Search filter query executed: <code>${query}</code></p>`)

	if (dryRun) {
		core.summary.addRaw(
			'<blockquote style="border-left: .25em solid #dfb317; padding: 0 1em; color: #6a737d;">⚠️ <strong>Notice:</strong> This workflow was executed in dry-run mode. No mutations or project board alterations were made.</blockquote>'
		)
	}

	core.summary.addHeading('Execution Performance Metrics', 3).addTable([
		[
			{ data: 'Status Metric Type', header: true },
			{ data: 'Total Quantity Count', header: true },
		],
		[addedLabel, metrics.added.length.toString()],
		['🟡 Items Skipped / Already Exist', metrics.skipped.length.toString()],
		['❌ Ingestion Failure Operations', metrics.failed.length.toString()],
	])

	if (metrics.added.length > 0) {
		const sectionTitle = dryRun
			? '🔮 Prospective Additions'
			: '🚀 Newly Added Items'
		core.summary.addHeading(sectionTitle, 4)
		const addedRows = metrics.added.map((item) => [
			// remote '/pull/<number>' from the URL to get the repo name
			`<a href="${item.url.replace(/\/pull\/\d+$/, '')}">${item.repo}</a>`,
			`<a href="${item.url}">${item.title}</a>`,
			`${[item.created.toLocaleDateString('en-US'), item.created.toLocaleTimeString('en-US')].join(' ').replaceAll(' ', '&nbsp;')}`,
		])
		core.summary.addTable([
			[
				{ data: 'Repository', header: true },
				{ data: 'Issue / Pull Request Title', header: true },
				{ data: 'Created At', header: true },
			],
			...addedRows,
		])
	}

	if (metrics.failed.length > 0) {
		core.summary.addHeading('⚠️ Ingestion Failure Details', 4)
		const failedRows = metrics.failed.map((item) => [
			item.repo,
			`<a href="${item.url}">${item.title}</a>`,
			`<code>${item.reason}</code>`,
		])
		core.summary.addTable([
			[
				{ data: 'Repository', header: true },
				{ data: 'Item Name', header: true },
				{ data: 'Failure Reason Error Log', header: true },
			],
			...failedRows,
		])
	}

	await core.summary.write()
}

// returns true only for expected "already in project" API errors — does not log
function isAlreadyInProjectError(error: unknown): boolean {
	if (error instanceof Error) {
		const msg = error.message.toLowerCase()
		return (
			msg.includes('content already exists in this project') ||
			msg.includes('project already contains the provided content')
		)
	}
	return false
}

export function mustGetOwnerTypeQuery(
	ownerType?: string
): 'organization' | 'user' {
	const ownerTypeQuery =
		ownerType === 'orgs'
			? 'organization'
			: ownerType === 'users'
				? 'user'
				: null
	if (!ownerTypeQuery) {
		throw new Error(
			`Unsupported ownerType: ${ownerType}. Must be one of 'orgs' or 'users'`
		)
	}
	return ownerTypeQuery
}
