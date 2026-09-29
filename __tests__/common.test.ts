import { ActionRepository } from '../src/types.js'

describe('ActionRepository', () => {
	test('parses repository information from a string', () => {
		const repo = new ActionRepository('owner/repo')
		expect(repo.owner).toBe('owner')
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBe('owner/repo')
	})

	test('parses repository information from a SimpleRepository object', () => {
		const repo = new ActionRepository({ owner: 'owner', name: 'repo' })
		expect(repo.owner).toBe('owner')
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBe('owner/repo')
	})

	test('handles missing owner in string', () => {
		const repo = new ActionRepository('repo')
		expect(repo.owner).toBeUndefined()
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBeUndefined()
	})

	test('handles missing owner in SimpleRepository object', () => {
		const repo = new ActionRepository({ name: 'repo' })
		expect(repo.owner).toBeUndefined()
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBeUndefined()
	})

	test('parses repository information from an API URL', () => {
		const repo = new ActionRepository().fromApiUrl('https://api.github.com/repos/owner/repo')
		expect(repo.owner).toBe('owner')
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBe('owner/repo')
	})

	test('handles invalid API URL gracefully', () => {
		const repo = new ActionRepository().fromApiUrl('https://api.github.com/repos/owner')
		expect(repo.owner).toBeUndefined()
		expect(repo.name).toBeUndefined()
		expect(repo.fullName).toBeUndefined()
	})
})
