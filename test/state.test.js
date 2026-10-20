import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDelimited, initialState, seriesFromColumns, MORE_COLORS, SERIES_STYLES } from '../src/state.js'
import { MAX_AUTO_COLORS, withSeriesColors } from '../src/graph/colors.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { describeIssue, findIssues, isWarning } from '../src/importFeedback.js'

test('keeps whitespace-only cells missing and preserves zero and original invalid text in diagnostics', () => {
  for (const delimiter of [',', ';', '\t']) {
    const text = [
      ['X', 'A', 'B'],
      ['1', '   ', '0'],
      ['2', '" \t "', '" padded "'],
      ['   ', '20', '30'],
      ['3', ' 4 ', '#N/A'],
    ].map(row => row.join(delimiter)).join('\n')
    const parsed = parseDelimited(text)
    assert.deepEqual(parsed.rows, [[1, Infinity, 0], [2, Infinity, Infinity], [3, 4, -Infinity]])
    assert.deepEqual(parsed.issues, [
      ['invalid-x', [2]], ['invalid-number', [[2, 1, ' padded ']]], ['empty-cell', [[1, 0], [1, 1]]],
    ])
  }
})

test('whitespace CSV cells create gaps and missing-X warnings without zero points', () => {
  const parsed = parseDelimited('X,A\n1,10\n2,   \n   ,20\n3,30\n4,0')
  const state = {
    ...initialState, ...parsed, parseIssues: parsed.issues,
    series: seriesFromColumns(parsed.columns),
  }
  assert.deepEqual(findIssues(state), [['invalid-x', [2]], ['empty-cell', [[1, 1]]]])
  const line = prepareChart(state)
  assert.equal(line.pointCount, 3)
  assert.deepEqual(Array.from(line.graphProps.columns.x, (x, i) => ({ x, y: line.graphProps.columns.ys[0][i] })), [
    { x: 1, y: 10 }, { x: 2, y: Infinity }, { x: 3, y: 30 }, { x: 4, y: 0 },
  ])
  const { columns } = prepareChart({ ...state, chartType: 'scatter' }).graphProps
  assert.deepEqual(Array.from(columns.x, (x, i) => ({ x, y: columns.ys[0][i] })).filter(p => Number.isFinite(p.y)), [
    { x: 1, y: 10 }, { x: 3, y: 30 }, { x: 4, y: 0 },
  ])
})

test('keeps quoted commas in one field without shifting later values', () => {
  const parsed = parseDelimited('X,A,B\n2,"1,010",905')

  assert.deepEqual(parsed.rows, [[2, 1010, 905]])
  assert.deepEqual(parsed.issues, [])
  assert.equal(parsed.delimiter, ',')
})

test('preserves quoted newlines, escaped quotes and spaces inside fields', () => {
  const parsed = parseDelimited('X,A,B\n1,"first\nsecond","say ""hi"""\n2," padded ",3')

  assert.deepEqual(parsed.rows, [[1, Infinity, Infinity], [2, Infinity, 3]])
  assert.deepEqual(parsed.issues, [['invalid-number', [
    [1, 0, 'first\nsecond'], [2, 0, 'say "hi"'], [1, 1, ' padded '],
  ]]])
})

test('detects semicolon and tab delimiters', () => {
  for (const delimiter of [';', '\t']) {
    const parsed = parseDelimited(`X${delimiter}A\n1${delimiter}2\n3${delimiter}4`)

    assert.equal(parsed.delimiter, delimiter)
    assert.deepEqual(parsed.columns, [{ key: 'c0', name: 'X' }, { key: 'c1', name: 'A' }])
    assert.deepEqual(parsed.rows, [[1, 2], [3, 4]])
    assert.deepEqual(parsed.issues, [])
  }
})

test('retains numeric first rows and the existing numeric conversion', () => {
  const parsed = parseDelimited('1,0x10,2e2\n2,,#N/A')

  assert.deepEqual(parsed.columns.map(({ name }) => name), ['Column 1', 'Column 2', 'Column 3'])
  assert.deepEqual(parsed.rows, [[1, 16, 200], [2, Infinity, -Infinity]])
  assert.deepEqual(parsed.issues, [['empty-cell', [[1, 1]]]])
})

test('keeps duplicate header names without renaming or dropping columns', () => {
  const parsed = parseDelimited('X,A,A\n1,2,3')

  assert.deepEqual(parsed.columns, [
    { key: 'c0', name: 'X' }, { key: 'c1', name: 'A' }, { key: 'c2', name: 'A' },
  ])
  assert.deepEqual(parsed.rows, [[1, 2, 3]])
  assert.deepEqual(parsed.issues, [['duplicate-header', [1, 2]]])
})

test('reports short and long rows before padding or trimming them', () => {
  const parsed = parseDelimited('X,A,B\n1,2\n2,3,4,5\n3,4,5,\n4,5,6')

  assert.deepEqual(parsed.issues, [['TooFewFields', [0]], ['TooManyFields', [1]], ['empty-cell', [[2, 0]]]])
  assert.deepEqual(parsed.rows, [[1, 2, Infinity], [2, 3, 4], [3, 4, 5], [4, 5, 6]])
})

test('skips blank records without dropping zero values or creating trailing rows', () => {
  const parsed = parseDelimited('X,A\r\n0,0\r\n\r\n1,2\r\n \t \r\n,,\r\n')

  assert.deepEqual(parsed.rows, [[0, 0], [1, 2]])
  assert.deepEqual(parsed.issues, [])
  assert.equal(parseDelimited(' \n\t\r\n,,\n'), null)
})

test('reports malformed quotes alongside row-width issues', () => {
  const parsed = parseDelimited('X,A,B\n1,2\n2,"broken')

  assert.deepEqual(parsed.issues, [
    ['TooFewFields', [0, 1]], ['MissingQuotes', [1]],
    ['invalid-number', [[1, 1, 'broken']]], ['empty-cell', [[2, 0], [2, 1]]],
  ])
})

test('groups repeated Papa errors by code using data-row positions', () => {
  const parsed = parseDelimited('X,Y\n\n1,"a"b\n2,"c"d')

  assert.deepEqual(parsed.issues, [
    ['InvalidQuotes', [0, 0, 0]],
    ['MissingQuotes', [0]],
    ['invalid-number', [[1, 0, 'a"b\n2,"c"d']]],
  ])
})

test('maps errors past leading blanks, a header, and a multiline record to source data rows', () => {
  const parsed = parseDelimited('\n \nX,Y,Z\n1,"first\nsecond",3\n\n2,"broken')

  assert.deepEqual(parsed.rows, [[1, Infinity, 3], [2, Infinity, Infinity]])
  assert.deepEqual(parsed.issues, [
    ['TooFewFields', [1]], ['MissingQuotes', [1]],
    ['invalid-number', [[1, 0, 'first\nsecond'], [1, 1, 'broken']]], ['empty-cell', [[2, 1]]],
  ])
})

test('uses the same row indexes without a header', () => {
  const parsed = parseDelimited('\n1,2,3\n\n2,"broken')

  assert.deepEqual(parsed.rows, [[1, 2, 3], [2, Infinity, Infinity]])
  assert.deepEqual(parsed.issues, [
    ['TooFewFields', [1]], ['MissingQuotes', [1]],
    ['invalid-number', [[1, 1, 'broken']]], ['empty-cell', [[2, 1]]],
  ])
})

test('reports a malformed header as a count rather than a data-row position', () => {
  const parsed = parseDelimited('X,"broken')

  assert.deepEqual(parsed.rows, [])
  assert.deepEqual(parsed.issues, [['MissingQuotes', 1]])
})

test('records delimiter errors without inventing a row position', () => {
  const parsed = parseDelimited('X\n1\n2')

  assert.deepEqual(parsed.issues, [['UndetectableDelimiter', 1]])
  assert.equal(parsed.delimiter, ',')
})

test('every column becomes a series, colored automatically up to the limit', () => {
  const columns = Array.from({ length: 14 }, (_, c) => ({ key: `c${c}`, name: c ? `S${c}` : 'X' }))
  const series = seriesFromColumns(columns)
  assert.equal(series.length, 13)
  assert.deepEqual(series.map((s) => s.columnIndex), Array.from({ length: 13 }, (_, i) => i + 1))
  const colored = series.slice(0, MAX_AUTO_COLORS)
  assert.equal(new Set(colored.map((s) => s.color)).size, MAX_AUTO_COLORS)
  assert.ok(series.slice(MAX_AUTO_COLORS).every((s) => s.color === undefined))
  SERIES_STYLES.forEach((style, i) => assert.deepEqual({ color: series[i].color, dash: series[i].dash, marker: series[i].marker }, style))
  assert.ok(series.slice(3).every((s) => s.dash === '' && s.marker === 'circle'))
})

test('the sample data keeps its original series styles', () => {
  assert.deepEqual(initialState.series.map(({ color, dash, marker }) => ({ color, dash, marker })), SERIES_STYLES.slice(0, 2))
})

test('the stored colors are what the color picker chooses after the fixed styles', () => {
  assert.equal(SERIES_STYLES.length + MORE_COLORS.length, MAX_AUTO_COLORS)
  const picked = withSeriesColors([...SERIES_STYLES.map(({ color }) => ({ color })), ...MORE_COLORS.map(() => ({}))])
  assert.deepEqual(picked.slice(SERIES_STYLES.length).map((s) => s.color), MORE_COLORS)
})

test('series past the limit are not plotted and the import messages say why', () => {
  const header = ['X', ...Array.from({ length: 13 }, (_, s) => `S${s + 1}`)].join(',')
  const parsed = parseDelimited(`${header}\n1,${Array(13).fill(1).join(',')}\n2,${Array(13).fill(2).join(',')}`)
  const state = { ...initialState, ...parsed, parseIssues: parsed.issues, series: seriesFromColumns(parsed.columns) }
  const { graphProps, pointCount } = prepareChart(state)
  assert.equal(graphProps.series.length, MAX_AUTO_COLORS)
  assert.equal(pointCount, 2 * MAX_AUTO_COLORS)
  const issues = findIssues(state)
  assert.deepEqual(issues, [['needs-color', 2]])
  assert.equal(describeIssue(issues[0], state), 'Series after the first 11 need an explicit color: 2 series not plotted.')
  assert.equal(isWarning(issues[0]), true)
  const withColor = { ...state, series: state.series.map((s, i) => (i === MAX_AUTO_COLORS ? { ...s, color: '#123456' } : s)) }
  assert.equal(prepareChart(withColor).graphProps.series.length, MAX_AUTO_COLORS + 1)
  assert.deepEqual(findIssues(withColor), [['needs-color', 1]])
})
