// prettier.config.mjs
import githubConfig from '@github/prettier-config'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const localConfig = require('./.prettier.json')

/** @type {import("prettier").Config} */
export default {
	...githubConfig,
	...localConfig,
	printWidth: 120,
}
