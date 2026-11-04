import * as github from '../__fixtures__/github.js'
import * as core from '../__fixtures__/core.js'
import { jest } from '@jest/globals'
import type { OctokitClient } from '../src/types.js'

/**
 * Jest mock function for testing purposes.
 *
 * This mock can be used in tests to simulate asynchronous behavior without executing the actual implementation.
 *
 * @example
 * // As a mock for asynchronous functions:
 * const exampleMock = createAsyncMock()
 * exampleMock().then(() => {
 *   // test logic here
 * })
 *
 * @example
 * // As a mock for the Action class:
 * const exampleMock = createAsyncMock()
 * mockFnModule = () => ({
 *   Action: class {
 *     async run(): Promise<void> {
 *       return exampleMock()
 *     }
 *   }
 * })
 */
export const createAsyncMock = () => jest.fn<() => Promise<void>>()

/**
 * Mock for the GitHub Octokit client, used to simulate GitHub API interactions during tests.
 *
 * @returns A mocked Octokit client instance.
 */
export function toOctokit(): OctokitClient {
	return (github.getOctokit as jest.Mock)() as OctokitClient
}

/**
 * Mock for the core.getInput function, used to simulate input values during tests.
 *
 * @param mocks - A record of input keys and their corresponding mock values.
 * @returns void, as this function only sets up the mock implementation.
 */
export function mockGetInput(mocks: Record<string, string>): void {
	;(core.getInput as jest.Mock).mockImplementation((key: unknown) => mocks[key as string] ?? '')
}

/**
 * Mock for the core.getBooleanInput function, used to simulate boolean input values during tests.
 *
 * @param mocks - A record of input keys and their corresponding mock boolean values.
 * @returns void, as this function only sets up the mock implementation.
 */
export function mockGetBooleanInput(mocks: Record<string, boolean>): void {
	;(core.getBooleanInput as jest.Mock).mockImplementation((key: unknown) => mocks[key as string] ?? false)
}

/**
 * Mock for the core.setOutput function, used to capture output values during tests.
 *
 * @returns A record of output keys and their corresponding captured values.
 */
export function mockSetOutput(): Record<string, string> {
	const output: Record<string, string> = {}
	;(core.setOutput as jest.Mock).mockImplementation(
		(key: unknown, value: unknown) => (output[key as string] = value as string)
	)
	return output
}
