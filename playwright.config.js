import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

// Real-browser accessibility and keyboard checks against the production build,
// covering what jsdom cannot: color contrast, visible focus and real tab order.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/cse210-warm-up-task/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/cse210-warm-up-task/home.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
