/// <reference types="vitest" />
import {defineWorkspace} from 'vitest/config';

export default defineWorkspace([
	{
		extends: './vite.config.mts',
		test: {
            name: 'chrome',
			browser: {
				provider: 'playwright',
				enabled: true,
				headless: true,
				instances: [
					{
						browser: 'chromium',
					},
				],
			},
			include: ['test/**/*.test.mts'],
		},
		optimizeDeps: {
			include: ['tachyon-drive', 'sinon', 'zod'],
		},
	},
	{
		test: {
            name: 'firefox',
			browser: {
				provider: 'playwright',
				enabled: true,
                headless: false,
				instances: [
					{
						browser: 'firefox',
					},
				],
			},
			include: ['test/**/*.test.mts'],
		},
		optimizeDeps: {
			include: ['tachyon-drive', 'sinon', 'zod'],
		},
	},
]);
