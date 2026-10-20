// Single source of truth for the graph editor. App.jsx owns this state and
// passes slices + handlers down to the panels.
//
// The data table is read-only in the UI: data comes from the sample below or
// from a dropped CSV/TSV file. Column 0 is X; every other column is a series.

import Papa from 'papaparse'
import { isEmptyCell, isNumericOverflow, parseCell, resolveNumberFormat } from './numberFormat.js'
import { Float64OverflowError, throwOverflowErrors } from './numericErrors.js'
import { losesFloat64Precision } from './precision.js'
import { addDiagnostic, createDiagnostics } from './diagnostics.js'

export { parseCell } from './numberFormat.js'

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
  // Check both number formats when detecting a header.
  const headerIsText = first.some((v) => parseCell(v, '.') === null && parseCell(v, ',') === null &&
    !isNumericOverflow(v, '.') && !isNumericOverflow(v, ','))
  const columns = headerIsText
    ? first.map((name, i) => ({ key: `c${i}`, name }))
    : first.map((_, i) => ({ key: `c${i}`, name: `Column ${i + 1}` }))
  const body = headerIsText ? result.data.slice(1) : result.data
  const { numberFormat, issues: formatIssues } = resolveNumberFormat(body, columns.length, requestedFormat)
  const tooFew = []
  const tooMany = []
  const invalidX = []
  const invalidNumbers = []
  const emptyCells = []
  const rows = []
  const overflowErrors = createDiagnostics()
  const precisionChanges = createDiagnostics()
  function importedCell(value, c, r, recordPrecision = true) {
    const parsed = parseCell(value, numberFormat, { emptyCells: c === 0 ? 'gap' : emptyCellMode })
    if (parsed === null && isNumericOverflow(value, numberFormat)) {
      addDiagnostic(overflowErrors, () => new Float64OverflowError(String(value).trim(), columns[c].name, { sourceRow: r }))
    }
    if (recordPrecision && !isEmptyCell(value) && Number.isFinite(parsed) && losesFloat64Precision(value, parsed, numberFormat)) {
      addDiagnostic(precisionChanges, () => [c, r, value, parsed])
    }
    return parsed
  }
  body.forEach((row, r) => {
    if (overflowErrors.count) {
      for (let c = 0; c < columns.length; c++) {
        if (isNumericOverflow(row[c], numberFormat)) {
          addDiagnostic(overflowErrors, () => new Float64OverflowError(String(row[c]).trim(), columns[c].name, { sourceRow: r }))
        }
      }
      return
    }
    if (row.length < columns.length) tooFew.push(r)
    if (row.slice(columns.length).some((v) => !isEmptyCell(v))) tooMany.push(r)
    const x = importedCell(row[0], 0, r)
    if (!Number.isFinite(x)) {
      for (let c = 1; c < columns.length; c++) importedCell(row[c], c, r, false)
      invalidX.push(r)
      return
    }
    const cells = [x]
    for (let c = 1; c < columns.length; c++) {
      const value = row[c]
      const parsed = importedCell(value, c, r)
      if (parsed === null) invalidNumbers.push([c, r, value])
      else if (isEmptyCell(value) && emptyCellMode !== 'zero') emptyCells.push([c, r])
      cells.push(parsed === null ? Infinity : parsed)
    }
    rows.push(cells)
  })
  throwOverflowErrors(overflowErrors)
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
  issues.push(...formatIssues)
  if (invalidX.length) issues.push(['invalid-x', invalidX])
  if (invalidNumbers.length) issues.push(['invalid-number', invalidNumbers])
  if (emptyCells.length) issues.push(['empty-cell', emptyCells])
  if (precisionChanges.count) issues.push(['precision-loss', precisionChanges.items])
  if (precisionChanges.count > precisionChanges.items.length) {
    issues.push(['precision-loss-truncated', precisionChanges.count - precisionChanges.items.length])
  }
  if (headerIsText) {
    const names = new Map()
    columns.forEach(({ name }, c) => {
      if (!names.has(name)) names.set(name, [])
      names.get(name).push(c)
    })
    const duplicates = [...names.values()]
      .filter((indexes) => indexes.length > 1)
      .flat()
      .sort((a, b) => a - b)
    if (duplicates.length) issues.push(['duplicate-header', duplicates])
  }
  return { columns, rows, issues, delimiter: result.meta.delimiter, numberFormat }
}
