//prettier.io/docs/configuration
// prettier.config.cjs
/** @type {import("prettier").Config} */
module.exports = {
	...require('@github/prettier-config'),
	// ...require('./.prettier.json'),
	printWidth: 120,
}
