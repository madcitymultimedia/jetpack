module.exports = {
	// This project uses react, so load the shared react config.
	root: true,
	extends: [ '../../../.eslintrc.react.js' ],
	settings: {
		jest: {
			version: 26,
		},
	},
};
