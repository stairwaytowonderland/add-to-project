import { getOctokit } from '@actions/github'
import { WebhookPayload } from '@actions/github/lib/interfaces.js'

/*
 * GraphQL response types for GitHub Projects V2
 */

// Project V2 node ID response type
export interface ProjectNodeIDResponse {
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

// Project V2 add item response type
export interface ProjectAddItemResponse {
	addProjectV2ItemById: {
		item: {
			id: string
		}
	}
}

// Project V2 add draft issue response type
export interface ProjectV2AddDraftIssueResponse {
	addProjectV2DraftIssue: {
		projectItem: {
			id: string
		}
	}
}

// Project V2 items response type
export interface ProjectItemsResponse {
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

/*
 * Action, project and search related types
 */

// Action information
// Represents the configuration and context for the current GitHub Actions run
export interface ActionInfo {
	dryRun: boolean
	labeled: string[]
	labelOperator: LabelOperator
	project: ProjectInfo
}

// Project information
// Represents basic information about a GitHub project
export interface ProjectInfo {
	url: string
	number: number
	ownerName: string
	ownerType: OwnerType
	ownerTypeQuery: OwnerTypeQuery
	id?: string
}

// Search item response type
// Represents a single search result item from the GitHub API
export interface SearchItem {
	node_id: string
	number: number
	labels: { name: string }[]
	title: string
	html_url: string
	repository_url: string
	created_at: Date
}

// Search result information
// Represents the result of a search query from the GitHub API
export interface SearchResult {
	items: SearchItem[]
	query: string
}

// Item data information
// Represents the essential data of an item
export interface ItemInfo {
	title?: string
	repo?: string
	url?: string
	created?: Date
}

// Failed item data information
// Represents an item that failed processing along with the reason for failure
export interface FailedItemInfo extends ItemInfo {
	reason: string
}

// Content tracking information
// Tracks the IDs of existing content and processed items
export interface ItemTracking {
	existingContentIds: Set<string>
	processedItemIds: string[]
}

/*
 * Metrics related types
 */

// Metrics data information
// Tracks added, skipped, and failed items
export interface MetricsData {
	added: ItemInfo[]
	skipped: ItemInfo[]
	failed: FailedItemInfo[]
}

// Metrics tracker interface
// Defines methods for tracking added, skipped, and failed items along with read-only access to metrics data
export interface MetricsTracking {
	readonly data: MetricsData
	add(item: ItemInfo): void
	skip(item: ItemInfo): void
	fail(item: FailedItemInfo): void
}

// Summary metrics implementation
// Implements the MetricsTracker interface to track added, skipped, and failed items
export class SummaryMetrics implements MetricsTracking {
	// Read-only from the outside to prevent accidental overrides
	readonly data: MetricsData = { added: [], skipped: [], failed: [] }

	add(item: ItemInfo) {
		this.data.added.push(item)
	}

	skip(item: ItemInfo) {
		this.data.skipped.push(item)
	}

	fail(item: FailedItemInfo) {
		this.data.failed.push(item)
	}
}

/*
 * Repository related types
 */

// Simple repository information
// Represents basic information about a GitHub repository
export interface SimpleRepository {
	name?: string
	owner?: string
}

// Project repository information
// Represents detailed information about a GitHub repository within a project context
export interface ProjectRepository {
	name: string
	owner: string
	fullName: string
}

// Repository information class
// Provides methods to parse and normalize repository information from various sources
export class RepositoryInfo implements SimpleRepository {
	name?: string
	owner?: string
	fullName?: string
	normalized?: ProjectRepository

	constructor(name?: string, owner?: string) {
		const repoParts = name?.trim().split('/') ?? []
		const repoOwner = repoParts.length > 1 ? repoParts[0] : owner
		const repoName = repoParts?.[1] ?? repoParts[0]
		this.owner = repoOwner
		this.name = repoName
		this.fullName = `${repoOwner}/${repoName}`
		this.normalize()
	}

	normalize(): ProjectRepository {
		this.owner = this.owner ?? ''
		this.name = this.name ?? ''
		this.fullName = `${this.owner}/${this.name}`
		this.normalized = {
			name: this.name,
			owner: this.owner,
			fullName: this.fullName,
		}
		return this.normalized
	}

	fromApiUrl(apiUrl: string): RepositoryInfo {
		const match = apiUrl.match(/\/repos\/([^/]+)\/([^/]+)$/)

		if (match) {
			this.owner = match[1]
			this.name = match[2]
			this.fullName = `${this.owner}/${this.name}`
		}

		// const parts = apiUrl.trim().split('/repos/')[1]?.split('/').filter(Boolean) ?? []
		// if (parts.length >= 2) {
		// 	this.owner = parts[0]
		// 	this.name = parts[1]
		// 	this.fullName = `${this.owner}/${this.name}`
		// }

		return this
	}
}

/*
 * Label and owner related types
 */
export type LabelOperator = 'and' | 'or' | 'not'
export type OwnerType = 'orgs' | 'users'
export type OwnerTypeQuery = 'organization' | 'user'

/*
 * Webhook payload related types
 */
export type PayloadIssue = NonNullable<WebhookPayload['issue']>
export type PayloadPullRequest = NonNullable<WebhookPayload['pull_request']>

/*
 * Octokit client related types
 */
export type OctokitClient = ReturnType<typeof getOctokit>
