import assert from 'node:assert/strict'
import test from 'node:test'
import { lineSegments } from '../src/graph/lineSegments.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { buildChartData, computeScales } from '../src/components/charts/chartUtils.js'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'

test('CSV empty cells break a line while #N/A connects neighboring points', () => {
  const { columns, rows } = parseDelimited('X,A,B\n1,10,15\n2,20,25\n3,,#N/A\n4,40,45\n5,50,55')
  const state = { ...initialState, columns, rows, series: seriesFromColumns(columns) }
  const { graphProps } = prepareChart(state)

  assert.deepEqual(graphProps.series.map(s => lineSegments(s.points).map(segment => segment.map(p => p.x))), [
    [[1, 2], [4, 5]],
    [[1, 2, 4, 5]],
  ])
  const { data, series } = buildChartData(state)
  assert.equal(computeScales(data, series).y.domain.every(Number.isFinite), true)
})

test('skipped samples do not erase a break or create empty segments at the edges', () => {
  const values = [-Infinity, Infinity, 0, -Infinity, Infinity, -Infinity, Infinity, 8, 9, -Infinity, Infinity]
  const points = values.map((y, x) => ({ x, y }))
  assert.deepEqual(lineSegments(points), [[points[2]], [points[7], points[8]]])
  assert.deepEqual(lineSegments([{ x: 1, y: Infinity }, { x: 2, y: -Infinity }]), [])
})

test('preserves legacy invalid-value breaks and sorts without mutating the input', () => {
  const points = Object.freeze([
    { x: 5, y: 50 }, { x: 3, y: 30 }, { x: 2, y: null }, { x: 4, y: NaN }, { x: 1, y: 10 },
  ].map(Object.freeze))
  assert.deepEqual(lineSegments(points), [[points[4]], [points[1]], [points[0]]])
  assert.deepEqual(points.map(p => p.x), [5, 3, 2, 4, 1])
})
