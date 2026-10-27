import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { chartImage, csvFile, dataSummary, dropzone, fileInput, renderApp } from './helpers.jsx'

// Every tab stop in the editor, in visual order (left column, right column, footer).
const TAB_ORDER = [
  () => screen.getByRole('button', { name: 'Scatter plot' }),
  () => screen.getByRole('button', { name: 'Line graph' }),
  () => screen.getByRole('button', { name: /^Drop a file or browse/ }),
  () => screen.getByRole('combobox', { name: 'Empty cells' }),
  () => screen.getByRole('tab', { name: 'Customize' }),
  () => screen.getByRole('button', { name: 'Titles & labels' }),
  () => screen.getByRole('combobox', { name: 'Text field to edit' }),
  () => screen.getByRole('textbox', { name: 'Graph title' }),
  () => screen.getByRole('switch', { name: 'Add subtitle' }),
  () => screen.getByRole('button', { name: 'Axis names' }),
  () => screen.getByRole('textbox', { name: 'X-axis label' }),
  () => screen.getByRole('textbox', { name: 'Y-axis label' }),
  () => screen.getByRole('button', { name: 'Data series' }),
  () => screen.getByRole('combobox', { name: 'Marker shape for Smitskis owned' }),
  () => screen.getByLabelText('Color for Smitskis owned'),
  () => screen.getByRole('combobox', { name: 'Marker shape for Funds ($ x 10)' }),
  () => screen.getByLabelText('Color for Funds ($ x 10)'),
  () => screen.getByRole('switch', { name: 'Show data points' }),
  () => screen.getByRole('slider', { name: /Point size/ }),
  () => screen.getByRole('button', { name: 'Reset to defaults' }),
  () => screen.getByRole('link', { name: 'Back to 78js' }),
]

const INTERACTIVE = 'a[href], button, input, select, textarea, [tabindex], [role="button"], [role="switch"], [role="tab"]'

async function tabStops(user, shift = false) {
  const stops = []
  for (let i = 0; i < 100; i++) {
    await user.tab({ shift })
    if (document.activeElement === document.body) return stops
    stops.push(document.activeElement)
  }
  throw new Error('Focus never left the page: keyboard trap')
}

describe('keyboard navigation across the editor', () => {
  test('Tab visits every control once, in visual order, then leaves the page', async () => {
    const { user } = renderApp()
    expect(await tabStops(user)).toEqual(TAB_ORDER.map((get) => get()))
  })

  test('Shift+Tab visits the same controls in reverse', async () => {
    const { user } = renderApp()
    expect(await tabStops(user, true)).toEqual(TAB_ORDER.map((get) => get()).reverse())
  })

  test('every interactive element is reachable by Tab, except the hidden file input', async () => {
    const { user } = renderApp()
    const reachable = new Set(await tabStops(user))
    const unreachable = [...document.querySelectorAll(INTERACTIVE)].filter((el) => !reachable.has(el))
    expect(unreachable).toEqual([fileInput()])
  })

  test('no element uses a positive tabindex', () => {
    renderApp()
    const positive = [...document.querySelectorAll('[tabindex]')].filter((el) => el.tabIndex > 0)
    expect(positive).toEqual([])
  })

  test('elements with an interactive ARIA role are focusable', () => {
    renderApp()
    for (const el of document.querySelectorAll('[role="button"], [role="switch"], [role="tab"]')) {
      expect(el.tabIndex, el.outerHTML).toBeGreaterThanOrEqual(0)
    }
  })

  test('a full keyboard-only workflow: pick a chart, import data, edit labels, reset', async () => {
    const { user } = renderApp()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(chartImage()).toHaveAccessibleName('scatter plot of 24 points')

    await user.tab()
    await user.tab()
    expect(dropzone()).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.upload(fileInput(), csvFile('rain.csv', 'month,mm\n1,40\n2,55\n3,30'))
    await screen.findByText(/rain\.csv/)
    expect(dataSummary()).toHaveTextContent('rain.csv · 3 rows · 1 series')
    expect(dropzone()).toHaveFocus()

    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    const title = screen.getByRole('textbox', { name: 'Graph title' })
    expect(title).toHaveFocus()
    await user.keyboard('{Control>}a{/Control}Rainfall')
    expect(title).toHaveValue('Rainfall')

    screen.getByRole('button', { name: 'Reset to defaults' }).focus()
    await user.keyboard('{Enter}')
    expect(title).toHaveValue('My Growing Smitski Collection')
    expect(chartImage()).toHaveAccessibleName('scatter plot of 3 points')
  })
})
