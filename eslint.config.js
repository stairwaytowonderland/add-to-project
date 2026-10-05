/**
 * ESLint Flat Config for the project
 *
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 * @see https://typescript-eslint.io/
 */

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import jest from 'eslint-plugin-jest'
import prettier from 'eslint-plugin-prettier'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'

export default [
	// 1. Global Ignores
	{
		// '**/.rollup.cache/**',
		ignores: ['coverage/**', 'dist/**', 'lib/**', 'node_modules/**'],
	},

	// 2. Base Presets (Native Flat Config definitions)
	js.configs.recommended,
	...tseslint.configs.recommended,
	jest.configs['flat/recommended'],
	eslintPluginPrettierRecommended,

	// 3. Environment, Parser, and Rules Overrides
	{
		plugins: {
			jest,
			prettier,
			'@typescript-eslint': tseslint.plugin,
		},

		languageOptions: {
			globals: {
				...globals.node,
				...globals.jest,
				Atomics: 'readonly',
				SharedArrayBuffer: 'readonly',
			},

			parser: tseslint.parser,
			ecmaVersion: 2023,
			sourceType: 'module',

			parserOptions: {
				// projectService: {
				// 	allowDefaultProject: [
				// 		'__fixtures__/*.ts',
				// 		'__tests__/*.ts',
				// 		'eslint.config.mjs',
				// 		'jest.config.js',
				// 		'rollup.config.ts',
				// 		'.prettierrc.mjs',
				// 	],
				// 	maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 1000,
				// },
				project: ['./tsconfig.json', './tsconfig.test.json', './tsconfig.eslint.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},

		rules: {
			// Structural Overrides
			camelcase: 'off',
			'@typescript-eslint/no-empty-object-type': 'warn',
			'@typescript-eslint/no-require-imports': 'off',
			'eslint-comments/no-use': 'off',
			'eslint-comments/no-unused-disable': 'off',
			'i18n-text/no-en': 'off',
			'import/no-namespace': 'off',
			'no-console': 'off',

			'no-shadow': 'off',
			// TypeScript-specific rule overrides for shadowed variables
			'@typescript-eslint/no-shadow': 'off',

			// 'no-unused-vars': 'off',
			// TypeScript-specific rule overrides for unused variables
			// '@typescript-eslint/no-unused-vars': 'off',

			// Other Code Style Overrides
			'prettier/prettier': 'error',

			// Jest Overrides
			'jest/no-commented-out-tests': 'warn',
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
