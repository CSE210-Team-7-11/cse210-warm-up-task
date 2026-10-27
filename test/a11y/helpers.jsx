import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App.jsx'

/** Render the full editor; returns a user-event instance for keyboard input. */
export function renderApp(userOptions) {
  const user = userEvent.setup(userOptions)
  return { user, ...render(<App />) }
}

export const csvFile = (name, text) => new File([text], name, { type: 'text/csv' })

export const fileInput = () => document.querySelector('input[type="file"]')
export const dropzone = () => screen.getByRole('button', { name: /^Drop a file or browse/ })
export const dataSummary = () => document.querySelector('.data-panel-summary')
export const chartImage = () => screen.getByRole('img', { name: /plot of \d+ points/ })

/** Import a file the way a keyboard user would: focus the drop zone, press Enter, pick the file. */
export async function importWithKeyboard(user, file) {
  dropzone().focus()
  await user.keyboard('{Enter}')
  await user.upload(fileInput(), file)
  await waitFor(() => {
    const imported = dataSummary().textContent.startsWith(file.name)
    const rejected = screen.queryByRole('alert')
    if (!imported && !rejected) throw new Error(`${file.name} was neither imported nor rejected`)
  })
}

/** CSV with an X column plus `count` series. */
export function seriesCsv(count, name = (i) => `Series ${i + 1}`) {
  const header = ['x', ...Array.from({ length: count }, (_, i) => name(i))].join(',')
  const rows = [1, 2, 3].map((x) => [x, ...Array.from({ length: count }, (_, i) => x * (i + 1))].join(','))
  return [header, ...rows].join('\n')
}
