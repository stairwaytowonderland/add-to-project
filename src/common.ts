import { getOctokit } from '@actions/github'

/*
 * Octokit client
 */

export type OctokitClient = ReturnType<typeof getOctokit>

/*
 * Action Base
 */

// Represents the base configuration for a GitHub Actions run
export interface ActionBase {
	dryRun: boolean
}

/*
 * Repository related
 */

// Simple repository information
// Represents basic information about a GitHub repository
export interface SimpleRepository {
	name?: string
	owner?: string
	fullName?: string
}

// Repository information class
// Provides methods to parse and normalize repository information from various sources
export class ActionRepository implements SimpleRepository {
	name?: string
	owner?: string

	// Class getter ... dynamically updates if name or owner changes.
	get fullName(): string | undefined {
		return this.owner && this.name ? `${this.owner}/${this.name}` : undefined
	}

	constructor()
	constructor(name?: string, owner?: string)
	constructor(repo: SimpleRepository)
	constructor(repoOrName?: string | SimpleRepository, owner?: string) {
		if (typeof repoOrName === 'string') {
			const repoParts = repoOrName.trim().split('/')

			// 1. If an explicit owner argument is passed, it always wins.
			// 2. If a slash exists, the first part is the owner.
			const repoOwner = owner ?? (repoParts.length > 1 ? repoParts[0] : undefined)

			// 1. If a slash exists, the second part is the repo name.
			// 2. If no slash exists, the single string is the repo name.
			const repoName = repoParts.length > 1 ? repoParts[1] : repoParts[0]

			this.owner = repoOwner?.trim() || undefined
			this.name = repoName?.trim() || undefined
		} else if (repoOrName) {
			this.owner = repoOrName.owner?.trim() || undefined
			this.name = repoOrName.name?.trim() || undefined
		}
	}

	// Parses the repository owner and name from a GitHub API URL and updates the instance accordingly.
	// Example: https://api.github.com/repos/owner/repo
	fromApiUrl(apiUrl: string): this {
		const match = apiUrl.match(/\/repos\/([^/]+)\/([^/]+)$/)

		if (match) {
			this.owner = match[1]
			this.name = match[2]
		}

		return this
	}
}

/*
 * REST API related types and functions
 * Provides types and functions for interacting with the GitHub REST API.
 */

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

// Searches for issues and pull requests based on the provided query using the GitHub REST API.
// Returns a list of search result items matching the query.
// https://docs.github.com/en/rest/search/search?apiVersion=2026-03-10#search-issues-and-pull-requests
export async function searchIssuesAndPullRequests(query: string, octokit: OctokitClient): Promise<SearchItem[]> {
	// console.debug(`searchIssuesAndPullRequests -- web url: https://github.com/issues/search?q=${encodeURIComponent(query)}`)
	const items = (await octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
		q: query,
		per_page: 100,
	})) as unknown as SearchItem[]

	return items
}
