import { SummaryMetrics, ItemInfo, FailedItemInfo } from '../src/types.js'

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
