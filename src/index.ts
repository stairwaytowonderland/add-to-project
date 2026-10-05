/**
 * Barrel file for the GitHub Action.
 *
 * This file simply imports and runs the main logic of the action.
 */

import run from './main.js'

// Re-export the run function for external usage
export { run }

/* istanbul ignore next */
run()
