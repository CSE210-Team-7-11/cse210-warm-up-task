import { expect, test } from '@playwright/test'

test('the demo loads and renders its sample chart', async ({ page }) => {
	const pageErrors = []
	page.on('pageerror', (error) => pageErrors.push(error.message))

	await page.goto('demo.html')
	await expect(page.getByRole('heading', { name: 'Choose your graph' })).toBeVisible()

	const preview = page.getByRole('region', { name: 'Graph preview' })
	await expect(preview.getByRole('img', { name: /^line plot of [1-9]\d* points$/ })).toBeVisible()
	expect(pageErrors).toEqual([])
})
