// Single source of truth for the graph editor. App.jsx owns this state and
// passes slices + handlers down to the panels.

export const SERIES_COLORS = ['#26734b', '#9fbc74']

export const DEFAULT_COLUMNS = [
  { key: 'c0', name: 'Month' },
  { key: 'c1', name: 'Smitskis' },
  { key: 'c2', name: '$ x 10' },
]

export const DEFAULT_ROWS = [
  [0, 4, 40],
  [2, 6, 38],
  [4, 10, 34],
  [6, 14, 30],
  [8, 18, 26],
  [10, 25, 14],
  [12, 29, 6],
  [14, 35, 1],
]

// Appearance settings that "Reset to defaults" restores.
export const DEFAULT_SPECS = {
  title: 'My Growing Smitski Collection',
  subtitle: 'Ts is definitely not an addiction...',
  showSubtitle: true,
  xColumn: 0, // index into columns
  yMode: 'both', // 'both' | series id
  xLabel: 'Time (months)',
  yLabel: '# [Smitskis Owned + Dollars]',
  series: [
    {
      id: 's1',
      columnIndex: 1,
      name: 'Smitskis',
      legendLabel: 'Smitskis',
      color: SERIES_COLORS[0],
      width: 2,
    },
    {
      id: 's2',
      columnIndex: 2,
      name: 'Funds',
      legendLabel: 'Funds (Measured in Increments of 10)',
      color: SERIES_COLORS[1],
      width: 2,
    },
  ],
  showPoints: true,
  gridlines: true,
  legend: true,
}

export const initialState = {
  graphName: 'How Many Smitskis I Own',
  chartType: 'line', // 'line' | 'scatter'
  columns: DEFAULT_COLUMNS,
  rows: DEFAULT_ROWS,
  selectedCell: { row: 3, col: 1 },
  exportFormat: 'png', // 'png' | 'svg' | 'pdf'
  resolution: '2x', // '1x' | '2x' | '3x'
  ...DEFAULT_SPECS,
}

export const LINE_WIDTHS = [1, 2, 3, 4]
export const RESOLUTIONS = ['1x', '2x', '3x']
export const EXPORT_FORMATS = ['png', 'svg', 'pdf']

/** Parse a cell string into a number, or return '' for empty. */
export function parseCell(value) {
  if (value === '' || value === null || value === undefined) return ''
  const n = Number(value)
  return Number.isFinite(n) ? n : String(value)
}

/** True when every cell in every row is a finite number. */
export function allValuesValid(rows) {
  return rows.every((r) => r.every((v) => typeof v === 'number' && Number.isFinite(v)))
}

/** Parse pasted / uploaded delimited text (CSV, TSV) into { columns, rows }. */
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
  const rows = body.map((l) => {
    const cells = split(l).map(parseCell)
    while (cells.length < columns.length) cells.push('')
    return cells.slice(0, columns.length)
  })
  return { columns, rows }
}
