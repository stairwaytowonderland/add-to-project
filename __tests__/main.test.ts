import * as core from '@actions/core'
import * as github from '@actions/github'
import {jest} from '@jest/globals'

import {
	addIssueToProject,
	addToProject,
	discoverItems,
	getExistingContentIds,
	getProjectNodeID,
	handleIssueOrPR,
	mustGetOwnerTypeQuery,
} from '../src/add-to-project.js'
import {SummaryMetrics, RepositoryInfo, ProjectRepository, OctokitClient} from '../src/types.js'

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
		github.context.repo.owner = ''
		jest.restoreAllMocks()
	})

	test('adds an issue from the same organization to the project', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				labels: [{name: 'bug'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
		)

		await addToProject()

		expect(outputs.items).toEqual('project-item-id')
	})

	test('adds an issue from a different organization to the project', async () => {
		github.context.payload = {
			issue: {
				number: 2221,
				labels: [{name: 'bug'}],
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
			},
		)

		await addToProject()

		expect(outputs.items).toEqual('project-item-id')
	})

	test('skips adding an issue when it already exists in the same project', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				labels: [{name: 'bug'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				return: () => Promise.reject(new Error('Content already exists in this project')),
			},
		)

		await addToProject()

		expect(outputs.items).toEqual('')
	})

	test('skips creating a draft issue when the issue already exists in the project', async () => {
		github.context.payload = {
			issue: {
				number: 2221,
				labels: [{name: 'bug'}],
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
				return: () => Promise.reject(new Error('Content already exists in this project')),
			},
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
				labels: [{name: 'bug'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
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
				labels: [{name: 'bug'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/pull/136',
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
			},
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
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				labels: [{name: 'bug'}, {name: 'new'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
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
				labels: [{name: 'bug'}, {name: 'other'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				labels: [{name: 'bug'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				labels: [{name: 'other'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
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
				labels: [{name: 'accessibility'}, {name: 'backend'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
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
				labels: [{name: 'data'}, {name: 'frontend'}, {name: 'improvement'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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

	test('handles spaces and extra commas gracefully in label filter input', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			labeled: 'accessibility  ,   backend    ,,  . ,     bug',
		})

		github.context.payload = {
			issue: {
				number: 1,
				labels: [{name: 'accessibility'}, {name: 'backend'}, {name: 'bug'}],
				'label-operator': 'AND',
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
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
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			'Invalid project URL: https://github.com/orgs/github/repositories. Project URL should match the format <GitHub server domain name>/<orgs-or-users>/<ownerName>/projects/<projectNumber>',
		)
		expect(core.info).not.toHaveBeenCalled()
		expect(gqlMock).not.toHaveBeenCalled()
	})

	test(`works with URLs that are not under the github.com domain`, async () => {
		github.context.payload = {
			issue: {
				number: 1,
				labels: [{name: 'bug'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://notgithub.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
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
				labels: [{name: 'bug'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
		)

		await addToProject()

		expect(gqlMock).toHaveBeenNthCalledWith(1, expect.stringContaining('organization(login: $projectOwnerName)'), {
			projectOwnerName: 'stairwaytowonderland',
			projectNumber: 1,
		})
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
				labels: [{name: 'bug'}],
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
			},
		)

		await addToProject()

		expect(gqlMock).toHaveBeenNthCalledWith(1, expect.stringContaining('user(login: $projectOwnerName)'), {
			projectOwnerName: 'monalisa',
			projectNumber: 1,
		})
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
				labels: [{name: 'foo'}, {name: 'BAR'}, {name: 'baz'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
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
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
							pageInfo: {hasNextPage: false, endCursor: null},
						},
					},
				},
			},
		)

		await addToProject()

		expect(gqlMock).toHaveBeenCalledTimes(2)
		expect(core.info).toHaveBeenCalledWith(
			'[Dry Run] Would process item: https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				// eslint-disable-next-line camelcase
				node_id: 'mock-node-id',
				labels: [],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
							nodes: [{content: {id: 'mock-node-id'}}],
							pageInfo: {hasNextPage: false, endCursor: null},
						},
					},
				},
			},
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith(
			'[Dry Run] Item already in project (would skip): https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith(
			'Searching for open items in the repository: stairwaytowonderland/add-to-project',
		)
		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false repo:stairwaytowonderland/add-to-project"',
		)
		expect(outputs.items).toEqual('project-item-id')
	})

	test('falls back to owner-scoped search when repo input has no repo name', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'stairwaytowonderland/',
		})

		github.context.repo.owner = 'stairwaytowonderland'

		// mockGraphQL()

		mockGraphQL({
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

		expect(core.info).toHaveBeenCalledWith('Searching for open items owned by: stairwaytowonderland')
		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false org:stairwaytowonderland"',
		)
	})

	test('falls back to user-scoped search when project owner type is users', async () => {
		mockGetInput({
			'project-url': 'https://github.com/users/monalisa/projects/1',
			'github-token': 'gh_token',
			repo: 'monalisa/',
		})

		github.context.repo.owner = 'monalisa'

		// mockGraphQL()

		mockGraphQL({
			test: /getProject/,
			return: {
				user: {
					projectV2: {
						id: 'project-id',
					},
				},
			},
		})

		await addToProject()

		expect(core.info).toHaveBeenCalledWith('Searching for open items owned by: monalisa')
		expect(core.info).toHaveBeenCalledWith('Executing global search query: "state:open archived:false user:monalisa"')
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
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith('Searching for open items in the repository: stairwaytowonderland/my-repo')
		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false repo:stairwaytowonderland/my-repo"',
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
			},
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith('Searching for open items in the repository: octokit/octokit.js')
		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false repo:octokit/octokit.js"',
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
				labels: [{name: 'bug'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				labels: [{name: 'bug'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				labels: [{name: 'other'}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
			},
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
			},
		)

		await addToProject()

		expect(outputs.items).toEqual('')
	})

	test('builds an AND label query in the search when repo and AND label-operator are provided', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'stairwaytowonderland/add-to-project',
			labeled: 'bug, feature',
			'label-operator': 'AND',
		})

		// mockGraphQL()

		mockGraphQL({
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

		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false repo:stairwaytowonderland/add-to-project label:"bug" label:"feature""',
		)
	})

	test('builds a NOT label query in the search when repo and NOT label-operator are provided', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'stairwaytowonderland/add-to-project',
			labeled: 'bug, feature',
			'label-operator': 'NOT',
		})

		// mockGraphQL()

		mockGraphQL({
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

		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false repo:stairwaytowonderland/add-to-project -label:"bug" -label:"feature""',
		)
	})

	test('builds an OR label query in the search when repo and labeled are provided with no operator', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'stairwaytowonderland/add-to-project',
			labeled: 'bug, feature',
		})

		// mockGraphQL()

		mockGraphQL({
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

		expect(core.info).toHaveBeenCalledWith(
			'Executing global search query: "state:open archived:false repo:stairwaytowonderland/add-to-project label:"bug","feature""',
		)
	})

	test('ignores project item nodes without a content id when building the duplicate-detection set', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				// eslint-disable-next-line camelcase
				node_id: 'mock-node-id',
				labels: [],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				test: /getProjectItems/,
				return: {
					node: {
						items: {
							// first node has no id (exercises the false branch of `if (node.content?.id)`)
							nodes: [{content: {}}, {content: {id: 'mock-node-id'}}],
							pageInfo: {hasNextPage: false, endCursor: null},
						},
					},
				},
			},
		)

		await addToProject()

		expect(core.info).toHaveBeenCalledWith(
			'Item already in project (skipping): https://github.com/stairwaytowonderland/add-to-project/issues/1',
		)
		expect(outputs.items).toEqual('')
	})

	test('paginates through multiple pages of existing project items', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				// eslint-disable-next-line camelcase
				node_id: 'item-node-id',
				labels: [],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		let itemsCallCount = 0
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
				test: /getProjectItems/,
				return: () => {
					itemsCallCount++
					if (itemsCallCount === 1) {
						return {
							node: {
								items: {
									nodes: [{content: {id: 'other-id'}}],
									pageInfo: {hasNextPage: true, endCursor: 'cursor-1'},
								},
							},
						}
					}
					return {
						node: {
							items: {
								nodes: [],
								pageInfo: {hasNextPage: false, endCursor: null},
							},
						},
					}
				},
			},
			{
				test: /addProjectV2ItemById/,
				return: {
					addProjectV2ItemById: {
						item: {
							id: 'new-item-id',
						},
					},
				},
			},
		)

		await addToProject()

		expect(itemsCallCount).toBe(2)
		expect(outputs.items).toEqual('new-item-id')
	})

	test('handles payload issue missing both labels and html_url properties', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				// eslint-disable-next-line camelcase
				node_id: 'some-node-id',
				title: 'Test Issue',
				// eslint-disable-next-line camelcase
				created_at: new Date().toISOString(),
				// no labels property → exercises (issue?.labels ?? []) null branch
				// no html_url → exercises (issue?.html_url ?? '') null branch
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
							id: 'new-item-id',
						},
					},
				},
			},
		)

		await addToProject()

		expect(outputs.items).toEqual('new-item-id')
	})

	test('warns and returns early when no issue or PR is found in the event payload', async () => {
		github.context.payload = {}

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

		expect(core.warning).toHaveBeenCalledWith(
			'No issue or pull request found in the GitHub Actions context payload. Skipping processing.',
		)
		expect(gqlMock).toHaveBeenCalledTimes(2)
	})

	test('records a failure for a same-org item when the mutation rejects with a non-Error value', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				labels: [],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
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
				return: () => Promise.reject('non-Error same-org failure'),
			},
		)

		await addToProject()

		expect(outputs.items).toEqual('')
	})

	test('records a failure for a cross-org item when the draft issue mutation rejects with an Error', async () => {
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
				return: () => Promise.reject(new Error('Draft issue creation failed')),
			},
		)

		await addToProject()

		expect(outputs.items).toEqual('')
	})

	test('handles repository_url without a /repos/ separator in the isInputRepo path', async () => {
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
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		const graphqlMock = jest.fn().mockImplementation((q: unknown) => {
			const query = q as string
			if (/getProjectItems/.test(query)) {
				return {
					node: {
						items: {
							nodes: [],
							pageInfo: {hasNextPage: false, endCursor: null},
						},
					},
				}
			}
			if (/getProject/.test(query)) {
				return {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				}
			}
			throw new Error(`Unexpected GraphQL query: ${query}`)
		})

		;(github.getOctokit as jest.Mock).mockImplementation(() => ({
			graphql: graphqlMock,
			paginate: async () => [
				{
					// eslint-disable-next-line camelcase
					node_id: 'node-id',
					number: 1,
					// eslint-disable-next-line camelcase
					html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
					title: 'test',
					labels: [],
					// no '/repos/' in URL exercises the `split('/repos/')[1] ?? ''` null branch
					// eslint-disable-next-line camelcase
					repository_url: 'https://api.github.com/no-repos-separator',
					// eslint-disable-next-line camelcase
					created_at: new Date().toISOString(),
				},
			],
			rest: {search: {issuesAndPullRequests: jest.fn()}},
		}))

		await addToProject()

		expect(outputs.items).toEqual('')
	})

	test('isInputRepo outer catch records a failure when handleIssueOrPR throws an Error', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'stairwaytowonderland/add-to-project',
		})

		github.context.payload = {
			issue: {
				number: 1,
				// malformed label (no name) causes TypeError in handleIssueOrPR before any try-catch
				labels: [{}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL({
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

		expect(core.error).toHaveBeenCalled()
		expect(outputs.items).toEqual('')
	})

	test('isInputRepo outer catch uses String() when handleIssueOrPR rejects with a non-Error value', async () => {
		mockGetInput({
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'stairwaytowonderland/add-to-project',
		})

		const graphqlMock = jest.fn().mockImplementation((q: unknown) => {
			const query = q as string
			if (/getProjectItems/.test(query)) {
				return {
					node: {
						items: {
							nodes: [],
							pageInfo: {hasNextPage: false, endCursor: null},
						},
					},
				}
			}
			if (/getProject/.test(query)) {
				return {
					organization: {
						projectV2: {
							id: 'project-id',
						},
					},
				}
			}
			throw new Error(`Unexpected GraphQL query: ${query}`)
		})

		// Accessing .labels on this item throws a non-Error string, exercising the
		// `error instanceof Error ? ... : String(error)` false branch in the outer catch
		const malformedItem: Record<string, unknown> = {
			// eslint-disable-next-line camelcase
			node_id: 'node-id',
			number: 1,
			// eslint-disable-next-line camelcase
			html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			title: 'test',
			// eslint-disable-next-line camelcase
			repository_url: 'https://api.github.com/repos/stairwaytowonderland/add-to-project',
			// eslint-disable-next-line camelcase
			created_at: new Date().toISOString(),
		}
		Object.defineProperty(malformedItem, 'labels', {
			get: () => {
				throw 'non-Error isInputRepo rejection'
			},
		})
		;(github.getOctokit as jest.Mock).mockImplementation(() => ({
			graphql: graphqlMock,
			paginate: async () => [malformedItem],
			rest: {search: {issuesAndPullRequests: jest.fn()}},
		}))

		await addToProject()

		expect(core.error).toHaveBeenCalledWith(expect.stringContaining('non-Error isInputRepo rejection'))
		expect(outputs.items).toEqual('')
	})

	test('non-inputRepo outer catch records a failure when handleIssueOrPR throws an Error', async () => {
		github.context.payload = {
			issue: {
				number: 1,
				// malformed label causes TypeError before any try-catch in handleIssueOrPR
				labels: [{}],
				// eslint-disable-next-line camelcase
				html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			},
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL({
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

		expect(core.error).toHaveBeenCalled()
		expect(outputs.items).toEqual('')
	})

	test('non-inputRepo outer catch falls back to unknown-url and unknown-repo when fields are absent', async () => {
		// issue has no html_url and payload has no repository: exercises the ?? fallbacks
		// inside the outer catch (lines 377-378 false branches)
		const malformedPayloadIssue = {
			number: 1,
			labels: [{}], // triggers TypeError before any try-catch in handleIssueOrPR
			// no html_url
			// no created_at
		}

		github.context.payload = {
			issue: malformedPayloadIssue,
			// no repository → exercises repository?.owner.login ?? '' and repository?.name ?? 'unknown-repo'
		}

		mockGraphQL({
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

		expect(core.error).toHaveBeenCalled()
		expect(outputs.items).toEqual('')
	})

	test('non-inputRepo outer catch uses String() when handleIssueOrPR rejects with a non-Error value', async () => {
		// Accessing .labels on this issue throws a non-Error string, exercising the
		// `error instanceof Error ? ... : String(error)` false branch in the outer catch
		const malformedIssue = {
			number: 1,
			// eslint-disable-next-line camelcase
			html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
			title: 'test',
		} as Record<string, unknown>
		Object.defineProperty(malformedIssue, 'labels', {
			get: () => {
				throw 'non-Error non-inputRepo rejection'
			},
		})

		github.context.payload = {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			issue: malformedIssue as any,
			repository: {
				name: 'add-to-project',
				owner: {
					login: 'stairwaytowonderland',
				},
			},
		}

		mockGraphQL({
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

		expect(core.error).toHaveBeenCalledWith(expect.stringContaining('non-Error non-inputRepo rejection'))
		expect(outputs.items).toEqual('')
	})
})

test('discoverItems normalizes repo inputs with an explicit owner and repo name', async () => {
	const action = {
		dryRun: false,
		labeled: [],
		labelOperator: 'or' as const,
		project: {
			url: 'https://github.com/stairwaytowonderland/add-to-project/projects/1',
			ownerName: 'stairwaytowonderland',
			number: 1,
			ownerType: 'orgs' as const,
			ownerTypeQuery: 'organization' as const,
		},
	}
	const repo = new RepositoryInfo('octokit/octokit.js') as ProjectRepository

	const octokit = toOctokit()
	const result = await discoverItems(octokit, action, repo)

	expect(result.query).toBe('state:open archived:false repo:octokit/octokit.js')
	expect(repo).toMatchObject({owner: 'octokit', name: 'octokit.js'})
})

test('discoverItems treats an owner-only repo input as owner-scoped search', async () => {
	const action = {
		dryRun: false,
		labeled: [],
		labelOperator: 'or' as const,
		project: {
			url: 'https://github.com/stairwaytowonderland/add-to-project/projects/1',
			ownerName: 'stairwaytowonderland',
			number: 1,
			ownerType: 'orgs' as const,
			ownerTypeQuery: 'organization' as const,
		},
	}
	github.context.repo.owner = 'stairwaytowonderland'
	const repo = new RepositoryInfo('stairwaytowonderland/') as ProjectRepository

	;(github.getOctokit as jest.Mock).mockImplementation(() => ({
		paginate: async () => [],
		rest: {search: {issuesAndPullRequests: jest.fn()}},
	}))
	const result = await discoverItems(toOctokit(), action, repo)

	expect(result.query).toBe('state:open archived:false org:stairwaytowonderland')
	expect(repo).toMatchObject({owner: 'stairwaytowonderland'})
})

test('handleIssueOrPR mutates the shared metrics object and tracks added items', async () => {
	const action = {
		dryRun: false,
		labeled: ['bug'],
		labelOperator: 'or' as const,
		project: {
			url: 'https://github.com/stairwaytowonderland/add-to-project/projects/1',
			ownerName: 'stairwaytowonderland',
			number: 1,
			ownerType: 'orgs' as const,
			ownerTypeQuery: 'organization' as const,
		},
	}
	const tracker = new SummaryMetrics()
	const contentItems = {
		existingContentIds: new Set<string>(),
		processedItemIds: [],
	}
	const issue = {
		node_id: 'issue-id',
		number: 1,
		title: 'Example issue',
		html_url: 'https://github.com/stairwaytowonderland/add-to-project/issues/1',
		repository_url: 'https://api.github.com/repos/stairwaytowonderland/add-to-project',
		labels: [{name: 'bug'}],
		created_at: new Date('2023-01-01T00:00:00Z').toISOString(),
	}

	mockGraphQL({
		test: /addProjectV2ItemById/,
		return: {
			addProjectV2ItemById: {
				item: {id: 'project-item-id'},
			},
		},
	})

	await handleIssueOrPR(
		toOctokit(),
		action,
		new RepositoryInfo('add-to-project', 'stairwaytowonderland') as ProjectRepository,
		contentItems,
		tracker,
		issue as never,
	)

	expect(tracker.data.added).toHaveLength(1)
	expect(contentItems.processedItemIds).toEqual(['project-item-id'])
})

test('addIssueToProject creates a draft issue when the repo owner differs from the project owner', async () => {
	const action = {
		dryRun: false,
		labeled: [],
		labelOperator: 'or' as const,
		project: {
			url: 'https://github.com/stairwaytowonderland/add-to-project/projects/1',
			ownerName: 'stairwaytowonderland',
			number: 1,
			ownerType: 'orgs' as const,
			ownerTypeQuery: 'organization' as const,
		},
	}
	const tracker = new SummaryMetrics()
	const contentItems = {
		existingContentIds: new Set<string>(),
		processedItemIds: [],
	}

	mockGraphQL({
		test: /addProjectV2DraftIssue/,
		return: {
			addProjectV2DraftIssue: {
				projectItem: {id: 'draft-item-id'},
			},
		},
	})

	await addIssueToProject(
		toOctokit(),
		action,
		new RepositoryInfo('octokit.js', 'octokit') as ProjectRepository,
		{
			title: 'Example issue',
			url: 'https://github.com/octokit/octokit.js/issues/1',
		},
		contentItems,
		tracker,
		'content-id',
	)

	expect(tracker.data.added).toHaveLength(1)
	expect(contentItems.processedItemIds).toEqual(['draft-item-id'])
})

describe('getProjectNodeID', () => {
	test('returns undefined when the project lookup does not include a project id', async () => {
		const octokit = {
			graphql: (jest.fn() as any).mockResolvedValue({
				organization: {projectV2: {id: undefined}},
			}),
		} as any

		await expect(getProjectNodeID(octokit, 'organization', 'stairwaytowonderland', 1)).resolves.toBeUndefined()
	})
})

describe('getExistingContentIds', () => {
	test('returns an empty set when projectId is undefined', async () => {
		const octokit = {
			graphql: (jest.fn() as any).mockResolvedValue({
				node: {
					items: {
						nodes: [],
						pageInfo: {hasNextPage: false, endCursor: null},
					},
				},
			}),
		} as any

		await expect(getExistingContentIds(octokit, undefined)).resolves.toEqual(new Set<string>())
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
		}).toThrow(`Unsupported ownerType: unknown. Must be one of 'orgs' or 'users'`)
	})
})

function toOctokit(): OctokitClient {
	return (github.getOctokit as jest.Mock)() as OctokitClient
}

function mockGetInput(mocks: Record<string, string>): void {
	;(core.getInput as jest.Mock).mockImplementation((key: unknown) => mocks[key as string] ?? '')
}

function mockSetOutput(): Record<string, string> {
	const output: Record<string, string> = {}
	;(core.setOutput as jest.Mock).mockImplementation(
		(key: unknown, value: unknown) => (output[key as string] = value as string),
	)
	return output
}

function mockGraphQL(...mocks: {test: RegExp; return: unknown}[]): jest.Mock {
	const mock = jest.fn().mockImplementation((query: unknown) => {
		const q = query as string

		// handle getProjectItems first: /getProject/ in other mocks would otherwise match it as a substring
		if (/getProjectItems/.test(q)) {
			const explicit = mocks.find(m => /getProjectItems/.test(m.test.source))
			if (explicit) {
				const ret = explicit.return as unknown
				return typeof ret === 'function' ? (ret as () => void)() : ret
			}
			return {
				node: {
					items: {
						nodes: [],
						pageInfo: {hasNextPage: false, endCursor: null},
					},
				},
			}
		}

		const match = mocks.find(m => m.test.test(q))

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
