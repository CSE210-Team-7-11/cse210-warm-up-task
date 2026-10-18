// Single source of truth for the graph editor. App.jsx owns this state and
// passes slices + handlers down to the panels.
//
// The data table is read-only in the UI: data comes from the sample below or
// from a dropped CSV/TSV file. Column 0 is always the X axis; every other
// column (up to MAX_SERIES) is plotted as a series.

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
  const n = Number(value)
  return Number.isFinite(n) ? n : String(value)
}

/**
 * Parse uploaded delimited text (CSV, TSV) into { columns, rows, issues }.
 * Rows are padded or cut to the header's width; `issues` lists the row
 * indexes that changed, as [['TooFewFields', [..]], ['TooManyFields', [..]]].
 * Dropping only empty trailing fields (e.g. "1,2,") is not reported.
 */
export function parseDelimited(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  const delim = lines[0].includes('\t') ? '\t' : ','
  const split = (l) => l.split(delim).map((s) => s.trim().replace(/^"|"$/g, ''))
  const first = split(lines[0])
  const headerIsText = first.some((v) => v !== '' && !Number.isFinite(Number(v)))
  const columns = headerIsText
    ? first.map((name, i) => ({ key: `c${i}`, name }))
    : first.map((_, i) => ({ key: `c${i}`, name: `Column ${i + 1}` }))
  const body = headerIsText ? lines.slice(1) : lines
  const tooFew = []
  const tooMany = []
  const rows = body.map((l, r) => {
    const cells = split(l).map(parseCell)
    if (cells.length < columns.length) tooFew.push(r)
    if (cells.slice(columns.length).some((v) => v !== '')) tooMany.push(r)
    while (cells.length < columns.length) cells.push('')
    return cells.slice(0, columns.length)
  })
  const issues = []
  if (tooFew.length) issues.push(['TooFewFields', tooFew])
  if (tooMany.length) issues.push(['TooManyFields', tooMany])
  return { columns, rows, issues }
}
