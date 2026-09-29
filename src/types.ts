import { WebhookPayload } from '@actions/github/lib/interfaces.js'

/*
 * Use common.js
 */

import {
	ActionBase,
	OctokitClient,
	ActionRepository,
	SimpleRepository,
	SearchItem,
	searchIssuesAndPullRequests,
} from './common.js'
export type { ActionBase, OctokitClient, SimpleRepository, SearchItem }
export { ActionRepository, searchIssuesAndPullRequests }

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
export interface ActionInfo extends ActionBase {
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
