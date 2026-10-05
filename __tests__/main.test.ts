/// <reference types="node" />
/// <reference types="jest" />

/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */

// Import mocked core and GitHub modules from fixtures
import * as core from '../__fixtures__/core.js'
import * as github from '../__fixtures__/github.js'

// Import the action mocks from fixtures
import { actionMock, actionRunMock } from '../__fixtures__/action.js'

// Import utility functions for mocking inputs and capturing outputs during tests
import { mockGetInput } from '../__utils__/mocks.js'

// Import Jest testing utilities
import { jest } from '@jest/globals'

/*
 * Mocks should be declared before the module being tested is imported.
 *
 * This ensures that the main module uses the mocked versions of its dependencies.
 */

// Mock the core and GitHub modules before importing the main module.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => github)

// Mock the Action class from the action module to control its behavior during tests
jest.unstable_mockModule('../src/config.js', actionRunMock)

// Import the modules being tested after mocks are set up
const { default: run } = await import('../src/main.js')

describe('Main Entry', () => {
	let exitSpy: jest.SpiedFunction<typeof process.exit>
	let inputs: Record<string, string>

	beforeEach(() => {
		// Clear any previous mocks to ensure a clean state for each test.
		jest.clearAllMocks()

		// Mock the process.stdout.write method to prevent actual console output during tests.
		jest.spyOn(process.stdout, 'write').mockImplementation(() => true)

		// Intercept process.exit so it doesn't physically crash the Jest runner process
		exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never)
	})

	beforeEach(() => {
		// Reset the GitHub context before each test
		github.context.payload = {}
		github.context.repo = { owner: 'stairwaytowonderland', repo: 'add-to-project' }
		github.context.actor = 'stairwaytowonderland'

		inputs = {
			'project-url': 'https://github.com/orgs/stairwaytowonderland/projects/1',
			'github-token': 'gh_token',
			repo: 'add-to-project',
			owner: '',
			labeled: 'bug',
			'label-operator': 'and',
			'dry-run': 'false',
		}
	})

	beforeEach(() => {
		mockGetInput(inputs)
		actionMock.mockImplementation(() => Promise.resolve())
	})

	afterEach(() => {
		exitSpy.mockRestore()
		jest.restoreAllMocks()
	})

	test('handles a successful execution flow cleanly', async () => {
		// Force the mock to instantly resolve
		actionMock.mockImplementation(() => Promise.resolve())

		await run()

		expect(exitSpy).toHaveBeenCalledWith(0)
	})

	test('handles a rejection catch block flow cleanly', async () => {
		const error = new Error('Mocked Failure')

		// Force the mock to throw an expected exception
		actionMock.mockImplementation(() => Promise.reject(error))

		await run()

		expect(core.setFailed).toHaveBeenCalledWith(error.message)
		expect(exitSpy).toHaveBeenCalledWith(1)
	})

	// Unlikely scenario: the rejection is not an instance of Error
	// This test satisfies missing coverage for non-Error rejections
	test('handles a rejection catch block flow with a non-Error rejection', async () => {
		const error = { message: 'Mocked Failure' }

		// Force the mock to throw an expected exception
		actionMock.mockImplementation(() => Promise.reject(error))

		await run()

		expect(exitSpy).toHaveBeenCalledWith(1)
	})
})
