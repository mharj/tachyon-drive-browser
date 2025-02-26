/// <reference types="vitest" />

import {defineConfig} from 'vite';

export default defineConfig({
	test: {
		reporters: process.env.GITHUB_ACTIONS ? ['github-actions', 'junit'] : ['verbose', 'github-actions', 'junit'],
		outputFile: {
			junit: './test-results.xml',
		},
		coverage: {
			provider: 'v8',
			include: ['src/**/*.mts'],
			reporter: ['text'],
		},
	},
	optimizeDeps: {
		include: ['tachyon-drive', 'sinon', 'zod'],
	},
});
