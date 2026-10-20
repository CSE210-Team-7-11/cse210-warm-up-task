import assert from 'node:assert/strict'
import test from 'node:test'
import { buildChartData, computeScales } from '../src/components/charts/chartUtils.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'

function importedState(text) {
  const parsed = parseDelimited(text)
  return { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
}

test('sorts imported rows into aligned float64 columns with stable duplicate x values', () => {
  const state = importedState('X,A,B\n3,30,300\n1,10,100\n2,20,200\n1,11,110')
  const { columns, series } = buildChartData(state)

  assert.equal(columns.length, 4)
  assert.deepEqual(columns.x, new Float64Array([1, 1, 2, 3]))
  assert.deepEqual(columns.ys, [new Float64Array([10, 11, 20, 30]), new Float64Array([100, 110, 200, 300])])
  assert.equal(series, state.series)
  assert.equal(columns.x.byteLength + columns.ys.reduce((bytes, y) => bytes + y.byteLength, 0), 4 * 3 * 8)
})

test('keeps gaps, skips, invalid-number breaks, and zero aligned after import and sorting', () => {
  const state = importedState('X,A,B\n3,#N/A,0\n1,,bad\n2,0,#N/A')
  const { columns } = buildChartData(state)

  assert.deepEqual(columns.x, new Float64Array([1, 2, 3]))
  assert.deepEqual(columns.ys, [new Float64Array([Infinity, 0, -Infinity]), new Float64Array([Infinity, -Infinity, 0])])
  assert.deepEqual(computeScales(columns), {
    x: { domain: [1, 3], ticks: [1, 1.5, 2, 2.5, 3] },
    y: { domain: [0, 0.2], ticks: [0, 0.2] },
  })
})

test('skips nonfinite x values without losing pairing in the remaining rows', () => {
  const state = importedState('X,A\n2,20\n1,10')
  state.rows.push([NaN, 30], [Infinity, 40], [-Infinity, 50])
  const { columns } = buildChartData(state)

  assert.deepEqual(columns, { length: 2, x: new Float64Array([1, 2]), ys: [new Float64Array([10, 20])] })
})

test('uses series column indexes and order rather than assuming every source column is plotted', () => {
  const state = importedState('X,A,B,C,Ignored\n2,20,200,2000,9\n1,10,100,1000,8')
  state.series = [state.series[2], state.series[0]]
  const { columns, series } = buildChartData(state)

  assert.deepEqual(columns.ys, [new Float64Array([1000, 2000]), new Float64Array([10, 20])])
  assert.equal(series, state.series)
})

test('float32 is explicit, rounds all columns, and retains missing-value sentinels', () => {
  const state = importedState('X,A,B\n2.2,#N/A,\n1.1,0.1000000001,-0')
  const normal = buildChartData(state).columns
  const { columns } = buildChartData(state, { precision: 'float32' })

  assert.deepEqual(columns.x, new Float32Array([1.1, 2.2]))
  assert.deepEqual(columns.ys, [new Float32Array([0.1000000001, -Infinity]), new Float32Array([-0, Infinity])])
  assert.equal(columns.x.byteLength, normal.x.byteLength / 2)
  assert.equal(normal.x[0], 1.1)
  assert.equal(normal.ys[0][0], 0.1000000001)
  assert.notEqual(columns.ys[0][0], normal.ys[0][0])
  assert.throws(() => buildChartData(state, { precision: 'float16' }), /precision/)
})

test('sorting before float32 rounding preserves order when distinct x values round together', () => {
  const state = importedState('X,A\n1.00000002,2\n1.00000001,1')
  const { columns } = buildChartData(state, { precision: 'float32' })

  assert.deepEqual(columns.x, new Float32Array([1, 1]))
  assert.deepEqual(columns.ys[0], new Float32Array([1, 2]))
})

test('rejects finite X and Y values that overflow float32 without changing the input', () => {
  for (const value of [1e40, -1e40, 3.4028235677973366e38, -3.4028235677973366e38]) {
    for (const columnIndex of [0, 1, 2]) {
      const state = importedState('X,A,B\n2,20,200\n1,10,100')
      state.rows[0][columnIndex] = value
      state.series.reverse()
      const before = structuredClone(state)
      for (const chartType of ['line', 'scatter']) {
        assert.throws(() => prepareChart({ ...state, chartType }, { precision: 'float32' }), {
          name: 'Float32OverflowError',
          message: `The value ${value} in "${state.columns[columnIndex].name}" is too large for 32-bit precision. Switch to 64-bit mode.`,
        })
      }
      assert.deepEqual(state, before)
      const { columns } = buildChartData(state)
      assert.ok(columns.x.every(Number.isFinite))
      assert.ok(columns.ys.every((y) => y.every(Number.isFinite)))
    }
  }
})

test('accepts finite float32 boundary values and preserves real gap and skip markers', () => {
  const max = 3.4028234663852886e38
  const state = importedState(`X,A,B\n${max},${max},#N/A\n${-max},${-max},\n0,3.4028235e38,0`)
  const { columns } = buildChartData(state, { precision: 'float32' })

  assert.deepEqual(columns.x, new Float32Array([-max, 0, max]))
  assert.deepEqual(columns.ys, [new Float32Array([-max, max, max]), new Float32Array([Infinity, 0, -Infinity])])
})

test('does not mutate input rows or metadata and owns its numeric storage', () => {
  const state = importedState('X,A,B\n2,20,200\n1,10,100')
  const before = structuredClone(state)
  Object.freeze(state)
  Object.freeze(state.rows)
  state.rows.forEach(Object.freeze)
  Object.freeze(state.series)
  state.series.forEach(Object.freeze)
  const { columns } = buildChartData(state)

  assert.deepEqual(state, before)
  columns.x[0] = 99
  columns.ys[0][0] = 88
  assert.equal(columns.ys[1][0], 100)
  assert.deepEqual(state, before)
})

test('empty data and no series still produce consistent column lengths', () => {
  const state = importedState('X,A\n1,2')
  const empty = buildChartData({ ...state, rows: [] }).columns
  assert.deepEqual(empty, { length: 0, x: new Float64Array(), ys: [new Float64Array()] })
  assert.equal(computeScales(empty), null)
  const noSeries = buildChartData({ ...state, series: [] }).columns
  assert.deepEqual(noSeries, { length: 1, x: new Float64Array([1]), ys: [] })
  assert.equal(computeScales(noSeries), null)
})

test('passes one shared x column to both chart modes and builds matching legacy points', () => {
  const state = importedState('X,A,B\n2,,#N/A\n1,1.1,10\n3,3.3,30')
  for (const chartType of ['line', 'scatter']) {
    const { graphProps, pointCount } = prepareChart({ ...state, chartType }, { precision: 'float32' })
    const { columns, series } = graphProps
    assert.deepEqual(Object.keys(columns).sort(), ['length', 'x', 'ys'])
    assert.equal(columns.x.length, 3)
    assert.equal(columns.ys.length, 2)
    assert.equal(pointCount, 4)
    for (let s = 0; s < series.length; s++) {
      assert.equal(columns.ys[s].length, columns.x.length)
      const expected = Array.from(columns.x, (x, i) => ({ x, y: columns.ys[s][i] }))
        .filter((point) => chartType === 'line' || Number.isFinite(point.y))
      assert.deepEqual(series[s].points, expected)
      assert.equal(Object.hasOwn(series[s], 'x'), false)
    }
  }
})

test('column bounds ignore missing values and retain negative ranges', () => {
  const state = importedState('X,A,B\n-2,-10,#N/A\n2,,5')
  const scales = computeScales(buildChartData(state).columns)
  assert.deepEqual(scales.x.domain, [-2, 2])
  assert.deepEqual(scales.y.domain, [-10, 5])
})
