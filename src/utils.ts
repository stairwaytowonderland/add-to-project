/**
 * Shared utility functions
 */

// Re-export utility functions from the common module
export {
	getOctokit,
	kebabToCamel,
	normalizeOptional,
	searchIssuesAndPullRequests,
	getIssueFromContext,
	getPrFromContext,
} from './_common.js'
export { getInputs } from './config.js'
