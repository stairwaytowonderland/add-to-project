import * as core from '@actions/core'
import * as github from '@actions/github'
import {
	ProjectAddItemResponse,
	ProjectNodeIDResponse,
	ProjectItemsResponse,
	ProjectV2AddDraftIssueResponse,
	ActionInfo,
	ProjectInfo,
	ItemInfo,
	SearchItem,
	SearchResult,
	ItemTracking,
	OctokitClient,
	RepositoryInfo,
	ProjectRepository,
	SummaryMetrics,
	MetricsTracking,
	OwnerType,
	OwnerTypeQuery,
	LabelOperator,
	PayloadIssue,
	PayloadPullRequest,
} from './types.js'

// Regular expression to parse the GitHub project URL and extract the owner type, owner name, and project number.
const urlParse = /\/(?<ownerType>orgs|users)\/(?<ownerName>[^/]+)\/projects\/(?<projectNumber>\d+)/

// Main function to add issues or pull requests to a GitHub project based on the provided inputs.
export async function addToProject(): Promise<void> {
	const projectUrl = core.getInput('project-url', { required: true })
	core.debug(`Project URL: ${projectUrl}`)

	const urlMatch = projectUrl.match(urlParse)

	if (!urlMatch) {
		throw new Error(
			`Invalid project URL: ${projectUrl}. Project URL should match the format <GitHub server domain name>/<orgs-or-users>/<ownerName>/projects/<projectNumber>`
		)
	}

	// Inputs
	const ghToken = core.getInput('github-token', { required: true })
	const labeled = core
		.getInput('labeled')
		.split(',')
		.map((l) => l.trim().toLowerCase())
		.filter((l) => l.length > 0)
	const labelOperator = core.getInput('label-operator').trim().toLocaleLowerCase() as LabelOperator
	const inputRepo = core.getInput('repo').trim()
	const dryRun = core.getInput('dry-run') === 'true'

	// Octokit instance for GitHub API requests
	const octokit = github.getOctokit(ghToken)

	// Summary metrics for tracking added, skipped, and failed items
	const metrics = new SummaryMetrics()

	// Extract project owner name, project number, and owner type from the URL match
	const projectOwnerName = urlMatch.groups!.ownerName

	const projectNumber = parseInt(urlMatch.groups!.projectNumber)
	const ownerType = urlMatch.groups!.ownerType as OwnerType
	const ownerTypeQuery = mustGetOwnerTypeQuery(ownerType)

	core.debug(`Project owner: ${projectOwnerName}`)
	core.debug(`Project number: ${projectNumber}`)
	core.debug(`Project owner type: ${ownerType}`)

	const isOwnerOnly: boolean = inputRepo === github.context.repo.owner
	const isInputRepo: boolean = inputRepo.length > 0 && !isOwnerOnly
	const discoveredItems: SearchItem[] = []

	// Use the GraphQL API to request the project's node ID
	const projectId = await getProjectNodeID(octokit, ownerTypeQuery, projectOwnerName, projectNumber)

	core.debug(`Project node ID: ${projectId}`)

	const project: ProjectInfo = {
		url: projectUrl,
		number: projectNumber,
		ownerName: projectOwnerName,
		ownerType,
		ownerTypeQuery,
		id: projectId,
	}

	const action: ActionInfo = {
		dryRun,
		labeled,
		labelOperator,
		project,
	}

	let searchQuery

	// If an input repository is specified, discover items within that repository first.
	if (isInputRepo || isOwnerOnly) {
		let repo: ProjectRepository
		if (isInputRepo) {
			repo = new RepositoryInfo(inputRepo) as ProjectRepository
		} else {
			repo = new RepositoryInfo({ owner: inputRepo }) as ProjectRepository
		}
		const searchResults: SearchResult = await discoverItems(octokit, action, repo)
		searchQuery = searchResults.query
		discoveredItems.push(...searchResults.items)

		if (discoveredItems.length === 0) {
			await writeJobSummary(metrics, action, searchQuery)
			return
		}
	}

	// Pre-fetch existing project items to detect duplicates before attempting mutations
	const itemIDs: ItemTracking = {
		existingContentIds: await getExistingContentIds(octokit, projectId),
		processedItemIds: [],
	}

	if (discoveredItems.length > 0) {
		for (const issue of discoveredItems) {
			const repo = new RepositoryInfo().fromApiUrl(issue.repository_url ?? '') as ProjectRepository

			await handleIssueOrPR(octokit, action, repo, itemIDs, metrics, issue).catch((error) => {
				core.error(`Error processing item ${issue.html_url}: ${error instanceof Error ? error.message : String(error)}`)
				metrics.fail({
					title: issue.title,
					url: issue.html_url,
					repo: repo.fullName,
					reason: error instanceof Error ? error.message : String(error),
				})
			})
		}

		core.info(`items: ${itemIDs.processedItemIds.join(',')}`)
		core.setOutput('items', itemIDs.processedItemIds.join(','))

		await writeJobSummary(metrics, action, searchQuery)
	} else {
		const issue = github.context.payload.issue ?? github.context.payload.pull_request

		if (!issue) {
			core.warning('No issue or pull request found in the GitHub Actions context payload. Skipping processing.')
			return
		}

		const issueOwnerName = github.context.payload.repository?.owner.login
		const repoName = github.context.payload.repository?.name

		const repo = new RepositoryInfo(repoName, issueOwnerName) as ProjectRepository

		await handleIssueOrPR(octokit, action, repo, itemIDs, metrics, issue).catch((error) => {
			core.error(`Error processing item ${issue?.html_url}: ${error instanceof Error ? error.message : String(error)}`)
			metrics.fail({
				title: issue?.title,
				url: issue?.html_url,
				repo: repoName,
				reason: error instanceof Error ? error.message : String(error),
			})
		})

		core.info(`items: ${itemIDs.processedItemIds.join(',')}`)
		core.setOutput('items', itemIDs.processedItemIds.join(','))

		await writeJobSummary(metrics, action, searchQuery)
	}
}

// Writes a summary of the job execution, including added, skipped, and failed items, to the GitHub Actions job summary.
async function writeJobSummary(metrics: MetricsTracking, action: ActionInfo, query?: string): Promise<void> {
	const { project, dryRun } = action
	const projectUrl = project.url

	const headingText = dryRun
		? '🔍 Organization Project Automation Summary (DRY RUN)'
		: '📋 Organization Project Automation Summary'

	const addedLabel = dryRun ? '🔮 Items That Would Be Added' : '✅ Items Newly Added'

	core.summary.addHeading(headingText).addRaw(`<p>Target Project Board: <a href="${projectUrl}">${projectUrl}</a></p>`)

	if (query) {
		core.summary.addRaw(`<p>Search filter query executed: <code>${query}</code></p>`)
	}

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
		[addedLabel, metrics.data.added.length.toString()],
		['🟡 Items Skipped / Already Exist', metrics.data.skipped.length.toString()],
		['❌ Ingestion Failure Operations', metrics.data.failed.length.toString()],
	])

	if (metrics.data.added.length > 0) {
		const sectionTitle = dryRun ? '🔮 Prospective Additions' : '🚀 Newly Added Items'
		core.summary.addHeading(sectionTitle, 4)
		const addedRows = metrics.data.added.map((item) => [
			// remote '/pull/<number>' from the URL to get the repo name
			`<a href="${item.url?.replace(/\/pull\/\d+$/, '')}">${item.repo}</a>`,
			`<a href="${item.url}">${item.title}</a>`,
			`${[item.created?.toLocaleDateString('en-US'), item.created?.toLocaleTimeString('en-US')].join(' ').replaceAll(' ', '&nbsp;')}`,
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

	if (metrics.data.failed.length > 0) {
		core.summary.addHeading('⚠️ Ingestion Failure Details', 4)
		const failedRows = metrics.data.failed.map((item) => [
			item.repo ?? '',
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

// Returns the GraphQL owner type query string for the given owner type ('orgs' or 'users').
// Throws an error for unsupported owner types.
export function mustGetOwnerTypeQuery(ownerType?: string): OwnerTypeQuery {
	const ownerTypeQuery = ownerType === 'orgs' ? 'organization' : ownerType === 'users' ? 'user' : null
	if (!ownerTypeQuery) {
		throw new Error(`Unsupported ownerType: ${ownerType}. Must be one of 'orgs' or 'users'`)
	}
	return ownerTypeQuery
}

// Retrieves the node ID of a GitHub project given the owner type, project owner name, and project number.
// Returns undefined if the project is not found.
export async function getProjectNodeID(
	octokit: OctokitClient,
	ownerTypeQuery: OwnerTypeQuery,
	projectOwnerName?: string,
	projectNumber?: number
): Promise<string | undefined> {
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

	// if (!projectId) {
	// 	throw new Error(
	// 		`Failed to retrieve project ID for ${ownerTypeQuery} ${projectOwnerName} project number ${projectNumber}`
	// 	)
	// }

	return projectId

	// const projectId =
	// 	ownerTypeQuery === 'organization'
	// 		? idResp.organization?.projectV2.id
	// 		: idResp.user?.projectV2.id

	// if (!projectId) {
	// 	throw new Error(
	// 		`Failed to retrieve project ID for ${ownerTypeQuery} ${projectOwnerName} project number ${projectNumber}`
	// 	)
	// }

	// return projectId
}

// Retrieves the set of existing content IDs for a given project.
// Returns an empty set if the project ID is undefined or if no content is found.
export async function getExistingContentIds(octokit: OctokitClient, projectId?: string): Promise<Set<string>> {
	const existingContentIds = new Set<string>()
	let cursor: string | null = null
	do {
		const itemsResp: ProjectItemsResponse = await octokit.graphql<ProjectItemsResponse>(
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

	return existingContentIds
}

// Discovers items (issues and pull requests) in a given repository based on the provided search query filters.
// Returns the search results along with the executed query.
export async function discoverItems(
	octokit: OctokitClient,
	action: ActionInfo,
	repo: ProjectRepository,
	searchQueryFilters: string[] = [`state:open`, `archived:false`]
): Promise<SearchResult> {
	const repoOwner = repo.owner?.trim()
	const repoName = repo.name?.trim()
	const ownerType = action.project.ownerType
	const projectOwnerName = action.project.ownerName

	core.debug(`Input repo: ${repo}`)
	core.debug(`Input repo owner: ${repoOwner}`)
	core.debug(`Input repo name: ${repoName}`)

	const searchQueryParts = [...searchQueryFilters]

	let contextOwner: string

	if (repoName) {
		contextOwner = repoOwner ?? projectOwnerName

		core.info(`Searching for open items in the repository: ${contextOwner}/${repoName}`)
		searchQueryParts.push(`repo:${contextOwner}/${repoName}`)
	} else {
		contextOwner = repoOwner ?? github.context.repo.owner

		core.info(`Searching for open items owned by: ${contextOwner}`)
		searchQueryParts.push(ownerType === 'orgs' ? `org:${contextOwner}` : `user:${contextOwner}`)
	}

	core.debug(`Context owner: ${contextOwner}`)

	let query = `${searchQueryParts.join(' ')}`

	if (action.labeled.length > 0) {
		if (action.labelOperator === 'and') {
			query += ` ${action.labeled.map((l) => `label:"${l}"`).join(' ')}`
		} else if (action.labelOperator === 'not') {
			query += ` ${action.labeled.map((l) => `-label:"${l}"`).join(' ')}`
		} else {
			query += ` label:${action.labeled.map((l) => `"${l}"`).join(',')}`
		}
	}

	core.info(`Executing global search query: "${query}"`)
	core.info(`Search web url: https://github.com/issues/search?q=${encodeURIComponent(query)}`)
	const items = (await octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
		q: query,
		per_page: 100,
	})) as unknown as SearchItem[]

	core.info(`Found ${items.length} matching items across the environment.`)

	return { items, query }
}

// Handles a single issue or pull request, applying local label validation and tracking its processing status.
export async function handleIssueOrPR(
	octokit: OctokitClient,
	action: ActionInfo,
	repo: ProjectRepository,
	itemIDs: ItemTracking,
	metrics: MetricsTracking,
	issue?: SearchItem | PayloadIssue | PayloadPullRequest
): Promise<void> {
	// core.debug(`Processing item: ${JSON.stringify(issue, null, 2)}`)
	const issueLabels: string[] = (issue?.labels ?? []).map((l: { name: string }) => l.name.toLowerCase())

	const issueTitle = issue?.title
	const issueUrl = issue?.html_url

	const buildItemInfo = (issueTitle?: string, issueUrl?: string, repoName?: string, created?: Date): ItemInfo => ({
		title: issueTitle,
		url: issueUrl,
		repo: repoName,
		created: created ? new Date(created) : undefined,
	})

	const item = buildItemInfo(issueTitle, issueUrl, repo.name, issue?.created_at)

	core.debug(`Issue/PR owner: ${repo.owner}`)
	core.debug(`Issue/PR labels: ${issueLabels.join(', ')}`)

	if (action.labelOperator === 'and') {
		if (!action.labeled.every((l) => issueLabels.includes(l))) {
			metrics.skip({
				...item,
				title: `${issueTitle} (Failed Local Label Validation)`,
			})
			return
		}
	} else if (action.labelOperator === 'not') {
		if (action.labeled.length > 0 && issueLabels.some((l) => action.labeled.includes(l))) {
			metrics.skip({
				...item,
				title: `${issueTitle} (Failed Local Label Validation)`,
			})
			return
		}
	} else {
		if (action.labeled.length > 0 && !issueLabels.some((l) => action.labeled.includes(l))) {
			metrics.skip({
				...item,
				title: `${issueTitle} (Failed Local Label Validation)`,
			})
			return
		}
	}

	const contentId = issue?.node_id

	core.debug(`Content ID: ${contentId}`)

	if (contentId && itemIDs.existingContentIds.has(contentId)) {
		core.info(
			action.dryRun
				? `[Dry Run] Item already in project (would skip): ${issueUrl}`
				: `Item already in project (skipping): ${issueUrl}`
		)
		metrics.skip(item)
		return
	} else {
		if (action.dryRun) {
			core.info(`[Dry Run] Would process item: ${issueUrl}`)
			metrics.add(item)
			return
		}
		core.info(`Processing item: ${issueUrl}`)
	}

	await addIssueToProject(octokit, action, repo, item, itemIDs, metrics, contentId)
}

// Adds an issue to a GitHub project. If the repository owner matches the project owner, it adds the issue directly to the project.
// Otherwise, it creates a draft issue in the project. Tracks the processing status using the provided metrics tracker.
export async function addIssueToProject(
	octokit: OctokitClient,
	action: ActionInfo,
	repo: ProjectRepository,
	item: ItemInfo,
	itemIDs: ItemTracking,
	metrics: MetricsTracking,
	contentId?: string
): Promise<void> {
	if (repo.owner === action.project.ownerName) {
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
				{
					input: {
						projectId: action.project.id,
						contentId: contentId,
					},
				}
			)
			itemIDs.processedItemIds.push(addResp.addProjectV2ItemById.item.id)
			metrics.add(item)
		} catch (error) {
			if (isAlreadyInProjectError(error)) {
				core.warning(`Item already in project (skipping): ${item.url}`)
				metrics.skip(item)
				return
			}
			core.error(`Failed to add item: ${error instanceof Error ? error.message : String(error)}`)
			metrics.fail({
				...item,
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
				{
					projectId: action.project.id,
					title: item.url,
				}
			)
			itemIDs.processedItemIds.push(addResp.addProjectV2DraftIssue.projectItem.id)
			metrics.add(item)
		} catch (error) {
			if (isAlreadyInProjectError(error)) {
				core.warning(`Item already in project (skipping): ${item.url}`)
				metrics.skip(item)
				return
			}
			core.error(`Failed to add item: ${error instanceof Error ? error.message : String(error)}`)
			metrics.fail({
				...item,
				reason: error instanceof Error ? error.message : String(error),
			})
		}
	}
}
