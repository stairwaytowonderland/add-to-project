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
	getSafeInputs,
} from './_common.js'
export { getInputs } from './config.js'
