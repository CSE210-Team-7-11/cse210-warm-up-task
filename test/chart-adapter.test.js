import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { initialState, seriesFromColumns, parseDelimited } from '../src/state.js'

// each series' values as { x, y } pairs
const seriesPoints = ({ columns }) => columns.ys.map((ys) => Array.from(columns.x, (x, i) => ({ x, y: ys[i] })))

function editorState(rows, overrides = {}) {
  const text = [['Time', 'Trial A', 'Trial B'], ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const parsed = parseDelimited(text)
  return {
    ...initialState,
    ...parsed,
    parseIssues: parsed.issues,
    series: seriesFromColumns(parsed.columns),
    ...overrides,
  }
}

test('keeps each series paired with its values and styles when sorting by x', () => {
  const state = editorState([[2, 20, 200], [1, 10, 100]])
  const { graphProps, pointCount } = prepareChart(state)

  assert.equal(pointCount, 4)
  assert.deepEqual(seriesPoints(graphProps), [
    [{ x: 1, y: 10 }, { x: 2, y: 20 }],
    [{ x: 1, y: 100 }, { x: 2, y: 200 }],
  ])
  for (const [index, series] of graphProps.series.entries()) {
    const { name, color, marker, dash } = state.series[index]
    assert.deepEqual(series, { name, color, marker, dash })
  }
})

test('preserves empty-cell gaps and #N/A skips independently in line series', () => {
  const rows = [[1, 0, 10], [2, '', '#N/A'], [3, 3, 30], ['bad', 99, 99]]
  const { graphProps, pointCount } = prepareChart(editorState(rows, { chartType: 'line' }))

  assert.equal(pointCount, 4)
  assert.deepEqual(seriesPoints(graphProps), [
    [{ x: 1, y: 0 }, { x: 2, y: Infinity }, { x: 3, y: 3 }],
    [{ x: 1, y: 10 }, { x: 2, y: -Infinity }, { x: 3, y: 30 }],
  ])
})

test('scatter keeps missing values in its columns without counting them as points', () => {
  const rows = [[1, 0, 10], [2, '', '#N/A'], [3, 3, 'bad'], ['bad', 99, 99]]
  const scatter = prepareChart(editorState(rows, { chartType: 'scatter' }))

  assert.equal(scatter.pointCount, 3)
  assert.deepEqual(seriesPoints(scatter.graphProps), [
    [{ x: 1, y: 0 }, { x: 2, y: Infinity }, { x: 3, y: 3 }],
    [{ x: 1, y: 10 }, { x: 2, y: -Infinity }, { x: 3, y: Infinity }],
  ])
})

test('retains leading, trailing, and consecutive gaps and skips after sorting', () => {
  const rows = [[5, '', 50], [2, null, 20], [3, undefined, 30], [1, '#N/A', 10], [4, 4, ' #N/A '], [6, '', 60]]
  const { graphProps, pointCount } = prepareChart(editorState(rows, { chartType: 'line' }))

  assert.equal(pointCount, 6)
  assert.deepEqual(seriesPoints(graphProps)[0], [
    { x: 1, y: -Infinity }, { x: 2, y: Infinity }, { x: 3, y: Infinity },
    { x: 4, y: 4 }, { x: 5, y: Infinity }, { x: 6, y: Infinity },
  ])
  assert.equal(seriesPoints(graphProps)[1][3].y, -Infinity)
})

test('does not count an entirely missing series or remove another series values', () => {
  const rows = [[1, '', 10], [2, '#N/A', 20]]
  const { graphProps, pointCount } = prepareChart(editorState(rows, { chartType: 'line' }))

  assert.equal(pointCount, 2)
  assert.deepEqual(seriesPoints(graphProps), [
    [{ x: 1, y: Infinity }, { x: 2, y: -Infinity }],
    [{ x: 1, y: 10 }, { x: 2, y: 20 }],
  ])
  assert.equal(prepareChart(editorState([[1, '', '#N/A'], [2, '', '#N/A']])).pointCount, 0)
})

test('carries CSV empty cells and #N/A through the existing importer to the chart', () => {
  const { columns, rows } = parseDelimited('X,A,B\n1,10,10\n2,,#N/A\n3,30,30')
  const state = { ...initialState, columns, rows, series: seriesFromColumns(columns) }
  const { graphProps, pointCount } = prepareChart(state)

  assert.equal(pointCount, 4)
  assert.equal(seriesPoints(graphProps)[0][1].y, Infinity)
  assert.equal(seriesPoints(graphProps)[1][1].y, -Infinity)
  assert.deepEqual(prepareChart({ ...state, chartType: 'scatter' }).graphProps.columns.ys.map(ys => ys.length), [3, 3])
})

test('keeps invalid values as breaks instead of treating them as #N/A or zero', () => {
  const rows = [[1, 10, 10], [2, 'bad', 'Infinity'], [3, 30, 30], ['#N/A', 50, 50]]
  const { graphProps, pointCount } = prepareChart(editorState(rows))

  assert.equal(pointCount, 4)
  assert.deepEqual(seriesPoints(graphProps).map(points => points[1]), [{ x: 2, y: Infinity }, { x: 2, y: Infinity }])
})

test('passes chart settings and labels through, including hiding and restoring a subtitle', () => {
  const state = editorState([[1, 2, 3]], {
    chartType: 'scatter', showPoints: false, title: 'Experiment',
    subtitle: 'Run 2', showSubtitle: false, xLabel: 'Time (s)', yLabel: 'Distance (m)',
  })
  const { graphProps } = prepareChart(state)

  assert.equal(graphProps.type, 'scatter')
  assert.equal(graphProps.showPoints, false)
  assert.equal(graphProps.showTrendLine, true)
  assert.deepEqual(graphProps.labels, {
    title: 'Experiment', subtitle: '', x_axis_label: 'Time (s)', y_axis_label: 'Distance (m)',
  })
  assert.equal(prepareChart({ ...state, showSubtitle: true }).graphProps.labels.subtitle, 'Run 2')
})

test('does not mutate source data or round numeric values', () => {
  const state = editorState([[2, 0.1000000001, 4], [1, 2, 3]])
  const before = structuredClone(state)
  Object.freeze(state)
  Object.freeze(state.rows)
  for (const row of state.rows) Object.freeze(row)
  Object.freeze(state.series)
  for (const series of state.series) Object.freeze(series)

  const { graphProps } = prepareChart(state)
  assert.equal(seriesPoints(graphProps)[0][1].y, 0.1000000001)
  assert.deepEqual(state, before)
  graphProps.columns.ys[0][0] = 42
  assert.deepEqual(state, before)
})

test('reports zero and one valid point accurately for the existing preview threshold', () => {
  assert.equal(prepareChart(editorState([])).pointCount, 0)
  assert.equal(prepareChart(editorState([[1, 2, '']])).pointCount, 1)
})

test('converts numeric text before sorting and retains import diagnostics', () => {
  const state = editorState([['2', '1,010', '0'], ['1', '0x10', '1e2'], ['bad', '9', '9']])
  const { graphProps, pointCount } = prepareChart(state)

  assert.equal(pointCount, 4)
  assert.deepEqual(seriesPoints(graphProps), [
    [{ x: 1, y: 16 }, { x: 2, y: 1010 }],
    [{ x: 1, y: 100 }, { x: 2, y: 0 }],
  ])
  assert.deepEqual(state.parseIssues, [['invalid-x', [2]]])
})

test('detects decimal commas before preparing chart points', () => {
  const state = editorState([['2', '1.500', '0'], ['1', '1.010,5', '#N/A']])
  const { graphProps, pointCount } = prepareChart(state)

  assert.equal(pointCount, 3)
  assert.deepEqual(seriesPoints(graphProps), [
    [{ x: 1, y: 1010.5 }, { x: 2, y: 1500 }],
    [{ x: 1, y: -Infinity }, { x: 2, y: 0 }],
  ])
  assert.deepEqual(state.parseIssues, [])
})

function sparseState(emptyCells) {
  const parsed = parseDelimited('X,A,B\n1,10,\n2,,20\n3,30,\n4,0,40', { emptyCells: 'mark' })
  return { ...initialState, ...parsed, parseIssues: parsed.issues, series: seriesFromColumns(parsed.columns), emptyCells }
}

test('the empty cell setting resolves marked cells before passing columns to the renderer', () => {
  for (const precision of ['float32', 'float64']) {
    for (const chartType of ['line', 'scatter']) {
      for (const [emptyCells, empty] of [['gap', Infinity], ['connect', -Infinity], ['zero', 0]]) {
        const state = { ...sparseState(emptyCells), chartType }
        const original = structuredClone(state.rows)
        const { graphProps } = prepareChart(state, { precision })
        assert.deepEqual(Array.from(graphProps.columns.ys[0]), [10, empty, 30, 0])
        assert.deepEqual(Array.from(graphProps.columns.ys[1]), [empty, 20, empty, 40])
        assert.ok(graphProps.columns.x.every(Number.isFinite))
        assert.ok(graphProps.columns.ys.every(ys => ys.every(value => !Number.isNaN(value))))
        assert.deepEqual(state.rows, original)
      }
    }
  }
})

test('chart preparation rejects parser-only and invalid empty cell settings before converting data', () => {
  const sparse = sparseState('gap')
  const numeric = editorState([[1, 10, 20], [2, 30, 40]])
  const invalid = ['mark', 'Gap', 'skip', '', null, 0, false, NaN, Infinity, 'toString', 'constructor', [], {}, { toString: () => 'gap' }]
  for (const precision of ['float32', 'float64']) {
    for (const state of [sparse, numeric, { ...numeric, rows: [] }]) {
      const original = structuredClone(state.rows)
      for (const emptyCells of invalid) {
        assert.throws(() => prepareChart({ ...state, emptyCells }, { precision }), {
          name: 'TypeError', message: 'emptyCells must be "gap", "zero", or "connect".',
        })
      }
      assert.deepEqual(state.rows, original)
    }
  }
})

test('a real zero is drawn as zero under every empty cell setting', () => {
  for (const emptyCells of ['gap', 'zero', 'connect']) {
    const { graphProps } = prepareChart(sparseState(emptyCells))
    assert.deepEqual(seriesPoints(graphProps)[0][3], { x: 4, y: 0 }, emptyCells)
  }
})

test('marked empty cells count as points only when set to zero', () => {
  assert.equal(prepareChart(sparseState('gap')).pointCount, 5)
  assert.equal(prepareChart(sparseState('connect')).pointCount, 5)
  assert.equal(prepareChart(sparseState('zero')).pointCount, 8)
  assert.ok(seriesPoints(prepareChart({ ...sparseState('gap'), emptyCells: undefined }).graphProps)[1]
    .some(({ y }) => y === Infinity))
})
