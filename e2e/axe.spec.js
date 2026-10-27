import { expect, test } from '@playwright/test'
import { expectNoAxeViolations } from './helpers.js'

// Full axe run in Chromium, including color contrast, which jsdom can't check.
// Each page also runs at a phone width through the "mobile" project.
for (const path of ['home.html', 'examples.html', 'demo.html']) {
  test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('canvas').first()).toBeVisible()
    await expectNoAxeViolations(page)
  })
}

test('index.html redirects to the home page and offers a link fallback', async ({ page, request }) => {
  const html = await (await request.get('index.html')).text()
  expect(html).toMatch(/<html lang="en">/)
  expect(html).toMatch(/<a href="\.\/home\.html">Continue to 78js<\/a>/)
  await page.goto('index.html')
  await expect(page).toHaveURL(/home\.html$/)
})

test.describe('demo.html states', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('demo.html')
    await expect(page.getByRole('img', { name: /plot of/ })).toBeVisible()
  })

  test('scatter chart with every section collapsed', async ({ page }) => {
    await page.getByRole('button', { name: 'Scatter plot' }).click()
    for (const name of ['Titles & labels', 'Axis names', 'Data series']) {
      await page.getByRole('button', { name }).click()
    }
    await expectNoAxeViolations(page)
  })

  test('rejected file alert', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('x') })
    await expect(page.getByRole('alert')).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('data warnings, notes and precision warnings', async ({ page }) => {
    const csv = 'x,y,z\n1,2,\n2,abc,3\n3,9007199254740993,5\nfoo,1,1'
    await page.locator('input[type="file"]').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
    await expect(page.getByText(/nonnumeric value/)).toBeVisible()
    await expectNoAxeViolations(page)
  })

  test('series without a color', async ({ page }) => {
    const header = ['x', ...Array.from({ length: 12 }, (_, i) => `S${i + 1}`)].join(',')
    const rows = [1, 2, 3].map((x) => [x, ...Array.from({ length: 12 }, (_, i) => x + i)].join(','))
    await page.locator('input[type="file"]').setInputFiles({ name: 'many.csv', mimeType: 'text/csv', buffer: Buffer.from([header, ...rows].join('\n')) })
    await expect(page.getByRole('button', { name: 'Plot S12' })).toBeVisible()
    await expectNoAxeViolations(page)
  })
})
