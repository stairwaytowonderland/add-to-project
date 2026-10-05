/**
 * Common types and utilities for the GitHub Action.
 */

import { getOctokit } from '@actions/github'
import { Context } from '@actions/github/lib/context.js'

/*
 * Octokit client
 */

export { getOctokit }
export type OctokitClient = ReturnType<typeof getOctokit>

/*
 * Action related
 */

// GitHub context type alias for convenience.
export type { Context as GitHubContext }

/**
 * Represents the base configuration for a GitHub Actions run.
 */
export interface RepoAction {
	/** Indicates if the action should run in dry-run mode. */
	dryRun: boolean

	/** The GitHub context object. */
	context: Context

	/** The repository associated with the GitHub Action. */
	repo: SimpleRepository

	/** The action inputs provided to the GitHub Action. */
	inputs?: {
		[key: string]: unknown
		dryRun: string
	}
}

/*
 * Repository related
 */

/**
 * Represents basic information about a GitHub repository.
 *
 * Extends the Partial type to allow optional repository properties.
 *
 * @see https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype
 * @see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-1.html#mapped-types
 */
export interface SimpleRepository extends Partial<Context['repo']> {
	/** The full repository name in the format "owner/repo". */
	fullName?: string
}

/**
 * Provides methods to parse and normalize repository information from various sources.
 */
export class ActionRepository implements SimpleRepository {
	/** The repository name. */
	repo?: string

	/** The repository owner. */
	owner?: string

	/**
	 * The full repository name in the format "owner/repo".
	 * Dynamically updates if the name or owner changes.
	 */
	get fullName(): string | undefined {
		return this.owner && this.repo ? `${this.owner}/${this.repo}` : undefined
	}

	/**
	 * Initializes an ActionRepository instance with default values.
	 */
	constructor()

	/**
	 * Initializes an ActionRepository instance with the specified repository name and owner.
	 *
	 * @param repoOrName The repository name or a SimpleRepository object.
	 * @param owner The repository owner (optional if repoOrName contains a slash).
	 */
	constructor(name?: string, owner?: string)

	/**
	 * Initializes an ActionRepository instance from an existing SimpleRepository object.
	 *
	 * @param repo The SimpleRepository object containing repository information.
	 */
	constructor(repo: SimpleRepository)

	// Main constructor implementation handling all overloads.
	// Examples:
	// - new ActionRepository('owner/repo') => { owner: 'owner', repo: 'repo' }
	// - new ActionRepository('repo') => { owner: undefined, repo: 'repo' }
	// - new ActionRepository('owner/') => { owner: 'owner', repo: undefined }
	// - new ActionRepository({ repo: 'owner/repo' }) => { owner: 'owner', repo: 'repo' }
	constructor(repoOrName?: string | SimpleRepository, owner?: string) {
		if (typeof repoOrName === 'string') {
			const repo = repoOrName.trim()

			// Reject slash-only values before parsing so we do not interpret them as a valid
			// owner/repo pair or repo name. A bare '/' is not a meaningful repository input.
			if (!repo || repo === '/') {
				this.owner = undefined
				this.repo = undefined
				return
			}

			const repoParts = repo.split('/').filter(Boolean)
			const explicitOwner = owner?.trim()

			// 1. If an explicit owner argument is passed, it always wins.
			// Example: new ActionRepository('repo', 'octocat') => { owner: 'octocat', repo: 'repo' }
			if (explicitOwner) {
				this.owner = explicitOwner
				this.repo = repoParts[0]
				return
			}

			// 2. If the value ends with a trailing slash, treat it as owner-only.
			// Example: new ActionRepository('octocat/') => { owner: 'octocat', repo: undefined }
			if (repo.endsWith('/')) {
				this.owner = repoParts[0]
				this.repo = undefined
				return
			}

			// 3. If a slash exists in the middle of the value, split owner and repo.
			// Example: new ActionRepository('octocat/hello-world') => { owner: 'octocat', repo: 'hello-world' }
			if (repoParts.length > 1) {
				this.owner = repoParts[0]
				this.repo = repoParts.slice(1).join('/')
				return
			}

			// 4. Otherwise, the value is a repo name without an explicit owner.
			// Example: new ActionRepository('hello-world') => { owner: undefined, repo: 'hello-world' }
			this.owner = undefined
			this.repo = repoParts[0]
		} else if (repoOrName) {
			const repoOwner = repoOrName.owner?.trim()
			const repoName = repoOrName.repo?.trim()

			// Reject empty or slash-only values before any owner/repo splitting so '/' cannot be
			// mistaken for a meaningful repository string. This keeps the later parsing logic
			// focused on actual owner/repo pairs instead of placeholder values.
			if (!repoOwner && (!repoName || repoName === '/')) {
				this.owner = undefined
				this.repo = undefined
				return
			}

			// If no owner is supplied and the repo string already contains an owner/repo pair,
			// split it into the correct fields before later logic concatenates them again.
			// Example: { repo: 'octocat/hello-world' } => { owner: 'octocat', repo: 'hello-world' }
			if (!repoOwner && repoName?.includes('/')) {
				const [parsedOwner, ...rest] = repoName.split('/').filter(Boolean)
				this.owner = normalizeOptional(parsedOwner?.trim())
				this.repo = normalizeOptional(rest.join('/').trim())
				return
			}

			// If the repository string does not contain a slash or the owner is provided,
			// assign the owner and repository name to the instance.
			// Example: owner = 'octocat', repo = 'hello-world'
			this.owner = normalizeOptional(repoOwner)
			this.repo = normalizeOptional(repoName)
		}
	}

	/**
	 * Parses the repository owner and name from a GitHub API URL and updates the instance accordingly.
	 *
	 * @see https://api.github.com/repos/owner/repo
	 */
	fromApiUrl(apiUrl: string): this {
		const match = apiUrl.match(/\/repos\/([^/]+)\/([^/]+)$/)

		if (match) {
			this.owner = match[1]
			this.repo = match[2]
		}

		return this
	}

	/**
	 * Updates the repository owner and name based on the provided GitHub Actions context.
	 *
	 * @param context The GitHub Actions context containing repository information.
	 */
	fromContextRepo(context: Context): this {
		this.owner = context.repo.owner
		this.repo = context.repo.repo

		return this
	}
}

/**
 * Normalizes an optional string value.
 *
 * Converts empty strings or undefined values to undefined.
 * This is useful for handling optional string values where empty strings should be treated as undefined.
 *
 * @param value The string value to normalize. If the value is an empty string or undefined, it will be converted to undefined.
 * @returns The normalized string value or undefined.
 */
export function normalizeOptional(value?: string): string | undefined {
	return value || undefined
}

/*
 * REST API related types and functions
 * Provides types and functions for interacting with the GitHub REST API.
 */

/**
 * Represents a single search result item from the GitHub API.
 */
export interface SearchItem {
	node_id: string
	number: number
	labels: { name: string }[]
	title: string
	html_url: string
	repository_url: string
	created_at: Date
}

/**
 * Searches for issues and pull requests based on the provided query using the GitHub REST API.
 * Returns a list of search result items matching the query.
 *
 * @see https://docs.github.com/en/rest/search/search?apiVersion=2026-03-10#search-issues-and-pull-requests
 *
 * @param query The search query string used to find issues and pull requests.
 * @param octokit The Octokit client instance used to interact with the GitHub REST API.
 * @returns A promise that resolves to an array of search result items matching the query.
 */
export async function searchIssuesAndPullRequests(query: string, octokit: OctokitClient): Promise<SearchItem[]> {
	// console.debug(`searchIssuesAndPullRequests -- web url: https://github.com/issues/search?q=${encodeURIComponent(query)}`)
	const items = (await octokit.paginate(octokit.rest.search.issuesAndPullRequests, {
		q: query,
		per_page: 100,
	})) as unknown as SearchItem[]

	return items
}
