import { WebhookPayload } from '@actions/github/lib/interfaces.js'

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

export interface ProjectAddItemResponse {
	addProjectV2ItemById: {
		item: {
			id: string
		}
	}
}

export interface ProjectV2AddDraftIssueResponse {
	addProjectV2DraftIssue: {
		projectItem: {
			id: string
		}
	}
}

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

export interface SearchItem {
	node_id: string
	number: number
	labels: { name: string }[]
	title: string
	html_url: string
	repository_url: string
	created_at: Date
}

export interface ItemData {
	title?: string
	repo?: string
	url?: string
	created?: Date
}

export interface FailedItemData extends ItemData {
	reason: string
}

export interface SummaryMetrics {
	added: ItemData[]
	skipped: ItemData[]
	failed: FailedItemData[]
}

export type PayloadIssue = NonNullable<WebhookPayload['issue']>

export type PayloadPullRequest = NonNullable<WebhookPayload['pull_request']>
