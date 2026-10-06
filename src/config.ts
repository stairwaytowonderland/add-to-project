/**
 * Configuration for the GitHub Action.
 *
 * Contains the Action class and related configuration interfaces.
 */

import * as core from '@actions/core'
import {
	RepoAction,
	LabelOperator,
	ProjectInfo,
	GitHubContext,
	ActionInputs,
	ActionRepository,
	SimpleRepository,
} from './types.js'
import action from './action.js'

/**
 * Represents a flat configuration for the GitHub Action.
 *
 * * Customize this interface to include any additional configuration options required for your action.
 */
export interface ActionConfig extends RepoAction {
	/** The labels to filter issues or pull requests by. */
	labeled: string[]
	/** The operator to use when filtering by labels (e.g., AND, OR). */
	labelOperator: LabelOperator
	/** Information about the project to which issues or pull requests should be added. */
	project: ProjectInfo
}

/**
 * Main action class for the GitHub Action.
 *
 * * Implements the RepoAction interface and provides methods to run the action.
 * * Customize this class to include any additional inputs, methods, or properties required for your action.
 */
export class Action implements RepoAction {
	/** Indicates if the action should run in dry-run mode. */
	dryRun: boolean
	/** The GitHub context object. */
	context: GitHubContext
	/** The action inputs provided to the GitHub Action. */
	inputs?: ActionInputs

	/**
	 * Returns the actor (user) who triggered the GitHub Action.
	 */
	get actor(): string {
		return this.context.actor
	}

	/**
	 * Returns the repository associated with the GitHub Action.
	 */
	get repo(): SimpleRepository {
		return new ActionRepository(this.context.repo) as SimpleRepository
	}

	/**
	 * Creates a new instance of the Action class.
	 *
	 * @param context The GitHub context object.
	 * @param inputs Optional action inputs.
	 * @param dryRun Optional flag indicating if the action should run in dry-run mode.
	 */
	constructor(context: GitHubContext, inputs?: ActionInputs, dryRun?: boolean) {
		const dryRunInput = (core.getInput('dry-run') ?? 'false').trim()
		this.dryRun = dryRun ?? dryRunInput === 'true'
		this.context = context

		this.inputs = inputs ?? {
			dryRun: dryRunInput,
			ghToken: (core.getInput('github-token', { required: true }) ?? '').trim(),
			projectUrl: (core.getInput('project-url', { required: true }) ?? '').trim(),
			labeled: (core.getInput('labeled') ?? '').trim(),
			labelOperator: (core.getInput('label-operator') ?? '').trim(),
			repo: (core.getInput('repo') ?? '').trim(),
			owner: (core.getInput('owner') ?? '').trim(),
		}
	}

	/**
	 * Executes the main logic of the GitHub Action.
	 *
	 * @returns resolves when the action has completed execution.
	 */
	async run(): Promise<void> {
		core.debug(`Action created with actor: ${this.actor} and repo: ${this.repo.fullName}`)
		core.debug(`Action dryRun: ${this.dryRun}`)
		core.debug(`Action inputs: ${JSON.stringify(this.inputs)}`)

		await action(this)
	}
}

// Export the Action class as the default export for external usage
export default Action
