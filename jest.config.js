// See: https://jestjs.io/docs/configuration

/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
	clearMocks: true,
	collectCoverage: true,
	collectCoverageFrom: ['./src/**'],
	coverageDirectory: './coverage',
	coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
	coverageReporters: ['json-summary', 'text', 'lcov'],
	// Uncomment the below lines if you would like to enforce a coverage threshold
	// for your action. This will fail the build if the coverage is below the
	// specified thresholds.
	// coverageThreshold: {
	//   global: {
	//     branches: 100,
	//     functions: 100,
	//     lines: 100,
	//     statements: 100
	//   }
	// },
	extensionsToTreatAsEsm: ['.ts'],
	moduleFileExtensions: ['ts', 'js'],
	moduleNameMapper: {
		'^@actions/core$': '<rootDir>/__fixtures__/core.ts',
		'^@actions/github$': '<rootDir>/__fixtures__/github.ts',
		// ts-jest emits .js extensions for ESM; remap relative .js → extensionless so Jest finds the .ts file
		'^(\\.{1,2}/.*)\\.js$': '$1',
		'^(_common\\.ts)$': '$1',
	},
	testMatch: ['**/*.test.ts'],
	testPathIgnorePatterns: ['/dist/', '/node_modules/'],
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.test.json',
				useESM: true,
			},
		],
	},
	verbose: true,
}
