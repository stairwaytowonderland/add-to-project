module.exports = {
	clearMocks: true,
	moduleFileExtensions: ['js', 'ts'],
	testMatch: ['**/*.test.ts', '**/*.test.js'],
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				tsconfig: {
					types: ['jest', 'node'],
				},
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
