import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('record the demo accessibility baseline for review', async ({ page }, testInfo) => {
	await page.goto('demo.html')
	await expect(page.getByRole('region', { name: 'Graph preview' }).getByRole('img')).toBeVisible()
	await page.evaluate(async () => {
		await document.fonts.ready
	})

	const results = await new AxeBuilder({ page }).analyze()
	await testInfo.attach('axe-results', {
		body: JSON.stringify(results, null, 4),
		contentType: 'application/json',
	})

	testInfo.annotations.push({
		type: 'a11y-baseline',
		description: `${results.violations.length} axe violation types recorded for review`,
	})
	console.log(
		`[${testInfo.project.name}] axe baseline:`,
		results.violations.map(({ id, impact, nodes }) => ({
			rule: id,
			impact,
			elements: nodes.length,
		})),
	)
})

test('chart-type controls can be reached and activated with the keyboard', async ({ page }) => {
	await page.goto('demo.html')
	const scatter = page.getByRole('button', { name: 'Scatter plot', exact: true })
	const line = page.getByRole('button', { name: 'Line graph', exact: true })
	const chart = page.getByRole('region', { name: 'Graph preview' }).getByRole('img')
	await expect(chart).toBeVisible()
	await expect(line).toHaveAttribute('aria-pressed', 'true')

	await page.keyboard.press('Tab')
	await expect(scatter).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(scatter).toHaveAttribute('aria-pressed', 'true')
	await expect(line).toHaveAttribute('aria-pressed', 'false')
	await expect(chart).toHaveAttribute('aria-label', /^scatter plot of [1-9]\d* points$/)

	await page.keyboard.press('Tab')
	await expect(line).toBeFocused()
	await page.keyboard.press('Space')
	await expect(line).toHaveAttribute('aria-pressed', 'true')
	await expect(scatter).toHaveAttribute('aria-pressed', 'false')
	await expect(chart).toHaveAttribute('aria-label', /^line plot of [1-9]\d* points$/)
})
