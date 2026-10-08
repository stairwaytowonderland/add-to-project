import * as core from '@actions/core'
import * as github from '@actions/github'
import Action from './config.js'

/**
 * Main entry for the GitHub Action.
 *
 * This file contains the main entry for the GitHub Action,
 * which gathers inputs and invokes the addToProject function.
 *
 * @returns Resolves when the action is complete.
 */
export const run: () => Promise<void> = () =>
	Promise.resolve()
		.then(() => {
			console.debug('Starting your GitHub action...')
			const action = new Action(github.context)
			return action.run()
		})
		.then(() => {
			console.debug('Your GitHub action completed successfully!')
			process.exit(0)
		})
		.catch((error) => {
			if (error instanceof Error) {
				core.setFailed(error.message)
			} else {
				core.setFailed(String(error))
			}
			process.exit(1)
		})

// Export the run function as the default export for external usage
export default run
