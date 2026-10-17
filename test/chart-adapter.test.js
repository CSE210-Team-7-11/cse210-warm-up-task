import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { initialState, seriesFromColumns } from '../src/state.js'

function editorState(rows, overrides = {}) {
  const columns = [
    { key: 'c0', name: 'Time' },
    { key: 'c1', name: 'Trial A' },
    { key: 'c2', name: 'Trial B' },
  ]
  return { ...initialState, columns, series: seriesFromColumns(columns), rows, ...overrides }
}

test('keeps each series paired with its values and styles when sorting by x', () => {
  const state = editorState([[2, 20, 200], [1, 10, 100]])
  const { graphProps, pointCount } = prepareChart(state)

  assert.equal(pointCount, 4)
  assert.deepEqual(graphProps.series.map((series) => series.points), [
    [{ x: 1, y: 10 }, { x: 2, y: 20 }],
    [{ x: 1, y: 100 }, { x: 2, y: 200 }],
  ])
  for (const [index, series] of graphProps.series.entries()) {
    const { name, color, marker, dash } = state.series[index]
    assert.deepEqual({ name: series.name, color: series.color, marker: series.marker, dash: series.dash },
      { name, color, marker, dash })
  }
})

test('omits absent samples from each line series so valid neighbors can connect', { todo: true }, () => {
  const rows = [[1, 0, 10], [2, '', 20], [3, 3, 'bad'], ['bad', 99, 99]]
  const line = prepareChart(editorState(rows, { chartType: 'line' }))

  assert.equal(line.pointCount, 4)
  assert.deepEqual(line.graphProps.series.map((series) => series.points), [
    [{ x: 1, y: 0 }, { x: 3, y: 3 }],
    [{ x: 1, y: 10 }, { x: 2, y: 20 }],
  ])
})

test('omits missing scatter samples without counting them as zero', () => {
  const rows = [[1, 0, 10], [2, '', 20], [3, 3, 'bad'], ['bad', 99, 99]]
  const scatter = prepareChart(editorState(rows, { chartType: 'scatter' }))

  assert.equal(scatter.pointCount, 4)
  assert.deepEqual(scatter.graphProps.series.map((series) => series.points), [
    [{ x: 1, y: 0 }, { x: 3, y: 3 }],
    [{ x: 1, y: 10 }, { x: 2, y: 20 }],
  ])
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
  assert.equal(graphProps.series[0].points[1].y, 0.1000000001)
  assert.deepEqual(state, before)
  graphProps.series[0].points[0].y = 42
  assert.deepEqual(state, before)
})

test('reports zero and one valid point accurately for the existing preview threshold', () => {
  assert.equal(prepareChart(editorState([])).pointCount, 0)
  assert.equal(prepareChart(editorState([[1, 2, '']])).pointCount, 1)
})
