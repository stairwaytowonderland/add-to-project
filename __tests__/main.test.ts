import * as core from '@actions/core'
import * as github from '@actions/github'
import { jest } from '@jest/globals'

import { addToProject, mustGetOwnerTypeQuery } from '../src/add-to-project.js'

describe('addToProject', () => {
	let outputs: Record<string, string>

	beforeEach(() => {
		jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
	})

	beforeEach(() => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
		})

		outputs = mockSetOutput()
	})

	afterEach(() => {
		github.context.payload = {}
		jest.restoreAllMocks()
	})

	test('adds an issue from the same organization to the project', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('project-item-id')
	})

	test('adds an issue from a different organization to the project', async () => {
		github.context.payload = {
			issue: {
				number: 2221,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/octokit/octokit.js/issues/2221',
			},
			repository: {
				name: 'octokit.js',
				owner: {
					login: 'octokit',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2DraftIssue/,
				return: {
					addProjectV2DraftIssue: {
						projectItem: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('project-item-id')
	})

	test('skips adding an issue when it already exists in the same project', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: () =>
					Promise.reject(new Error('Content already exists in this project')),
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('')
	})

	test('skips creating a draft issue when the issue already exists in the project', async () => {
		github.context.payload = {
			issue: {
				number: 2221,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/octokit/octokit.js/issues/2221',
			},
			repository: {
				name: 'octokit.js',
				owner: {
					login: 'octokit',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2DraftIssue/,
				return: () =>
					Promise.reject(new Error('Content already exists in this project')),
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('')
	})

	test('adds matching issues with a label filter without label-operator', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug, new',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('project-item-id')
	})

	test('adds matching pull-requests with a label filter without label-operator', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug, new',
		})

		github.context.payload = {
			// eslint-disable-next-line camelcase
			pull_request: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/pull/136',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('project-item-id')
	})

	test('does not add un-matching issues with a label filter without label-operator', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL()
		await addToProject()
		expect(gqlMock).not.toHaveBeenCalled()
	})

	test('adds matching issues with labels filter with AND label-operator', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug, new',
			'label-operator': 'AND',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }, { name: 'new' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('project-item-id')
	})

	test('does not add un-matching issues with labels filter with AND label-operator', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug, new',
			'label-operator': 'AND',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }, { name: 'other' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL()
		await addToProject()
		expect(gqlMock).not.toHaveBeenCalled()
	})

	test('does not add matching issues with labels filter with NOT label-operator', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug, new',
			'label-operator': 'NOT',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL()
		await addToProject()
		expect(gqlMock).not.toHaveBeenCalled()
	})

	test('adds issues that do not have labels present in the label list with NOT label-operator', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug, new',
			'label-operator': 'NOT',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'other' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-next-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-next-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('project-next-item-id')
	})

	test('adds matching issues with multiple label filters', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'accessibility,backend,bug',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'accessibility' }, { name: 'backend' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(gqlMock).toHaveBeenCalled()
		expect(outputs.items).toEqual('project-item-id')
	})

	test('does not add un-matching issues with multiple label filters', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'accessibility, backend, bug',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [
					{ name: 'data' },
					{ name: 'frontend' },
					{ name: 'improvement' },
				],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL()
		await addToProject()
		expect(gqlMock).not.toHaveBeenCalled()
	})

	test('handles spaces and extra commas gracefully in label filter input', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'accessibility  ,   backend    ,,  . ,     bug',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [
					{ name: 'accessibility' },
					{ name: 'backend' },
					{ name: 'bug' },
				],
				'label-operator': 'AND',
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(gqlMock).toHaveBeenCalled()
		expect(outputs.items).toEqual('project-item-id')
	})

	test(`throws an error when url isn't a valid project url`, async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/github/repositories',
			'github-token': 'gh_token',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL()
		await expect(addToProject()).rejects.toThrow(
			'Invalid project URL: https://github.com/orgs/github/repositories. Project URL should match the format <GitHub server domain name>/<orgs-or-users>/<ownerName>/projects/<projectNumber>'
		)
		expect(core.info).not.toHaveBeenCalled()
		expect(gqlMock).not.toHaveBeenCalled()
	})

	test(`works with URLs that are not under the github.com domain`, async () => {
		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://notgithub.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('project-item-id')
	})

	test('constructs the correct graphQL query given an organization owner', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug, new',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(gqlMock).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining('organization(login: $projectOwnerName)'),
			{
				projectOwnerName: 'stairwaytowonderland',
				projectNumber: 1,
			}
		)
	})

	test('constructs the correct graphQL query given a user owner', async () => {
		mockGetInput({
			'project-url': 'https://github.com/users/monalisa/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug, new',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/monalisa/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'monalisa',
				},
			},
		}

		const gqlMock = mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(gqlMock).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining('user(login: $projectOwnerName)'),
			{
				projectOwnerName: 'monalisa',
				projectNumber: 1,
			}
		)
	})

	test('compares labels case-insensitively', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'FOO, Bar, baz',
			'label-operator': 'AND',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'foo' }, { name: 'BAR' }, { name: 'baz' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-next-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-next-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('project-next-item-id')
	})

	test('does not call mutations and emits a dry-run log when dry-run is true', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			'dry-run': 'true',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL(
			{
				test: /getProject\b/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /getProjectItems/,
				return: {
					node: {
						items: {
							nodes: [],
							pageInfo: { hasNextPage: false, endCursor: null },
						},
					},
				},
			}
		)

		await addToProject()

		expect(gqlMock).toHaveBeenCalledTimes(2)
		expect(core.info).toHaveBeenCalledWith(
			'[Dry Run] Would process item: https://github.com/stairwaytowonderland/add-to-project/issues/1'
		)
		expect(outputs.items).toEqual('')
	})

	test('dry-run marks items already in the project as skipped', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			'dry-run': 'true',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject\b/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /getProjectItems/,
				return: {
					node: {
						items: {
							nodes: [{ content: { id: 'mock-node-id' } }],
							pageInfo: { hasNextPage: false, endCursor: null },
						},
					},
				},
			}
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith(
			'[Dry Run] Item already in project (would skip): https://github.com/stairwaytowonderland/add-to-project/issues/1'
		)
		expect(outputs.items).toEqual('')
	})

	test('uses the repo input to scope the search query', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'stairwaytowonderland/add-to-project',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith(
			'Searching for open items in the repository: stairwaytowonderland/add-to-project'
		)
		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false repo:stairwaytowonderland/add-to-project"'
		)
		expect(outputs.items).toEqual('project-item-id')
	})

	test('falls back to owner-scoped search when repo input is empty', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: '',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith(
			'Searching for open items owned by: stairwaytowonderland'
		)
		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false org:stairwaytowonderland"'
		)
		expect(outputs.items).toEqual('project-item-id')
	})

	test('falls back to user-scoped search when project owner type is users', async () => {
		mockGetInput({
			'project-url': 'https://github.com/users/monalisa/projects/1',
			'github-token': 'gh_token',
			repo: '',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/monalisa/my-project/issues/1',
			},
			repository: {
				name: 'my-project',
				owner: {
					login: 'monalisa',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					user: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith(
			'Searching for open items owned by: monalisa'
		)
		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false user:monalisa"'
		)
		expect(outputs.items).toEqual('project-item-id')
	})

	test('uses a name-only repo input (no owner prefix) to scope the search query', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'my-repo', // owner is implicitly derived from projectOwnerName
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith(
			'Searching for open items in the repository: stairwaytowonderland/my-repo'
		)
		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false repo:stairwaytowonderland/my-repo"'
		)
		expect(outputs.items).toEqual('project-item-id')
	})

	test('searches a cross-org repo when the repo input owner differs from the project owner', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'octokit/octokit.js',
		})

		github.context.payload = {
			issue: {
				number: 2221,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/octokit/octokit.js/issues/2221',
			},
			repository: {
				name: 'octokit.js',
				owner: {
					login: 'octokit',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2DraftIssue/,
				return: {
					addProjectV2DraftIssue: {
						projectItem: {
							id: 'project-item-id',
						},
					},
				},
			}
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith(
			'Searching for open items in the repository: octokit/octokit.js'
		)
		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false repo:octokit/octokit.js"'
		)
		expect(outputs.items).toEqual('project-item-id')
	})

	test('locally skips AND-labelled items when not all required labels are present', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug, new',
			'label-operator': 'AND',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		// one mock so paginate returns the item; no mutation mock since the item is skipped locally
		const gqlMock = mockGraphQL({
			test: /getProject/,
			return: {
				organization: {
					projectV2: {
						id: 'project-id',
					},
				},
			},
		})

		await addToProject()

		expect(gqlMock).toHaveBeenCalledTimes(2)
		expect(outputs.items).toEqual('')
	})

	test('locally skips NOT-labelled items when a forbidden label is present', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug',
			'label-operator': 'NOT',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'bug' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL({
			test: /getProject/,
			return: {
				organization: {
					projectV2: {
						id: 'project-id',
					},
				},
			},
		})

		await addToProject()

		expect(gqlMock).toHaveBeenCalledTimes(2)
		expect(outputs.items).toEqual('')
	})

	test('locally skips OR-labelled items when no required label matches', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'bug',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{ name: 'other' }],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const gqlMock = mockGraphQL({
			test: /getProject/,
			return: {
				organization: {
					projectV2: {
						id: 'project-id',
					},
				},
			},
		})

		await addToProject()

		expect(gqlMock).toHaveBeenCalledTimes(2)
		expect(outputs.items).toEqual('')
	})

	test('records a failure for a same-org item when the mutation throws an unrecognised error', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url:
					'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: () => Promise.reject(new Error('Permission denied')),
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('')
	})

	test('records a failure for a different-org item when the mutation rejects with a non-Error', async () => {
		github.context.payload = {
			issue: {
				number: 2221,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/octokit/octokit.js/issues/2221',
			},
			repository: {
				name: 'octokit.js',
				owner: {
					login: 'octokit',
				},
			},
		}

		mockGraphQL(
			{
				test: /getProject/,
				return: {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				},
			},
			{
				test: /addProjectV2DraftIssue/,
				// non-Error rejection exercises the `return false` branch of isAlreadyInProjectError
				return: () => Promise.reject('non-Error failure'),
			}
		)

		await addToProject()

		expect(outputs.items).toEqual('')
	})
})

describe('mustGetOwnerTypeQuery', () => {
	test('returns organization for orgs ownerType', async () => {
		const ownerTypeQuery = mustGetOwnerTypeQuery('orgs')

		expect(ownerTypeQuery).toEqual('organization')
	})

	test('returns user for users ownerType', async () => {
		const ownerTypeQuery = mustGetOwnerTypeQuery('users')

		expect(ownerTypeQuery).toEqual('user')
	})

	test('throws an error when an unsupported ownerType is set', async () => {
		expect(() => {
			mustGetOwnerTypeQuery('unknown')
		}).toThrow(
			`Unsupported ownerType: unknown. Must be one of 'orgs' or 'users'`
		)
	})
})

function mockGetInput(mocks: Record<string, string>): void {
	;(core.getInput as jest.Mock).mockImplementation(
		(key: unknown) => mocks[key as string] ?? ''
	)
}

function mockSetOutput(): Record<string, string> {
	const output: Record<string, string> = {}
	;(core.setOutput as jest.Mock).mockImplementation(
		(key: unknown, value: unknown) => (output[key as string] = value as string)
	)
	return output
}

function mockGraphQL(...mocks: { test: RegExp; return: unknown }[]): jest.Mock {
	const mock = jest.fn().mockImplementation((query: unknown) => {
		const q = query as string

		// handle getProjectItems first: /getProject/ in other mocks would otherwise match it as a substring
		if (/getProjectItems/.test(q)) {
			const explicit = mocks.find((m) => /getProjectItems/.test(m.test.source))
			if (explicit) {
				const ret = explicit.return as unknown
				return typeof ret === 'function' ? (ret as () => void)() : ret
			}
			return {
				node: {
					items: {
						nodes: [],
						pageInfo: { hasNextPage: false, endCursor: null },
					},
				},
			}
		}

		const match = mocks.find((m) => m.test.test(q))

		if (match) {
			const ret = match.return as unknown
			if (typeof ret === 'function') {
				// call factory to produce the return value (allows lazy rejection)
				return (ret as () => void)()
			}

			return ret
		}

		throw new Error(`Unexpected GraphQL query: ${q}`)
	})

	const paginateMock = jest.fn().mockImplementation(async () => {
		if (mocks.length === 0) return []
		const payload = github.context.payload
		const item = payload.issue ?? payload.pull_request
		if (!item) return []
		return [
			{
				node_id: 'mock-node-id',
				number: item.number,
				html_url: item.html_url,
				title: item.html_url,
				labels: item.labels ?? [],
				// eslint-disable-next-line camelcase
				repository_url: `https://api.github.com/repos/${payload.repository?.owner?.login}/${payload.repository?.name}`,
			},
		]
	})

	;(github.getOctokit as jest.Mock).mockImplementation(() => {
		return {
			graphql: mock,
			paginate: paginateMock,
			rest: {
				search: {
					issuesAndPullRequests: jest.fn(),
				},
			},
		} as unknown as ReturnType<typeof github.getOctokit>
	})

	return mock
}
