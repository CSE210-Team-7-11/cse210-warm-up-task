// Single source of truth for the graph editor. App.jsx owns this state and
// passes slices + handlers down to the panels.
//
// The data table is read-only in the UI: data comes from the sample below or
// from a dropped CSV/TSV file. Column 0 is X; every other column is a series.

import Papa from 'papaparse'
import { resolveNumberFormat } from './numberFormat.js'
import { createRowParser, readHeader } from './importRows.js'

export { parseCell } from './numberFormat.js'
export { importFile } from './fileImport.js'

/**
 * Colorblind-safe series styles (validated for red-green colorblindness on a
 * white surface, all pairs, so they also work for scatter plots).
 * Color is never the only cue: each series also gets its own line dash and
 * scatter marker shape, so charts still read in grayscale or for CVD users.
 */
export const SERIES_STYLES = [
  { color: '#2a78d6', dash: '', marker: 'circle' }, // blue, solid
  { color: '#eb6834', dash: '6 4', marker: 'square' }, // orange, dashed
  { color: '#1baf7a', dash: '2 3', marker: 'triangle' }, // aqua, dotted
]

// Precomputed so imports don't run the color picker.
export const MORE_COLORS = ['#940069', '#d794fb', '#436300', '#5a08c4', '#de22a7', '#d2b200', '#cf003a', '#0000ff']

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
  return columns.slice(1).map((c, i) => ({
    id: `s${i + 1}`,
    columnIndex: i + 1,
    name: c.name,
    color: MORE_COLORS[i - SERIES_STYLES.length],
    dash: '',
    marker: 'circle',
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
  emptyCells: 'gap',
  // Import issues.
  parseIssues: [],
  ...DEFAULT_SPECS,
}

// Parse delimited text into numeric rows and import issues. Returns null if empty.
// numberFormat is 'auto', '.' or ','; the result includes the resolved separator.
// emptyCells only applies to Y cells.
// Issue positions refer to source data records, excluding headers and blanks.
export function parseDelimited(text, { numberFormat: requestedFormat = 'auto', emptyCells: emptyCellMode = 'gap' } = {}) {
  if (!['auto', '.', ','].includes(requestedFormat)) {
    throw new TypeError('numberFormat must be "auto", ".", or ",".')
  }
  if (!['gap', 'zero', 'connect', 'mark'].includes(emptyCellMode)) {
    throw new TypeError('emptyCells must be "gap", "zero", "connect", or "mark".')
  }
  const result = Papa.parse(text, {
    header: false,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
  })
  // Keep malformed empty records so their parse errors aren't lost.
  if (result.data.length === 0 && result.errors.every(({ code }) => code === 'UndetectableDelimiter')) return null
  const first = result.data[0] ?? []
  const { columns, headerIsText } = readHeader(first)
  const body = headerIsText ? result.data.slice(1) : result.data
  const { numberFormat, issues: formatIssues } = resolveNumberFormat(body, columns.length, requestedFormat)
  const rows = []
  const parser = createRowParser(columns, { numberFormat, emptyCells: emptyCellMode, headerIsText, onRow: row => rows.push(row) })
  parser.addRows(body)
  const parseIssues = []
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
    if (code === 'UndetectableDelimiter' && columns.length > 1) continue
    if (!parseErrors.has(code)) parseErrors.set(code, { rows: [], count: 0 })
    const error = parseErrors.get(code)
    error.count++
    const dataRow = errorRowIndexes.get(row)
    if (dataRow !== undefined) error.rows.push(dataRow)
  }
  for (const [code, { rows, count }] of parseErrors) {
    parseIssues.push([code, rows.length === count ? rows : count])
  }
  const issues = parser.finish({ parseIssues, formatIssues })
  return { columns, rows, issues, delimiter: result.meta.delimiter, numberFormat }
}
