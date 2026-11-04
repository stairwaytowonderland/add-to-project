/**
 * Rollup Configuration for the project
 *
 * @see https://rollupjs.org/introduction/
 */

import commonjs from '@rollup/plugin-commonjs'
import license from 'rollup-plugin-license'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { defineConfig } from 'rollup'

const IGNORED_CIRCULAR_DEPENDENCY =
	'node_modules/@actions/core/lib/core.js -> node_modules/@actions/core/lib/oidc-utils.js -> node_modules/@actions/core/lib/core.js'

const IGNORED_THIS_IS_UNDEFINED = 'node_modules/@actions/'

const allowedLicenses = [
	// 'MIT',
	// 'Apache-2.0',
	// 'BSD-2-Clause',
	// 'BSD-3-Clause',
	// 'ISC',
	// 'CC0-1.0',
	// 'GPL-2.0',
	// 'GPL-3.0',
]

if (!allowedLicenses.length) {
	console.warn('No allowed licenses specified. Defaulting to "all".')
	allowedLicenses.push('')
	allowedLicenses.pop()
}

const allowedSpdxString =
	allowedLicenses
		?.filter((license) => license?.trim())
		// .map((license) => license.toUpperCase())
		.join(' OR ') || allowedLicenses.pop()

console.log('Allowed Licenses (rollup-plugin-license) SPDX String:', `'${allowedSpdxString}'`)

export default defineConfig({
	input: 'src/index.ts',
	output: {
		esModule: true,
		file: 'dist/index.js',
		format: 'es',
		sourcemap: true, // Creates dist/index.js.map
	},
	external: ['node:sqlite'], // Mark 'node:sqlite' as external to prevent bundling it (coming from undici)
	onwarn(warning, warn) {
		switch (warning.code) {
			case 'CIRCULAR_DEPENDENCY':
				if (warning.message?.includes(IGNORED_CIRCULAR_DEPENDENCY)) {
					return
				}
				break
			case 'THIS_IS_UNDEFINED':
				if (warning.message?.includes(IGNORED_THIS_IS_UNDEFINED)) {
					return
				}
				break
		}

		warn(warning)
	},
	plugins: [
		nodeResolve({ preferBuiltins: true }),
		typescript({
			// https://www.typescriptlang.org/tsconfig/
			compilerOptions: {
				sourceMap: true, // Forces the plugin to feed raw mappings to Rollup
				// composite: false, // Disables project compilation mode
				// incremental: false, // Disables incremental compilation
				// declaration: false, // Generate .d.ts files for every TypeScript or JavaScript file inside your project.
				// declarationMap: false, // Generates a source map for .d.ts files which map back to the original .ts source file.
				listEmittedFiles: true, // Lists all files emitted during the compilation
			},
		}),
		commonjs(),
		// prettier-ignore
		license({ banner: 'Copyright <%= moment().format("YYYY") %> <%= pkg.author %>', thirdParty: { output: 'dist/licenses.txt', allow: allowedSpdxString } }), // codespell:ignore thirdparty pkg
	],
})
