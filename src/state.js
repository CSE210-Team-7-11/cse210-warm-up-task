// Single source of truth for the graph editor. App.jsx owns this state and
// passes slices + handlers down to the panels.
//
// The data table is read-only in the UI: data comes from the sample below or
// from a dropped CSV/TSV file. Column 0 is always the X axis; every other
// column (up to MAX_SERIES) is plotted as a series.

import Papa from 'papaparse'

/**
 * Colorblind-safe series styles (validated for red-green colorblindness on a
 * white surface, all pairs, so they also work for scatter plots).
 * Color is never the only cue: each series also gets its own line dash and
 * scatter marker shape, so charts still read in grayscale or for CVD users.
 * Don't cycle these — past MAX_SERIES, extra columns are not plotted.
 */
export const SERIES_STYLES = [
  { color: '#2a78d6', dash: '', marker: 'circle' }, // blue, solid
  { color: '#eb6834', dash: '6 4', marker: 'square' }, // orange, dashed
  { color: '#1baf7a', dash: '2 3', marker: 'triangle' }, // aqua, dotted
]
export const MAX_SERIES = SERIES_STYLES.length

// Sample dataset — one year of an (allegedly) healthy hobby. Smitskis owned
// climbs (with sprees in month 9 and 12) while funds drain, with small payday
// bumps in months 5 and 10. Noisy enough to read as a scatter, with a clear
// story as a line graph.
export const DEFAULT_COLUMNS = [
  { key: 'c0', name: 'Month' },
  { key: 'c1', name: 'Smitskis owned' },
  { key: 'c2', name: 'Funds ($ x 10)' },
]

export const DEFAULT_ROWS = [
  [1, 2, 40],
  [2, 3, 37],
  [3, 5, 35],
  [4, 8, 30],
  [5, 9, 31],
  [6, 12, 26],
  [7, 15, 22],
  [8, 17, 20],
  [9, 22, 13],
  [10, 24, 14],
  [11, 29, 8],
  [12, 35, 3],
]

/** Build the series list from the table's columns (column 0 is X). */
export function seriesFromColumns(columns) {
  return columns.slice(1, 1 + MAX_SERIES).map((c, i) => ({
    id: `s${i + 1}`,
    columnIndex: i + 1,
    name: c.name,
    ...SERIES_STYLES[i],
  }))
}

// Text and display settings that "Reset to defaults" restores.
export const DEFAULT_SPECS = {
  title: 'My Growing Smitski Collection',
  subtitle: 'Ts is definitely not an addiction...',
  showSubtitle: true,
  xLabel: 'Time (months)',
  yLabel: 'Smitskis owned / Funds ($ x 10)',
  showPoints: true,
  pointSize: 7,
}

export const initialState = {
  graphName: 'How Many Smitskis I Own',
  chartType: 'line', // 'line' | 'scatter'
  sourceName: 'Sample data',
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_ROWS,
  series: seriesFromColumns(DEFAULT_COLUMNS),
  // Issues only the parser can see (e.g. TooFewFields); cell issues are derived from rows.
  parseIssues: [],
  ...DEFAULT_SPECS,
}

/** Parse a cell string into a number, or return '' for empty. */
export function parseCell(value) {
  if (value === '' || value === null || value === undefined) return ''
  // Papa preserves whitespace; blank cells must stay missing, not become zero.
  if (typeof value === 'string' && value.trim() === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? n : String(value)
}

/**
 * Parse uploaded delimited text (CSV, TSV, semicolon-separated).
 * Returns { columns, rows, issues, delimiter }, or null for empty input.
 * Issues are in the form [type, data] (ADR-0007), with Papa error codes for parse errors.
 * Row positions always index the returned `rows` array (0-based).
 * Errors outside the data rows, including header errors, carry a count instead.
 * Rows are padded or cut to the header's width, reporting TooFewFields or TooManyFields.
 * Dropping only empty trailing fields (e.g. "1,2,") is not reported.
 */
export function parseDelimited(text) {
  const result = Papa.parse(text, {
    header: false,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
  })
  if (result.data.length === 0) return null
  const first = result.data[0]
  const headerIsText = first.some((v) => v !== '' && !Number.isFinite(Number(v)))
  const columns = headerIsText
    ? first.map((name, i) => ({ key: `c${i}`, name }))
    : first.map((_, i) => ({ key: `c${i}`, name: `Column ${i + 1}` }))
  const body = headerIsText ? result.data.slice(1) : result.data
  const tooFew = []
  const tooMany = []
  const rows = body.map((row, r) => {
    const cells = row.map(parseCell)
    if (cells.length < columns.length) tooFew.push(r)
    if (cells.slice(columns.length).some((v) => v !== '')) tooMany.push(r)
    while (cells.length < columns.length) cells.push('')
    return cells.slice(0, columns.length)
  })
  const issues = []
  if (tooFew.length) issues.push(['TooFewFields', tooFew])
  if (tooMany.length) issues.push(['TooManyFields', tooMany])
  const errorRowIndexes = new Map()
  if (result.errors.some(({ row }) => Number.isInteger(row))) {
    // Papa removes blank records but leaves error indexes unchanged. Only
    // malformed input needs this extra pass, retaining blanks to map indexes.
    const records = Papa.parse(text, {
      header: false,
      dynamicTyping: false,
      delimiter: result.meta.delimiter,
      skipEmptyLines: false,
    }).data
    let dataRow = headerIsText ? -1 : 0
    records.forEach((record, sourceRow) => {
      if (record.join('').trim() === '') return
      if (dataRow >= 0) errorRowIndexes.set(sourceRow, dataRow)
      dataRow++
    })
  }
  const parseErrors = new Map()
  for (const { code, row } of result.errors) {
    if (!parseErrors.has(code)) parseErrors.set(code, { rows: [], count: 0 })
    const error = parseErrors.get(code)
    error.count++
    const dataRow = errorRowIndexes.get(row)
    if (dataRow !== undefined) error.rows.push(dataRow)
  }
  for (const [code, { rows, count }] of parseErrors) {
    issues.push([code, rows.length === count ? rows : count])
  }
  return { columns, rows, issues, delimiter: result.meta.delimiter }
}
