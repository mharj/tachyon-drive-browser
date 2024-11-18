/// <reference types="vitest" />

import {defineConfig} from 'vite';

export default defineConfig({
	test: {
		reporters: process.env.GITHUB_ACTIONS ? ['github-actions', 'junit'] : ['verbose', 'github-actions', 'junit'],
		outputFile: {
			junit: './reports/jest-results.xml',
		},
		coverage: {
			provider: 'v8',
			include: ['src/**/*.mts'],
			reporter: ['text'],
		},
		browser: {
			provider: 'playwright',
			enabled: true,
			name: 'chromium',
			headless: true,
		},
		include: ['test/**/*.test.mts'],
	},
});
