// import { getOctokit } from '@actions/github'
import type { WebhookPayload } from '@actions/github/lib/interfaces.js'
import { createAsyncMock } from '../__utils__/mocks.js'

/**
 * Mocked GitHub Octokit instance for testing purposes.
 */
export const getOctokit = createAsyncMock()

/**
 * Mocked GitHub context for testing purposes.
 *
 * This context object is mutable and can be modified in tests to simulate different GitHub events and payloads.
 */
export const context = {
	payload: {
		// issue: { number: 1, html_url: '', body: '' },
		// pull_request: { number: 2, html_url: '', body: '' },
		repository: {
			full_name: '',
			owner: { login: '' },
			name: '',
		},
	} as WebhookPayload,
	repo: { owner: '', repo: '' },
	eventName: '',
	sha: '',
	ref: '',
	workflow: '',
	action: '',
	actor: '',
	runNumber: 0,
	runId: 0,
	apiUrl: 'https://api.github.com',
	serverUrl: 'https://github.com',
	graphqlUrl: 'https://api.github.com/graphql',
}
