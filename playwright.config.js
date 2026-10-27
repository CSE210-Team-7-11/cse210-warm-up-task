import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 0)
if (!Number.isInteger(port) || port < 0 || port > 65535) {
	throw new RangeError(
		'E2E_PORT must be an integer from 0 to 65535. Enter 0 to automatically choose a port.',
	)
}

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.spec.js',
	forbidOnly: Boolean(process.env.CI),
	outputDir: 'test-results',
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
	],
	webServer: {
		command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
		wait: {
			// Playwright uses the captured environment variable as its default baseURL.
			// Vite's URL includes the selected port and the configured base path.
			stdout: /Local:\s+(?<playwright_test_base_url>http:\/\/127\.0\.0\.1:\d+\/\S*)/,
		},
	},
})
