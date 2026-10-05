/**
 * Barrel file for the GitHub Action.
 *
 * This file simply imports and runs the main logic of the action.
 */

import run from './main.js'

/* istanbul ignore next */
run()

// Export the run function for external usage
export { run }
