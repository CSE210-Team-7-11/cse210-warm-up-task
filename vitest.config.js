import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

// Component-level accessibility and keyboard tests (jsdom).
// The existing logic tests in test/*.test.js use node:test and run with `npm test`;
// they are excluded here so each runner only sees its own files.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/a11y/**/*.test.jsx'],
    setupFiles: ['test/a11y/setup.jsx'],
    restoreMocks: true,
    // Load component CSS so jsdom sees `display: none` etc. and the
    // accessibility tree matches what a browser exposes.
    css: { include: [/.+/] },
  },
}))
