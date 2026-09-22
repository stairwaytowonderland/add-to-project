import * as core from '@actions/core'
import {addToProject} from './add-to-project.js'

addToProject()
	.then(() => {
		process.exit(0)
	})
	.catch(err => {
		core.setFailed(err.message)
		process.exit(1)
	})
