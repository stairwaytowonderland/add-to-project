import { createAsyncMock } from '../__utils__/mocks.js'

/**
 * Mock for the asynchronous action function, used to simulate its behavior during tests.
 */
export const actionMock = createAsyncMock()

/**
 * Mock for the configuration module, used to replace the actual Action class with a controlled mock during tests.
 *
 * Simulates a default export of the Action class.
 *
 * @returns An object containing the mocked Action class.
 */
export const actionRunMockDefault = () => ({
	default: class Action {
		async run(): Promise<void> {
			return actionMock()
		}
	},
})

/**
 * Mock for the configuration module, used to replace the actual Action class with a controlled mock during tests.
 *
 * Simulates a named export of the Action class.
 *
 * @returns An object containing the mocked Action class.
 */
export const actionRunMockNamed = () => ({
	Action: class {
		async run(): Promise<void> {
			return actionMock()
		}
	},
})

/**
 * Default export for the action run mock
 *
 * Currently set to the default export version.
 */
export const actionRunMock = actionRunMockDefault

/**
 * Mock for the addToProject function, used to simulate adding items to a project during tests.
 *
 * Currently commented out, as the mocked implementation is not needed for the tests.
 */
// export const addToProject = jest.fn<typeof import('../src/action.js').addToProject>()
