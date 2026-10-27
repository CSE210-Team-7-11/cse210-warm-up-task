import { screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { chartImage, renderApp } from './helpers.jsx'

const picker = () => screen.getByRole('group', { name: 'Graph type' })
const option = (name) => within(picker()).getByRole('button', { name })

describe('Step 01: chart type picker', () => {
  test('is a named region with a named group of toggle buttons', () => {
    renderApp()
    expect(screen.getByRole('region', { name: /Choose your graph/ })).toContainElement(picker())
    const buttons = within(picker()).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Scatter plot', 'Line graph'])
    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toHaveAttribute('aria-pressed')
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('exactly one option is pressed and it matches the drawn chart', () => {
    renderApp()
    expect(option('Line graph')).toHaveAttribute('aria-pressed', 'true')
    expect(option('Scatter plot')).toHaveAttribute('aria-pressed', 'false')
    expect(chartImage()).toHaveAccessibleName('line plot of 24 points')
  })

  test('Enter selects an option and keeps focus on it', async () => {
    const { user } = renderApp()
    await user.tab()
    expect(option('Scatter plot')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(option('Scatter plot')).toHaveAttribute('aria-pressed', 'true')
    expect(option('Line graph')).toHaveAttribute('aria-pressed', 'false')
    expect(option('Scatter plot')).toHaveFocus()
    expect(chartImage()).toHaveAccessibleName('scatter plot of 24 points')
  })

  test('Space selects an option', async () => {
    const { user } = renderApp()
    await user.tab()
    await user.keyboard('{Enter}')
    await user.tab()
    expect(option('Line graph')).toHaveFocus()
    await user.keyboard(' ')
    expect(option('Line graph')).toHaveAttribute('aria-pressed', 'true')
    expect(chartImage()).toHaveAccessibleName('line plot of 24 points')
  })

  test('re-pressing the selected option keeps it selected', async () => {
    const { user } = renderApp()
    option('Line graph').focus()
    await user.keyboard('{Enter}')
    expect(option('Line graph')).toHaveAttribute('aria-pressed', 'true')
  })
})
