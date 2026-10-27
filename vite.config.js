import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	base: '/cse210-warm-up-task/',
	build: {
		rolldownOptions: {
			input: ['index.html', 'home.html', 'examples.html', 'demo.html'].map((page) =>
				fileURLToPath(new URL(page, import.meta.url)),
			),
		},
	},
})
