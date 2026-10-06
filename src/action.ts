/**
 * Action logic
 *
 * Contains the main logic for the GitHub Action
 */

// Import core libraries
import * as core from '@actions/core'

// Import custom types and utilities from the project
import {
	// Common types and utilities
	RepoAction,
	ActionRepository,
	OctokitClient,
	SimpleRepository,
	SearchItem,
	searchIssuesAndPullRequests,
	getOctokit,
	// Custom types and utilities
	ProjectAddItemResponse,
	ProjectNodeIDResponse,
	ProjectItemsResponse,
	ProjectV2AddDraftIssueResponse,
	ProjectInfo,
	ItemInfo,
	SearchResult,
	ItemTracking,
	FailedItemInfo,
	MetricsData,
	MetricsTracking,
	OwnerType,
	OwnerTypeQuery,
	LabelOperator,
	PayloadIssue,
	PayloadPullRequest,
} from './types.js'

import type { ActionConfig } from './config.js'

/**
 * Regular expression to parse the GitHub project URL and extract the owner type, owner name, and project number.
 */
const urlParse = /\/(?<ownerType>orgs|users)\/(?<ownerName>[^/]+)\/projects\/(?<projectNumber>\d+)/

/**
 * Add issues or pull requests to a GitHub project.
 *
 * @param action The action metadata and inputs for the current GitHub Actions run.
 * @returns A promise that resolves when the operation is complete.
 */
export default async (action: RepoAction): Promise<void> => {
	// Primary Inputs
	const projectUrl = (action.inputs?.projectUrl as string).trim()
	core.debug(`Project URL: ${projectUrl}`)

	const urlMatch = projectUrl.match(urlParse)

	if (!urlMatch) {
		throw new Error(
			`Invalid project URL: ${projectUrl}. Project URL should match the format <GitHub server domain name>/<orgs-or-users>/<ownerName>/projects/<projectNumber>`
		)
	}

	// Other Inputs
	const ghToken = (action.inputs?.ghToken as string)?.trim()
	const labeled = (action.inputs?.labeled as string)
		?.trim()
		.split(',')
		.map((l: string) => l.trim().toLowerCase())
		.filter((l: string) => l.length > 0)
	const labelOperator = (action.inputs?.labelOperator as string)?.trim().toLocaleLowerCase() as LabelOperator
	const inputRepo = (action.inputs?.repo as string)?.trim()
	const inputOwner = (action.inputs?.owner as string)?.trim()

	// Octokit instance for GitHub API requests
	const octokit = getOctokit(ghToken)

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

	const isInputOwner: boolean = inputOwner?.length > 0
	const isInputRepo: boolean = inputRepo?.length > 0
	const isOwnerOnly: boolean = isInputOwner && !isInputRepo
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

	const actionConfig: ActionConfig = {
		labeled,
		labelOperator,
		project,
		...action,
	}

	let searchQuery

	// If an input repository is specified, discover items within that repository first.
	if (isInputRepo || isInputOwner) {
		let repo: SimpleRepository
		if (isOwnerOnly) {
			repo = new ActionRepository({ owner: inputOwner }) as SimpleRepository
		} else {
			repo = new ActionRepository({ repo: inputRepo, owner: inputOwner }) as SimpleRepository
		}
		const searchResults: SearchResult = await discoverItems(octokit, actionConfig, repo)
		searchQuery = searchResults.query
		discoveredItems.push(...searchResults.items)

		if (discoveredItems.length === 0) {
			await writeJobSummary(metrics, actionConfig, searchQuery)
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
			const repo = new ActionRepository().fromApiUrl(issue.repository_url) as SimpleRepository

			await handleIssueOrPR(octokit, actionConfig, repo, itemIDs, metrics, issue).catch((error) => {
				core.error(`Error processing item ${issue.html_url}: ${error instanceof Error ? error.message : String(error)}`)
				metrics.fail({
					title: issue.title,
					url: issue.html_url,
					repo: repo.fullName,
					reason: error instanceof Error ? error.message : String(error),
				})
			})
		}

		const output = itemIDs.processedItemIds.length > 0 ? itemIDs.processedItemIds.join(',') : ''

		core.info(`items: ${output}`)
		core.setOutput('items', output)

		await writeJobSummary(metrics, actionConfig, searchQuery)
	} else {
		const issue = action.context.payload.issue ?? action.context.payload.pull_request

		if (!issue) {
			core.warning('No issue or pull request found in the GitHub Actions context payload. Skipping processing.')
			return
		}

		const issueOwnerName = action.context.payload.repository?.owner.login
		const repoName = action.context.payload.repository?.name

		const repo = new ActionRepository({ repo: repoName, owner: issueOwnerName }) as SimpleRepository

		await handleIssueOrPR(octokit, actionConfig, repo, itemIDs, metrics, issue).catch((error) => {
			core.error(`Error processing item ${issue?.html_url}: ${error instanceof Error ? error.message : String(error)}`)
			metrics.fail({
				title: issue?.title,
				url: issue?.html_url,
				repo: repoName,
				reason: error instanceof Error ? error.message : String(error),
			})
		})

		const output = itemIDs.processedItemIds.length > 0 ? itemIDs.processedItemIds.join(',') : ''

		core.info(`items: ${output}`)
		core.setOutput('items', output)

		await writeJobSummary(metrics, actionConfig, searchQuery)
	}
}

/**
 * Writes a summary of the job execution, including added, skipped, and failed items, to the GitHub Actions job summary.
 *
 * @param metrics The metrics tracking object containing added, skipped, and failed items.
 * @param action The action configuration object.
 * @param query The search query used to filter items (optional).
 */
async function writeJobSummary(metrics: MetricsTracking, action: ActionConfig, query?: string): Promise<void> {
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

/**
 * Returns true only for expected "already in project" API errors — does not log
 *
 * @param error The error object to check.
 * @returns True if the error indicates that the content is already in the project, false otherwise.
 */
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

/**
 * Returns the GraphQL owner type query string for the given owner type ('orgs' or 'users').
 * Throws an error for unsupported owner types.
 *
 * @param ownerType The type of the owner, either 'orgs' or 'users'.
 * @returns The corresponding GraphQL owner type query string ('organization' or 'user').
 */
export function mustGetOwnerTypeQuery(ownerType?: string): OwnerTypeQuery {
	const ownerTypeQuery = ownerType === 'orgs' ? 'organization' : ownerType === 'users' ? 'user' : null
	if (!ownerTypeQuery) {
		throw new Error(`Unsupported ownerType: ${ownerType}. Must be one of 'orgs' or 'users'`)
	}
	return ownerTypeQuery
}

/**
 * Retrieves the node ID of a GitHub project given the owner type, project owner name, and project number.
 * Returns undefined if the project is not found.
 *
 * @param octokit The Octokit client instance used to make GitHub API requests.
 * @param ownerTypeQuery The GraphQL owner type query string ('organization' or 'user').
 * @param projectOwnerName The login name of the project owner.
 * @param projectNumber The number of the project within the owner's namespace.
 * @returns The node ID of the project if found, otherwise undefined.
 */
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

/**
 * Retrieves the set of existing content IDs for a given project.
 * Returns an empty set if the project ID is undefined or if no content is found.
 *
 * @param octokit The Octokit client instance used to make GitHub API requests.
 * @param projectId The node ID of the project for which to retrieve existing content IDs.
 * @returns A set of existing content IDs for the specified project. Returns an empty set if the project ID is undefined or if no content is found.
 */
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

/**
 * Discovers items (issues and pull requests) in a given repository based on the provided search query filters.
 * Returns the search results along with the executed query.
 *
 * @param octokit The Octokit client instance used to make GitHub API requests.
 * @param action The action configuration containing project and label information.
 * @param repo The repository in which to search for items.
 * @param searchQueryFilters An array of search query filters to apply (default: [`state:open`, `archived:false`]).
 * @returns An object containing the discovered items and the executed search query.
 */
export async function discoverItems(
	octokit: OctokitClient,
	action: ActionConfig,
	repo: SimpleRepository,
	searchQueryFilters: string[] = [`state:open`, `archived:false`]
): Promise<SearchResult> {
	const repoOwner = repo.owner?.trim()
	const repoName = repo.repo?.trim()
	const isOwnerOnly = repoOwner && !repoName
	const ownerType = action.project.ownerType
	const projectOwnerName = action.project.ownerName

	// console.debug(`Project owner: ${projectOwnerName}`)

	core.debug(`Input repo: ${repo}`)
	core.debug(`Input repo owner: ${repoOwner}`)
	core.debug(`Input repo name: ${repoName}`)
	core.debug(`Project owner: ${projectOwnerName}`)

	const searchQueryParts = [...searchQueryFilters]

	let contextOwner: string

	if (isOwnerOnly) {
		contextOwner = repoOwner

		core.info(`Searching for open items owned by: ${contextOwner}`)
		searchQueryParts.push(ownerType === 'orgs' ? `org:${contextOwner}` : `user:${contextOwner}`)
	} else {
		contextOwner = repoOwner ?? projectOwnerName

		core.info(`Searching for open items in the repository: ${contextOwner}/${repoName}`)
		searchQueryParts.push(`repo:${contextOwner}/${repoName}`)
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
	const items = await searchIssuesAndPullRequests(query, octokit)

	core.info(`Found ${items.length} matching items across the environment.`)

	return { items, query }
}

/**
 * Handles a single issue or pull request, applying local label validation and tracking its processing status.
 *
 * @param octokit The Octokit client instance used to make GitHub API requests.
 * @param action The action configuration containing project and label information.
 * @param repo The repository containing the issue or pull request.
 * @param itemIDs The tracking object for existing content IDs.
 * @param metrics The metrics tracking object for recording processing outcomes.
 * @param issue The issue or pull request to be processed.
 */
export async function handleIssueOrPR(
	octokit: OctokitClient,
	action: ActionConfig,
	repo: SimpleRepository,
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

	const item = buildItemInfo(issueTitle, issueUrl, repo.repo, issue?.created_at)

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

/**
 * Adds an issue to a GitHub project. If the repository owner matches the project owner, it adds the issue directly to the project.
 * Otherwise, it creates a draft issue in the project. Tracks the processing status using the provided metrics tracker.
 *
 * @param octokit The Octokit client instance used to make GitHub API requests.
 * @param action The action configuration containing project and label information.
 * @param repo The repository containing the issue or pull request.
 * @param item The item information for the issue or pull request.
 * @param itemIDs The tracking object for existing content IDs.
 * @param metrics The metrics tracking object for recording processing outcomes.
 * @param contentId The node ID of the content to be added to the project (optional).
 */
export async function addIssueToProject(
	octokit: OctokitClient,
	action: ActionConfig,
	repo: SimpleRepository,
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

// Summary metrics implementation
// Implements the MetricsTracker interface to track added, skipped, and failed items
/**
 * SummaryMetrics is an implementation of the MetricsTracking interface.
 *
 * It tracks added, skipped, and failed items in a project.
 */
export class SummaryMetrics implements MetricsTracking {
	/**
	 * The data structure that holds added, skipped, and failed items.
	 * It is read-only from the outside to prevent accidental overrides.
	 */
	readonly data: MetricsData = { added: [], skipped: [], failed: [] }

	/**
	 * Adds an item to the added items list.
	 * @param item - The item to add.
	 */
	add(item: ItemInfo) {
		this.data.added.push(item)
	}

	/**
	 * Adds an item to the skipped items list.
	 * @param item - The item to skip.
	 */
	skip(item: ItemInfo) {
		this.data.skipped.push(item)
	}

	/**
	 * Adds an item to the failed items list.
	 * @param item - The item that failed.
	 */
	fail(item: FailedItemInfo) {
		this.data.failed.push(item)
	}
}
