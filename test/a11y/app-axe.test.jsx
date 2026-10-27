import { screen } from '@testing-library/react'
import { describe, test } from 'vitest'
import { expectNoAxeViolations } from './axe.jsx'
import { csvFile, importWithKeyboard, renderApp, seriesCsv } from './helpers.jsx'

const press = async (user, element, key = '{Enter}') => {
  element.focus()
  await user.keyboard(key)
}

// axe (WCAG 2.2 A/AA) on every distinct UI state, since conditional
// elements such as alerts, warnings and collapsed sections only exist in some.
describe('axe: no WCAG A/AA violations', () => {
  test('default line chart', async () => {
    renderApp()
    await expectNoAxeViolations()
  })

  test('scatter chart', async () => {
    const { user } = renderApp()
    await press(user, screen.getByRole('button', { name: 'Scatter plot' }))
    await expectNoAxeViolations()
  })

  test('every section collapsed', async () => {
    const { user } = renderApp()
    for (const name of ['Titles & labels', 'Axis names', 'Data series']) {
      await press(user, screen.getByRole('button', { name }))
    }
    await expectNoAxeViolations()
  })

  test('subtitle field selected and toggles off', async () => {
    const { user } = renderApp()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Text field to edit' }), 'Subtitle')
    await press(user, screen.getByRole('switch', { name: 'Add subtitle' }), ' ')
    await press(user, screen.getByRole('switch', { name: 'Show data points' }), ' ')
    await expectNoAxeViolations()
  })

  test('rejected file alert', async () => {
    const { user } = renderApp({ applyAccept: false })
    await importWithKeyboard(user, csvFile('notes.png', 'x'))
    await expectNoAxeViolations()
  })

  test('data warnings and notes', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('bad.csv', 'x,y,y\n1,2,\n2,abc,3\n3,4,5\nfoo,1,1'))
    await expectNoAxeViolations()
  })

  test('precision warnings', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('big.csv', 'x,y\n1,9007199254740993\n2,3'))
    await expectNoAxeViolations()
  })

  test('series without a color', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('many.csv', seriesCsv(12)))
    await expectNoAxeViolations()
  })

  test('legend overflow warning', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('legend.csv', seriesCsv(11, (i) => `Very long series name number ${i + 1} ${'x'.repeat(30)}`)))
    await expectNoAxeViolations()
  })

  test('empty chart', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('tiny.csv', 'x,y\n1,2'))
    await expectNoAxeViolations()
  })

  test('numeric overflow alert', async () => {
    const { user } = renderApp()
    await importWithKeyboard(user, csvFile('huge.csv', 'x,y\n-1e308,1\n1e308,2'))
    await expectNoAxeViolations()
  })
})
