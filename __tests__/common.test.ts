/// <reference types="jest" />

/**
 * Unit tests for src/common.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the GitHub module is mocked in this test,
 * so that the actual '@actions/github' module is not imported.
 */

// Import mocked GitHub module from fixtures
import * as github from '../__fixtures__/github.js'

// Import Jest testing utilities
import { jest } from '@jest/globals'

// Import the source to be tested
import Action from '../src/config.js'
import type { SimpleRepository, GitHubContext, OctokitClient } from '../src/types.js'
import { ActionRepository } from '../src/types.js'
import {
	kebabToCamel,
	normalizeOptional,
	searchIssuesAndPullRequests,
	getIssueFromContext,
	getPrFromContext,
} from '../src/utils.js'

jest.unstable_mockModule('@actions/github', () => github)

describe('Config', () => {
	describe('Action', () => {
		test('initializes with default values', () => {
			const action = new Action(github.context as GitHubContext)
			expect(action.dryRun).toBe(false)
			expect(action.actor).toBeDefined()
			expect(action.repo).toBeDefined()
			expect(action.inputs).toBeDefined()
		})

		test('get actor from action', () => {
			const action = new Action(github.context as GitHubContext)
			expect(action.actor).toBeDefined()
		})

		test('get repo from action', () => {
			const action = new Action(github.context as GitHubContext)
			expect(action.repo).toBeDefined()
		})
	})

	describe('ActionRepository', () => {
		test('parses repository information from a string', () => {
			const repo = new ActionRepository('owner/repo')
			expect(repo.owner).toBe('owner')
			expect(repo.repo).toBe('repo')
			expect(repo.fullName).toBe('owner/repo')
		})

		test('uses explicit owner argument when provided', () => {
			const repo = new ActionRepository('repo', 'explicit-owner')
			expect(repo.owner).toBe('explicit-owner')
			expect(repo.repo).toBe('repo')
			expect(repo.fullName).toBe('explicit-owner/repo')
		})

		test('parses repository information from a SimpleRepository object', () => {
			const repo = new ActionRepository({ owner: 'owner', repo: 'repo' })
			expect(repo.owner).toBe('owner')
			expect(repo.repo).toBe('repo')
			expect(repo.fullName).toBe('owner/repo')
		})

		test('handles repo names without an explicit owner', () => {
			const repo = new ActionRepository('repo')
			expect(repo.owner).toBeUndefined()
			expect(repo.repo).toBe('repo')
			expect(repo.fullName).toBeUndefined()
		})

		test('treats empty and slash-only inputs as unset', () => {
			expect(new ActionRepository('').owner).toBeUndefined()
			expect(new ActionRepository('').repo).toBeUndefined()
			expect(new ActionRepository('/').owner).toBeUndefined()
			expect(new ActionRepository('/').repo).toBeUndefined()
			expect(new ActionRepository({}).owner).toBeUndefined()
			expect(new ActionRepository({ repo: '/' }).owner).toBeUndefined()
			expect(new ActionRepository({ repo: '/' }).repo).toBeUndefined()
		})

		test('normalizes a full repo string when owner is omitted', () => {
			const repo = new ActionRepository({ repo: 'stairwaytowonderland/add-to-project' })
			expect(repo.owner).toBe('stairwaytowonderland')
			expect(repo.repo).toBe('add-to-project')
			expect(repo.fullName).toBe('stairwaytowonderland/add-to-project')
		})

		test('normalizes owner-only repo input without duplicating the owner', async () => {
			const repo = new ActionRepository({ repo: 'stairwaytowonderland/' }) as SimpleRepository
			expect(repo).toMatchObject({ owner: 'stairwaytowonderland' })
			expect(repo.repo).toBeUndefined()
		})

		test('treats a trailing slash string as owner-only', () => {
			const repo = new ActionRepository('octocat/')
			expect(repo.owner).toBe('octocat')
			expect(repo.repo).toBeUndefined()
			expect(repo.fullName).toBeUndefined()
		})

		test('parses repository information from an API URL', () => {
			const repo = new ActionRepository().fromApiUrl('https://api.github.com/repos/owner/repo')
			expect(repo.owner).toBe('owner')
			expect(repo.repo).toBe('repo')
			expect(repo.fullName).toBe('owner/repo')
		})

		test('handles invalid API URL gracefully', () => {
			const repo = new ActionRepository().fromApiUrl('https://api.github.com/repos/owner')
			expect(repo.owner).toBeUndefined()
			expect(repo.repo).toBeUndefined()
			expect(repo.fullName).toBeUndefined()
		})

		test('parses repository information from the GitHub context', () => {
			github.context.actor = 'actor'
			github.context.repo = { owner: 'owner', repo: 'repo' }

			const repo = new ActionRepository().fromContextRepo(github.context as GitHubContext)
			expect(repo.owner).toBe('owner')
			expect(repo.repo).toBe('repo')
			expect(repo.fullName).toBe('owner/repo')
		})
	})
})

describe('Utilities', () => {
	describe('normalizeOptional', () => {
		test('converts empty string to undefined', () => {
			expect(normalizeOptional('')).toBeUndefined()
			expect(normalizeOptional(undefined)).toBeUndefined()
			expect(normalizeOptional('value')).toBe('value')
		})

		test('does not modify non-empty strings', () => {
			expect(normalizeOptional('non-empty')).toBe('non-empty')
		})
	})

	describe('kebabToCamel', () => {
		test('converts kebab-case to camelCase', () => {
			expect(kebabToCamel('kebab-case-string')).toBe('kebabCaseString')
			expect(kebabToCamel('another-example')).toBe('anotherExample')
			expect(kebabToCamel('no-change')).toBe('noChange')
		})
	})

	describe('Context Payload', () => {
		test('getIssueFromContext returns the issue from the context payload', () => {
			github.context.payload.issue = { number: 1 }
			const issue = getIssueFromContext(github.context as GitHubContext)
			expect(issue).toEqual({ number: 1 })
		})

		test('getPrFromContext returns the pull request from the context payload', () => {
			github.context.payload.pull_request = { number: 2 }
			const pr = getPrFromContext(github.context as GitHubContext)
			expect(pr).toEqual({ number: 2 })
		})

		test('getIssueFromContext returns the issue using the default fallback context', () => {
			github.context.payload.issue = { number: 1 }
			const issue = getIssueFromContext()
			expect(issue).toEqual({ number: 1 })
		})

		test('getPrFromContext returns the pull request using the default fallback context', () => {
			github.context.payload.pull_request = { number: 2 }
			const pr = getPrFromContext()
			expect(pr).toEqual({ number: 2 })
		})
	})

	describe('searchIssuesAndPullRequests', () => {
		test('should return search results for a given query', async () => {
			const mockIssuesAndPullRequests = jest.fn()

			const mockPaginate = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue([
				{
					node_id: '12345',
					number: 1,
					labels: [{ name: 'bug' }],
					title: 'Issue 1',
					html_url: 'https://github.com/owner/repo/issues/1',
					repository_url: 'https://api.github.com/repos/owner/repo',
					created_at: new Date(),
				},
			])

			const octokit = {
				paginate: mockPaginate,
				rest: {
					search: {
						issuesAndPullRequests: mockIssuesAndPullRequests,
					},
				},
			}

			const results = await searchIssuesAndPullRequests('repo:owner/repo is:issue', octokit as unknown as OctokitClient)

			expect(results).toHaveLength(1)
			expect(results[0].node_id).toBe('12345')
			expect(results[0].number).toBe(1)
			expect(results[0].labels).toEqual([{ name: 'bug' }])
			expect(results[0].title).toBe('Issue 1')
			expect(results[0].html_url).toBe('https://github.com/owner/repo/issues/1')
			expect(results[0].repository_url).toBe('https://api.github.com/repos/owner/repo')
		})
	})
})
