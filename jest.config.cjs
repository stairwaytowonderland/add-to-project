module.exports = {
	clearMocks: true,
	moduleFileExtensions: ['js', 'ts'],
	testMatch: ['**/*.test.ts', '**/*.test.js'],
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^@actions/core$': '<rootDir>/__fixtures__/core.ts',
		'^@actions/github$': '<rootDir>/__fixtures__/github.ts',
		// ts-jest emits .js extensions for ESM; remap relative .js → extensionless so Jest finds the .ts file
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: './tsconfig.test.json',
			},
		],
	},
	verbose: true,
	collectCoverage: true,
	// collectCoverageFrom: ['./src/**'],
	// coverageDirectory: './coverage',
	// coveragePathIgnorePatterns: ['/src/main.ts'],
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
}
