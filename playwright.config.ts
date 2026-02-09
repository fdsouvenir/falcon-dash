import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run dev',
		port: 5173,
		reuseExistingServer: !process.env.CI
	},
	testDir: 'tests',
	timeout: 15000,
	expect: { timeout: 5000 },
	projects: [
		{
			name: 'chromium',
			use: { browserName: 'chromium', headless: true },
			testIgnore: 'mobile.test.ts'
		},
		{
			name: 'mobile',
			use: {
				...devices['iPhone 14'],
				headless: true,
				browserName: 'chromium'
			},
			testMatch: 'mobile.test.ts'
		}
	]
});
