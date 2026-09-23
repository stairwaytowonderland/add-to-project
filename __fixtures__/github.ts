import { jest } from '@jest/globals'

export const getOctokit = jest.fn()

// context must be a mutable plain object (tests assign to context.payload)
export const context = {
	payload: {} as Record<string, unknown>,
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
