// See: https://eslint.org/docs/latest/use/configure/configuration-files

import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import jest from 'eslint-plugin-jest'
import prettier from 'eslint-plugin-prettier'
import globals from 'globals'

const compat = new FlatCompat({
	baseDirectory: import.meta.dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
})

export default [
	{
		ignores: ['coverage/**', 'dist/**', 'lib/**', 'node_modules/**', 'eslint.config.mjs'],
	},
	...compat.extends(
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:jest/recommended',
		'plugin:prettier/recommended'
	),
	{
		plugins: {
			jest,
			prettier,
			'@typescript-eslint': typescriptEslint,
		},

		languageOptions: {
			globals: {
				...globals.node,
				...jest.environments.globals.globals,
				Atomics: 'readonly',
				SharedArrayBuffer: 'readonly',
			},

			parser: tsParser,
			ecmaVersion: 2023,
			sourceType: 'module',

			parserOptions: {
				// projectService: {
				// 	allowDefaultProject: [
				// 		'__fixtures__/*.ts',
				// 		'__tests__/*.ts',
				// 		'eslint.config.mjs',
				// 		'fix-regex.cjs',
				// 		'jest.config.cjs',
				// 		'rollup.config.ts',
				// 		'.prettierrc.mjs',
				// 	],
				// 	maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 1000,
				// },
				project: ['./tsconfig.json', './tsconfig.test.json', './tsconfig.eslint.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},

		settings: {
			'import/resolver': {
				typescript: {
					alwaysTryTypes: true,
					project: 'tsconfig.json',
				},
			},
		},

		rules: {
			// Structural Overrides
			camelcase: 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'eslint-comments/no-use': 'off',
			'eslint-comments/no-unused-disable': 'off',
			'i18n-text/no-en': 'off',
			'import/no-namespace': 'off',
			'no-console': 'off',
			'no-shadow': 'off',
			'no-unused-vars': 'off',
			// Other Code Style Overrides
			'prettier/prettier': 'error',
			// Jest Overrides
			'jest/no-disabled-tests': 'warn',
			'jest/no-focused-tests': 'error',
			'jest/no-identical-title': 'error',
			'jest/prefer-to-have-length': 'error',
			'jest/valid-expect': 'error',
			// FORCE 'test()' EVERYWHERE (Will error if you use 'it()')
			'jest/consistent-test-it': ['error', { fn: 'test', withinDescribe: 'test' }],

			// OR FORCE 'it()' EVERYWHERE (Will error if you use 'test()')
			// 'jest/consistent-test-it': [
			//   'error',
			//   { fn: 'it', withinDescribe: 'it' }
			// ],
		},
	},
]
