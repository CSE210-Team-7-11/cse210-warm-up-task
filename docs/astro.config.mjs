import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'

export default defineConfig({
	srcDir: './site',
	outDir: '../dist/docs',
	base: '/cse210-warm-up-task/docs/',
	build: { format: 'file' },
	markdown: {
		shikiConfig: { theme: 'github-light' },
	},
	devToolbar: { enabled: false },
	vite: {
		server: {
			fs: { allow: [fileURLToPath(new URL('../', import.meta.url))] },
		},
	},
})
