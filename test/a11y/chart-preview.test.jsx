import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { chartImage, csvFile, importWithKeyboard, renderApp, seriesCsv } from './helpers.jsx'

const preview = () => screen.getByRole('region', { name: 'Graph preview' })

describe('graph preview', () => {
  test('is a named region whose header icon is decorative', () => {
    renderApp()
    expect(preview().querySelector('.chart-preview-header svg')).toHaveAttribute('aria-hidden', 'true')
  })

  test('the canvas is exposed as an image with a text alternative', () => {
    renderApp()
    const canvas = chartImage()
    expect(canvas.tagName).toBe('CANVAS')
    expect(preview()).toContainElement(canvas)
    expect(canvas).toHaveAccessibleName('line plot of 24 points')
  })

  test('the canvas is not a tab stop', () => {
    renderApp()
    expect(chartImage()).not.toHaveAttribute('tabindex')
  })

  test('the text alternative follows the imported data', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('three.csv', 'x,y\n1,2\n2,3\n3,4'))
    expect(chartImage()).toHaveAccessibleName('line plot of 3 points')
    expect(within(preview()).getByText('1 series · 3 data points')).toBeInTheDocument()
  })

  test('too little data replaces the canvas with an explanation', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('tiny.csv', 'x,y\n1,2'))
    expect(screen.queryByRole('img', { name: /plot of/ })).not.toBeInTheDocument()
    expect(preview()).toHaveTextContent('Drop a file with at least two numeric rows and your graph will show up here.')
  })

  test('numeric overflow is announced as an alert in place of the chart', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('huge.csv', 'x,y\n-1e308,1\n1e308,2'))
    const alert = within(preview()).getByRole('alert')
    expect(alert).toHaveTextContent('is too large for 64-bit precision')
    expect(screen.queryByRole('img', { name: /plot of/ })).not.toBeInTheDocument()
  })

  test('series that do not fit in the legend are announced as a status', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('legend.csv', seriesCsv(11, (i) => `Very long series name number ${i + 1} ${'x'.repeat(30)}`)))
    expect(within(preview()).getByRole('status')).toHaveTextContent(/series don't fit in the legend\./)
  })

  // The tooltip ("Hover over a point to pull up tooltips!") is drawn on
  // pointermove only, so keyboard and screen reader users cannot read
  // individual values (WCAG 2.1.1). Enable once the chart supports it.
  test.todo('individual data points can be inspected from the keyboard')
})
