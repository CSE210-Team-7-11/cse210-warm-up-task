import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { csvFile, importWithKeyboard, renderApp, seriesCsv } from './helpers.jsx'

const sectionButton = (name) => screen.getByRole('button', { name })
const toggle = (name) => screen.getByRole('switch', { name })
const slider = () => screen.queryByRole('slider', { name: /Point size/ })
const SECTIONS = ['Titles & labels', 'Axis names', 'Data series']

describe('Step 03: graph specifications', () => {
  test('has a heading and a named tablist with one selected tab', () => {
    renderApp()
    expect(screen.getByRole('heading', { level: 2, name: /Graph Specifications/ })).toBeInTheDocument()
    const tablist = screen.getByRole('tablist', { name: 'Graph specification views' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toHaveAccessibleName('Customize')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })

  describe('collapsible sections (disclosure pattern)', () => {
    test.each(SECTIONS)('"%s" starts expanded and aria-controls points at its body', (name) => {
      renderApp()
      const button = sectionButton(name)
      expect(button).toHaveAttribute('aria-expanded', 'true')
      const body = document.getElementById(button.getAttribute('aria-controls'))
      expect(body).toBeInTheDocument()
      expect(button.parentElement).toContainElement(body)
      expect(button.querySelector('.specs-panel-section-chevron')).toHaveAttribute('aria-hidden', 'true')
    })

    test.each(SECTIONS)('"%s" collapses with Enter and expands with Space, keeping focus', async (name) => {
      const { user } = renderApp()
      const button = sectionButton(name)
      const bodyId = button.getAttribute('aria-controls')
      button.focus()

      await user.keyboard('{Enter}')
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).not.toHaveAttribute('aria-controls')
      expect(document.getElementById(bodyId)).not.toBeInTheDocument()
      expect(button).toHaveFocus()

      await user.keyboard(' ')
      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(document.getElementById(bodyId)).toBeInTheDocument()
      expect(button).toHaveFocus()
    })

    test('collapsed sections remove their controls from the tab order', async () => {
      const { user } = renderApp()
      sectionButton('Axis names').focus()
      await user.keyboard('{Enter}')
      await user.tab()
      expect(sectionButton('Data series')).toHaveFocus()
    })
  })

  describe('titles & labels', () => {
    const fieldSelect = () => screen.getByRole('combobox', { name: 'Text field to edit' })

    test('the text input is named after the field it edits', async () => {
      const { user } = renderApp()
      expect(screen.getByRole('textbox', { name: 'Graph title' })).toHaveValue('My Growing Smitski Collection')
      await user.selectOptions(fieldSelect(), 'Subtitle')
      expect(screen.queryByRole('textbox', { name: 'Graph title' })).not.toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Subtitle' })).toHaveValue('Ts is definitely not an addiction...')
    })

    test('typing edits the selected field', async () => {
      const { user } = renderApp()
      const input = screen.getByRole('textbox', { name: 'Graph title' })
      await user.clear(input)
      await user.type(input, 'Rainfall')
      expect(input).toHaveValue('Rainfall')
      expect(input).toHaveFocus()
    })

    test('"Add subtitle" is a switch toggled by Space and Enter', async () => {
      const { user } = renderApp()
      const subtitle = toggle('Add subtitle')
      expect(subtitle).toHaveAttribute('aria-checked', 'true')
      subtitle.focus()
      await user.keyboard(' ')
      expect(subtitle).toHaveAttribute('aria-checked', 'false')
      await user.keyboard('{Enter}')
      expect(subtitle).toHaveAttribute('aria-checked', 'true')
      expect(subtitle).toHaveFocus()
    })
  })

  describe('axis names', () => {
    test.each([['X-axis label', 'Time (months)'], ['Y-axis label', 'Smitskis owned / Funds ($ x 10)']])(
      '%s is a text field with a visible <label>',
      async (label, value) => {
        const { user } = renderApp()
        const input = screen.getByRole('textbox', { name: label })
        expect(input).toHaveValue(value)
        expect(document.querySelector(`label[for="${input.id}"]`)).toHaveTextContent(label)
        await user.clear(input)
        await user.type(input, 'Edited')
        expect(input).toHaveValue('Edited')
      },
    )
  })

  describe('data series', () => {
    const SERIES = ['Smitskis owned', 'Funds ($ x 10)']

    test.each(SERIES)('"%s" has a named marker select and color input', (name) => {
      renderApp()
      expect(screen.getByRole('combobox', { name: `Marker shape for ${name}` })).toBeInTheDocument()
      expect(screen.getByLabelText(`Color for ${name}`)).toHaveAttribute('type', 'color')
    })

    test('series key glyphs are decorative', () => {
      renderApp()
      for (const key of document.querySelectorAll('.series-key')) expect(key).toHaveAttribute('aria-hidden', 'true')
    })

    test('marker options follow the chart type', async () => {
      const { user } = renderApp()
      const options = () => within(screen.getByRole('combobox', { name: 'Marker shape for Smitskis owned' }))
        .getAllByRole('option').map((o) => o.textContent)
      expect(options()).toEqual(['Circle', 'Square', 'Triangle', 'None'])
      screen.getByRole('button', { name: 'Scatter plot' }).focus()
      await user.keyboard('{Enter}')
      expect(options()).toEqual(['Circle', 'Square', 'Triangle'])
    })

    test('marker shape can be changed from the keyboard', async () => {
      const { user } = renderApp()
      const select = screen.getByRole('combobox', { name: 'Marker shape for Funds ($ x 10)' })
      select.focus()
      await user.selectOptions(select, 'Triangle')
      expect(select).toHaveValue('triangle')
    })

    test('color can be changed', () => {
      renderApp()
      const color = screen.getByLabelText('Color for Smitskis owned')
      fireEvent.input(color, { target: { value: '#123456' } })
      expect(color).toHaveValue('#123456')
    })

    test('series without a color expose a named warning and a keyboard-operable Plot button', async () => {
      const { user } = renderApp()
      await importWithKeyboard(user, csvFile('many.csv', seriesCsv(12)))
      const warning = screen.getByRole('img', { name: 'Not plotted: needs an explicit color' })
      expect(warning.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      const plot = screen.getByRole('button', { name: 'Plot Series 12' })
      expect(screen.getByLabelText('Color for Series 12')).toBeInTheDocument()

      plot.focus()
      await user.keyboard('{Enter}')
      expect(screen.queryByRole('img', { name: 'Not plotted: needs an explicit color' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Plot Series 12' })).not.toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Marker shape for Series 12' })).toBeInTheDocument()
    })

    test('"Show data points" is a switch that shows and hides the point-size slider on line charts', async () => {
      const { user } = renderApp()
      const points = toggle('Show data points')
      expect(points).toHaveAttribute('aria-checked', 'true')
      expect(slider()).toBeInTheDocument()
      points.focus()
      await user.keyboard(' ')
      expect(points).toHaveAttribute('aria-checked', 'false')
      expect(slider()).not.toBeInTheDocument()
      expect(points).toHaveFocus()
    })

    test('scatter plots always show the point-size slider', async () => {
      const { user } = renderApp()
      screen.getByRole('button', { name: 'Scatter plot' }).focus()
      await user.keyboard('{Enter}')
      toggle('Show data points').focus()
      await user.keyboard(' ')
      expect(slider()).toBeInTheDocument()
    })

    test('the point-size slider is labelled, bounded and announces its value', () => {
      renderApp()
      expect(slider()).toHaveAttribute('min', '2')
      expect(slider()).toHaveAttribute('max', '12')
      expect(slider()).toHaveValue('7')
      expect(slider()).toHaveAccessibleName('Point size: 7')
      fireEvent.change(slider(), { target: { value: '9' } })
      expect(slider()).toHaveAccessibleName('Point size: 9')
    })
  })

  test('"Reset to defaults" is keyboard-operable and restores every spec', async () => {
    const { user } = renderApp()
    const title = screen.getByRole('textbox', { name: 'Graph title' })
    await user.clear(title)
    await user.type(title, 'Changed')
    toggle('Add subtitle').focus()
    await user.keyboard(' ')

    const reset = screen.getByRole('button', { name: 'Reset to defaults' })
    expect(reset.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    reset.focus()
    await user.keyboard('{Enter}')
    expect(title).toHaveValue('My Growing Smitski Collection')
    expect(toggle('Add subtitle')).toHaveAttribute('aria-checked', 'true')
    expect(reset).toHaveFocus()
  })
})
