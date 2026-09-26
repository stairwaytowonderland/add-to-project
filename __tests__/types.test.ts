import { RepositoryInfo, SummaryMetrics, ItemInfo, MetricsTracking, FailedItemInfo } from '../src/types.js'

describe('RepositoryInfo', () => {
	test('parses repository information from a string', () => {
		const repo = new RepositoryInfo('owner/repo')
		expect(repo.owner).toBe('owner')
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBe('owner/repo')
	})

	test('parses repository information from a SimpleRepository object', () => {
		const repo = new RepositoryInfo({ owner: 'owner', name: 'repo' })
		expect(repo.owner).toBe('owner')
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBe('owner/repo')
	})

	test('handles missing owner in string', () => {
		const repo = new RepositoryInfo('repo')
		expect(repo.owner).toBeUndefined()
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBeUndefined()
	})

	test('handles missing owner in SimpleRepository object', () => {
		const repo = new RepositoryInfo({ name: 'repo' })
		expect(repo.owner).toBeUndefined()
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBeUndefined()
	})

	test('parses repository information from an API URL', () => {
		const repo = new RepositoryInfo().fromApiUrl('https://api.github.com/repos/owner/repo')
		expect(repo.owner).toBe('owner')
		expect(repo.name).toBe('repo')
		expect(repo.fullName).toBe('owner/repo')
	})

	test('handles invalid API URL gracefully', () => {
		const repo = new RepositoryInfo().fromApiUrl('https://api.github.com/repos/owner')
		expect(repo.owner).toBeUndefined()
		expect(repo.name).toBeUndefined()
		expect(repo.fullName).toBeUndefined()
	})
})

describe('SummaryMetrics', () => {
	test('handles adding new ItemInfo correctly', () => {
		const metrics = new SummaryMetrics()
		// title, repo, url, created
		const item: ItemInfo = {
			title: 'Test Item',
			repo: 'owner/repo',
			url: 'http://example.com',
			created: new Date(),
		}
		metrics.add(item)
		expect(metrics.data.added).toContain(item)
	})
	test('handles adding skipped ItemInfo correctly', () => {
		const metrics = new SummaryMetrics()
		// title, repo, url, created
		const item: ItemInfo = {
			title: 'Test Item',
			repo: 'owner/repo',
			url: 'http://example.com',
			created: new Date(),
		}
		metrics.skip(item)
		expect(metrics.data.skipped).toContain(item)
	})
	test('handles adding failed ItemInfo correctly', () => {
		const metrics = new SummaryMetrics()
		// title, repo, url, created
		const item: FailedItemInfo = {
			title: 'Test Item',
			repo: 'owner/repo',
			url: 'http://example.com',
			created: new Date(),
			reason: new Error('Test error').message,
		}
		metrics.fail(item)
		expect(metrics.data.failed).toContain(item)
	})
})
