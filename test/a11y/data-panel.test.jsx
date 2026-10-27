import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { csvFile, dataSummary, dropzone, fileInput, importWithKeyboard, renderApp } from './helpers.jsx'

const panel = () => screen.getByRole('region', { name: /Add your data/ })
const statusRegion = () => within(panel()).getAllByRole('status')[0]

describe('Step 02: data panel', () => {
  test('is a named region', () => {
    renderApp()
    expect(panel()).toContainElement(dropzone())
  })

  describe('drop zone (custom role="button")', () => {
    test('is a focusable, named button in the tab order', () => {
      renderApp()
      expect(dropzone()).toHaveAttribute('tabindex', '0')
      expect(dropzone().querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    })

    test('its accessible name contains its visible label, so voice control users can say it (WCAG 2.5.3)', () => {
      renderApp()
      const visible = dropzone().querySelector('.data-panel-dropzone-title').textContent
      expect(dropzone()).toHaveAccessibleName(expect.stringContaining(visible))
    })

    test.each([['Enter', '{Enter}'], ['Space', ' ']])('%s opens the file picker', async (_, key) => {
      const { user } = renderApp()
      const click = vi.spyOn(fileInput(), 'click')
      dropzone().focus()
      await user.keyboard(key)
      // The input's click bubbles to the drop zone, which calls click() again;
      // browsers ignore that nested call, so e2e/ asserts a single file chooser.
      expect(click).toHaveBeenCalled()
    })

    test.each(['Enter', ' '])('"%s" prevents the default action so Space does not scroll the page', (key) => {
      renderApp()
      const notPrevented = fireEvent.keyDown(dropzone(), { key })
      expect(notPrevented).toBe(false)
    })

    test.each(['a', '{Escape}', '{ArrowDown}'])('other keys (%s) do nothing', async (key) => {
      const { user } = renderApp()
      const click = vi.spyOn(fileInput(), 'click')
      dropzone().focus()
      await user.keyboard(key)
      expect(click).not.toHaveBeenCalled()
    })

    test('the native file input is hidden and out of the tab order', () => {
      renderApp()
      expect(fileInput()).toHaveAttribute('tabindex', '-1')
      expect(fileInput()).not.toBeVisible()
    })
  })

  describe('keyboard import', () => {
    test('importing a valid file keeps focus on the drop zone and announces the result', async () => {
      const { user } = renderApp()
      await importWithKeyboard(user, csvFile('sales.csv', 'day,sales\n1,4\n2,8\n3,6'))
      expect(dataSummary()).toHaveTextContent('sales.csv · 3 rows · 1 series')
      expect(dropzone()).toHaveFocus()
      expect(statusRegion()).toHaveTextContent('Looking good. All values are valid.')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test.each([
      ['notes.png', 'x', 'notes.png isn’t a CSV, TSV or TXT file.'],
      ['book.xlsx', 'x', 'book.xlsx is an Excel file. Save it as CSV, then drop the CSV here.'],
      ['empty.csv', '', 'empty.csv is empty.'],
      ['one.csv', 'x\n1\n2', 'one.csv has only one column.'],
    ])('rejecting %s is announced as an alert', async (name, text, message) => {
      const { user } = renderApp({ applyAccept: false })
      await importWithKeyboard(user, csvFile(name, text))
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(message)
      expect(alert).toHaveTextContent('Your current data is unchanged.')
      expect(dataSummary()).toHaveTextContent('Sample data')
      expect(dropzone()).toHaveFocus()
    })

    test('the alert clears after a successful import', async () => {
      const { user } = renderApp({ applyAccept: false })
      await importWithKeyboard(user, csvFile('notes.png', 'x'))
      expect(screen.getByRole('alert')).toBeInTheDocument()
      await importWithKeyboard(user, csvFile('ok.csv', 'x,y\n1,2\n2,3'))
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    })

    test('data warnings are announced in the status region', async () => {
      const { user } = renderApp()
      await importWithKeyboard(user, csvFile('bad.csv', 'x,y\n1,2\n2,abc\n3,4'))
      expect(statusRegion()).toHaveTextContent('1 nonnumeric value: "abc" in row 2 (y). Replace with numbers.')
      expect(statusRegion()).not.toHaveTextContent('Looking good')
    })

    test('empty-cell notes are announced in the status region', async () => {
      const { user } = renderApp()
      await importWithKeyboard(user, csvFile('gaps.csv', 'x,y\n1,2\n2,\n3,4'))
      expect(statusRegion()).toHaveTextContent('1 empty cell: row 2 (y).')
    })

    test('precision loss is announced as a status list', async () => {
      const { user } = renderApp()
      await importWithKeyboard(user, csvFile('big.csv', 'x,y\n1,9007199254740993\n2,3'))
      const precision = within(panel()).getByText(/value was rounded/).closest('[role="status"]')
      expect(precision).toBeInTheDocument()
      expect(within(precision).getByRole('list')).toHaveTextContent('9007199254740993')
    })
  })

  describe('empty cells select', () => {
    const select = () => screen.getByRole('combobox', { name: 'Empty cells' })

    test('is a named native select with every option', () => {
      renderApp()
      expect(within(select()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Gap', 'Zero', 'Connect'])
      expect(select()).toHaveValue('gap')
      // The visible text label is hidden so it isn't announced twice.
      expect(within(panel()).getByText('Empty cells', { selector: 'span' })).toHaveAttribute('aria-hidden', 'true')
      expect(select().closest('.select').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    })

    test('can be focused and changed from the keyboard', async () => {
      const { user } = renderApp()
      await user.tab()
      await user.tab()
      await user.tab()
      await user.tab()
      expect(select()).toHaveFocus()
      await user.selectOptions(select(), 'Connect')
      expect(select()).toHaveValue('connect')
      expect(select()).toHaveFocus()
    })

    test('"Zero" hides the empty-cell note because the cells are now plotted', async () => {
      const { user } = renderApp()
      await importWithKeyboard(user, csvFile('gaps.csv', 'x,y\n1,2\n2,\n3,4'))
      await user.selectOptions(select(), 'Zero')
      expect(statusRegion()).not.toHaveTextContent('empty cell')
    })
  })
})
