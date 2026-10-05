import * as core from '@actions/core'
import * as github from '@actions/github'
import { Action } from './config.js'

/**
 * Main entry for the GitHub Action.
 *
 * This file contains the main entry for the GitHub Action,
 * which gathers inputs and invokes the addToProject function.
 *
 * @returns Resolves when the action is complete.
 */
export default async function run(): Promise<void> {
	try {
		console.debug('Starting your GitHub action...')
		const action: Action = new Action(github.context)
		await action.run()
		console.debug('Your GitHub action completed successfully!')
		process.exit(0)
	} catch (error) {
		// Fail the workflow run if an error occurs
		if (error instanceof Error) core.setFailed(error.message)
		process.exit(1)
	}
}

// Export the run function for external usage
export { run }
