import { expect, test } from '@playwright/test'
import { chromeAccessibleDescription, expectEveryStopVisible, walkTabOrder } from './helpers.js'

const NAV = ['78 js logo', 'API', 'Examples', 'Demo', 'GitHub']
const FOOTER = ['78 js logo']

const DEMO_ORDER = [
  'Scatter plot', 'Line graph', 'Drop a file or browse CSV or TSV', 'Empty cells',
  'Customize', 'Titles & labels', 'Text field to edit', 'Graph title', 'Add subtitle',
  'Axis names', 'X-axis label', 'Y-axis label',
  'Data series', 'Marker shape for Smitskis owned', 'Color for Smitskis owned',
  'Marker shape for Funds ($ x 10)', 'Color for Funds ($ x 10)', 'Show data points', 'Point size: 7',
  'Reset to defaults', 'Back to 78js',
]

const expectedOrder = (path, project) => ({
  // The live editor is hidden on phones by design (home.css).
  'home.html': [...NAV, ...(project === 'mobile' ? [] : ['Live JavaScript chart editor']), 'GitHub', 'Install', 'Demo', ...FOOTER],
  'examples.html': [...NAV, ...FOOTER],
  'demo.html': DEMO_ORDER,
})[path]

for (const path of ['home.html', 'examples.html', 'demo.html']) {
  test.describe(path, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('canvas').first()).toBeVisible()
    })

    test('Tab reaches every control in order, each with a visible focus indicator, then leaves the page', async ({ page }, { project }) => {
      const stops = await walkTabOrder(page)
      expect(stops.map((s) => s.name)).toEqual(expectedOrder(path, project.name))
      expectEveryStopVisible(stops)
    })

    test('Shift+Tab visits the same controls in reverse', async ({ page }, { project }) => {
      const stops = await walkTabOrder(page, { key: 'Shift+Tab' })
      expect(stops.map((s) => s.name)).toEqual(expectedOrder(path, project.name).reverse())
    })

    test('every chart canvas is an image with a text alternative and is not a tab stop', async ({ page }) => {
      const canvases = page.locator('canvas')
      for (const canvas of await canvases.all()) {
        await expect(canvas).toHaveAttribute('role', 'img')
        await expect(canvas).toHaveAttribute('aria-label', /^(scatter|line) plot of \d+ points$/)
        await expect(canvas).not.toHaveAttribute('tabindex', /.*/)
      }
    })
  })
}

test.describe('home.html live editor', () => {
  test.skip(({ viewport }) => viewport.width < 760, 'the editor is hidden on phones')

  test.beforeEach(async ({ page }) => {
    await page.goto('home.html')
    await expect(page.getByRole('img', { name: 'line plot of 5 points' })).toBeVisible()
  })

  const focusEditor = async (page) => {
    const editor = page.getByRole('textbox', { name: 'Live JavaScript chart editor' })
    while (!(await editor.evaluate((el) => el === document.activeElement))) await page.keyboard.press('Tab')
    return editor
  }

  test('code typed from the keyboard redraws the chart and updates its text alternative', async ({ page }) => {
    await focusEditor(page)
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type("chart.update({ type: 'scatter', series: [{ name: 'A', color: '#000000' }], columns: { length: 3, x: Float64Array.of(1, 2, 3), ys: [Float64Array.of(4, 5, 6)] } })")
    await expect(page.locator('#code-chart canvas')).toHaveAttribute('aria-label', 'scatter plot of 3 points')
  })

  test('errors are announced in the status region the editor describes itself with', async ({ page }) => {
    const editor = await focusEditor(page)
    await expect(editor).toHaveAttribute('aria-describedby', 'code-error')
    const status = page.getByRole('status')
    await expect(status).toHaveAttribute('id', 'code-error')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('chart.nope()')
    await expect(status).toHaveText('chart.nope is not a function')
    // Playwright's own description calculation skips <output>; Chromium's tree is what screen readers get.
    await expect.poll(() => chromeAccessibleDescription(page, 'Live JavaScript chart editor')).toBe('chart.nope is not a function')
  })

  test('Tab leaves the editor instead of inserting a tab character', async ({ page }) => {
    const editor = await focusEditor(page)
    const before = await editor.inputValue()
    await page.keyboard.press('Tab')
    await expect(editor).not.toBeFocused()
    await expect(page.locator('#main-links a').first()).toBeFocused()
    expect(await editor.inputValue()).toBe(before)
  })
})

test.describe('demo.html keyboard operation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('demo.html')
    await expect(page.getByRole('img', { name: 'line plot of 24 points' })).toBeVisible()
  })

  for (const key of ['Enter', ' ']) {
    test(`"${key}" on the drop zone opens exactly one native file chooser and imports the file`, async ({ page }) => {
      const choosers = []
      page.on('filechooser', (chooser) => choosers.push(chooser))
      const dropzone = page.getByRole('button', { name: 'Drop a file or browse CSV or TSV' })
      await dropzone.focus()
      await page.keyboard.press(key === ' ' ? 'Space' : key)
      await expect.poll(() => choosers.length).toBe(1)
      await page.waitForTimeout(200)
      expect(choosers).toHaveLength(1)

      await choosers[0].setFiles({ name: 'rain.csv', mimeType: 'text/csv', buffer: Buffer.from('month,mm\n1,40\n2,55\n3,30') })
      await expect(page.locator('.data-panel-summary')).toContainText('rain.csv · 3 rows · 1 series')
      await expect(page.getByRole('img', { name: 'line plot of 3 points' })).toBeVisible()
      await expect(dropzone).toBeFocused()
    })
  }

  test('chart type buttons respond to Enter and Space', async ({ page }) => {
    const scatter = page.getByRole('button', { name: 'Scatter plot' })
    await scatter.focus()
    await page.keyboard.press('Enter')
    await expect(scatter).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('img', { name: 'scatter plot of 24 points' })).toBeVisible()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Line graph' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('switches toggle with Space and keep focus', async ({ page }) => {
    const subtitle = page.getByRole('switch', { name: 'Add subtitle' })
    await subtitle.focus()
    await page.keyboard.press('Space')
    await expect(subtitle).toHaveAttribute('aria-checked', 'false')
    await expect(subtitle).toBeFocused()
  })

  test('section headers collapse with Enter and keep focus', async ({ page }) => {
    const header = page.getByRole('button', { name: 'Axis names' })
    await header.focus()
    await page.keyboard.press('Enter')
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('textbox', { name: 'X-axis label' })).toHaveCount(0)
    await expect(header).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Data series' })).toBeFocused()
  })

  test('the point-size slider responds to arrow, Home and End keys', async ({ page }) => {
    const slider = page.getByRole('slider', { name: /Point size/ })
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveAccessibleName('Point size: 8')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(slider).toHaveAccessibleName('Point size: 6')
    await page.keyboard.press('Home')
    await expect(slider).toHaveAccessibleName('Point size: 2')
    await page.keyboard.press('End')
    await expect(slider).toHaveAccessibleName('Point size: 12')
  })

  test('text fields accept typing and Reset to defaults works from the keyboard', async ({ page }) => {
    const title = page.getByRole('textbox', { name: 'Graph title' })
    await title.focus()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('Rainfall')
    await expect(title).toHaveValue('Rainfall')
    await page.getByRole('button', { name: 'Reset to defaults' }).focus()
    await page.keyboard.press('Enter')
    await expect(title).toHaveValue('My Growing Smitski Collection')
  })
})
