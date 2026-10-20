import assert from 'node:assert/strict'
import test from 'node:test'
import { computeLayout, findNearest, invert, minMax, scale, ticks, trendLine } from '../src/graph/scale.js'
import { buildChartData, computeScales, linear } from '../src/components/charts/chartUtils.js'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { Float64OverflowError } from '../src/numericErrors.js'

test('fromX(toX) returns value', () => {
    const { toX, fromX } = computeLayout({ xMin: 0, xMax: 100, yMin: 0, yMax: 100 })
    const value = 27
    assert.ok(Math.abs(fromX(toX(value)) - value) < Number.EPSILON)
})

test('equal min and max put value in the middle', () => {
    const { toX, left, right } = computeLayout({ xMin: 50, xMax: 50, yMin: 50, yMax: 50 })
    assert.equal(toX(50), (left + right) / 2)
})

test('tick values for the sample data match what the chart shows', () => {
    const { xTicks } = computeLayout({ xMin: 0, xMax: 100, yMin: 0, yMax: 100 })
    assert.deepEqual(xTicks, [0, 20, 40, 60, 80, 100])
})

test('minMax finds bounds without changing the values', () => {
  const values = [4, -8, 0, 2.5, 12]
  assert.deepEqual(minMax(values), { min: -8, max: 12 })
  assert.deepEqual(values, [4, -8, 0, 2.5, 12])
  assert.deepEqual(minMax([7]), { min: 7, max: 7 })
})

test('minMax preserves empty and special-number bounds', () => {
  assert.deepEqual(minMax([]), { min: Infinity, max: -Infinity })
  assert.deepEqual(minMax([Infinity, 2, -Infinity]), { min: -Infinity, max: Infinity })
  assert.deepEqual(minMax([1, NaN, 3]), { min: NaN, max: NaN })
  assert.deepEqual(minMax([0, -0]), { min: -0, max: 0 })
})

test('minMax handles arrays larger than the function argument limit', () => {
  const values = Array.from({ length: 200000 }, (_, i) => i - 100000)
  assert.deepEqual(minMax(values), { min: -100000, max: 99999 })
})

test('overflowing float64 axis calculations throw instead of returning nonfinite coordinates', () => {
  const max = Number.MAX_VALUE
  for (const calculate of [
    () => scale(-max, max, 0, 100),
    () => invert(-max, max, 0, 100),
    () => ticks(-max, max),
    () => computeLayout({ xMin: -max, xMax: max, yMin: 0, yMax: 1 }),
    () => computeLayout({ xMin: 0, xMax: 1, yMin: -max, yMax: max }),
    () => linear([-max, max], [0, 100]),
    () => computeScales(buildChartData({ ...initialState, rows: [[-max, 0, 0], [max, 1, 1]] }).columns),
  ]) {
    assert.throws(calculate, Float64OverflowError)
  }
})

test('large finite ranges avoid avoidable tick overflow and keep coordinate endpoints', () => {
  const max = Number.MAX_VALUE
  const values = ticks(0, max)
  assert.ok(values.every(Number.isFinite))
  assert.equal(values[0], 0)
  assert.equal(values.at(-1), max)
  const toPixel = scale(0, max, 0, 100)
  const fromPixel = invert(0, max, 0, 100)
  assert.equal(toPixel(max), 100)
  assert.equal(fromPixel(100), max)
})

test('trend calculation overflow throws rather than producing a nonfinite fit', () => {
  for (const points of [
    [{ x: 1e308, y: 1 }, { x: 1.1e308, y: 2 }],
    [{ x: -1e200, y: -1e200 }, { x: 1e200, y: 1e200 }],
  ]) {
    assert.throws(() => trendLine(points), Float64OverflowError)
  }
  assert.deepEqual(trendLine([{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]), { slope: 2, startHeight: 1 })
})

test('large negative nice-axis ranges produce a bounded set of finite ticks', () => {
  const { columns } = buildChartData({ ...initialState, rows: [[1, -1e100, 0], [2, -2e100, 0]] })
  const scales = computeScales(columns)
  assert.ok(scales.y.ticks.length < 20)
  assert.ok(scales.y.ticks.every(Number.isFinite))
})

function hoverColumns(text, precision = 'float64') {
  const parsed = parseDelimited(text)
  return buildChartData({ ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }, { precision }).columns
}

const hoverLayout = computeLayout({ xMin: 0, xMax: 100, yMin: 0, yMax: 100 })

test('findNearest compares pixel distance across series and neighboring x values', () => {
  for (const precision of ['float32', 'float64']) {
    const columns = hoverColumns('X,A,B\n51,80,50\n50,90,53', precision)
    const { toX, toY } = hoverLayout
    assert.deepEqual(findNearest(columns, hoverLayout, toX(50), toY(50), 10), { seriesIndex: 1, index: 1 })
    assert.deepEqual(findNearest(columns, hoverLayout, toX(50), toY(90), 10), { seriesIndex: 0, index: 0 })
    assert.equal(findNearest(columns, hoverLayout, toX(10), toY(10), 10), null)
  }
})

test('findNearest skips both missing-value sentinels and searches beyond them', () => {
  const columns = hoverColumns('X,A,B\n49,50,#N/A\n50,,#N/A\n51,#N/A,50')
  assert.equal(columns.ys[0][1], Infinity)
  assert.equal(columns.ys[1][1], -Infinity)
  const { toX, toY } = hoverLayout
  assert.deepEqual(findNearest(columns, hoverLayout, toX(49), toY(50), 10), { seriesIndex: 0, index: 0 })
  assert.deepEqual(findNearest(columns, hoverLayout, toX(51), toY(50), 10), { seriesIndex: 1, index: 2 })
  assert.equal(findNearest(hoverColumns('X,A\n1,\n2,#N/A'), hoverLayout, toX(1), toY(0), 10), null)
})

test('findNearest searches all duplicate x values with stable ties', () => {
  const columns = hoverColumns('X,A,B\n50,90,50\n50,50,50\n50,50,')
  const { toX, toY } = hoverLayout
  assert.deepEqual(findNearest(columns, hoverLayout, toX(50), toY(50), 10), { seriesIndex: 0, index: 1 })
  assert.deepEqual(findNearest(columns, hoverLayout, toX(50), toY(90), 0), { seriesIndex: 0, index: 0 })
})

test('findNearest includes the distance boundary and handles empty and singleton columns', () => {
  const columns = hoverColumns('X,A\n50,50')
  const { toX, toY } = hoverLayout
  for (const direction of [-1, 1]) {
    assert.deepEqual(findNearest(columns, hoverLayout, toX(50) + direction * 10, toY(50), 10), { seriesIndex: 0, index: 0 })
    assert.equal(findNearest(columns, hoverLayout, toX(50) + direction * 10.01, toY(50), 10), null)
  }
  assert.equal(findNearest(hoverColumns('X,A'), hoverLayout, 0, 0, 10), null)
  assert.equal(findNearest({ length: 1, x: new Float64Array([50]), ys: [] }, hoverLayout, toX(50), toY(50), 10), null)
  for (const [px, py, distance] of [[NaN, 0, 10], [0, Infinity, 10], [0, 0, -1], [0, 0, NaN], [0, 0, Infinity]]) {
    assert.equal(findNearest(columns, hoverLayout, px, py, distance), null)
  }
})

test('findNearest works at domain edges and on constant axes', () => {
  const columns = hoverColumns('X,A\n0,0\n100,100')
  const { toX, toY } = hoverLayout
  assert.deepEqual(findNearest(columns, hoverLayout, toX(0) - 5, toY(0), 10), { seriesIndex: 0, index: 0 })
  assert.deepEqual(findNearest(columns, hoverLayout, toX(100) + 5, toY(100), 10), { seriesIndex: 0, index: 1 })
  const constant = computeLayout({ xMin: 50, xMax: 50, yMin: 50, yMax: 50 })
  assert.deepEqual(findNearest(hoverColumns('X,A\n50,50\n50,50'), constant, constant.toX(50), constant.toY(50), 10), { seriesIndex: 0, index: 0 })
})

test('findNearest handles negative ranges and Float32 values that round to the same x', () => {
  for (const precision of ['float32', 'float64']) {
    const columns = hoverColumns('X,A,B\n-100,-100,#N/A\n-50,-50,-55\n0,0,', precision)
    const layout = computeLayout({ xMin: -100, xMax: 0, yMin: -100, yMax: 0 })
    assert.deepEqual(findNearest(columns, layout, layout.toX(-50), layout.toY(-55), 10), { seriesIndex: 1, index: 1 })
    assert.deepEqual(findNearest(columns, layout, layout.toX(-100), layout.toY(-100), 0), { seriesIndex: 0, index: 0 })
  }
  const rounded = hoverColumns('X,A\n-1.00000002,10\n-1.00000001,20\n0,30', 'float32')
  assert.equal(rounded.x[0], rounded.x[1])
  const layout = computeLayout({ xMin: -1, xMax: 0, yMin: 0, yMax: 30 })
  assert.deepEqual(findNearest(rounded, layout, layout.toX(-1), layout.toY(20), 0), { seriesIndex: 0, index: 1 })
})

test('findNearest uses a circular pixel radius for vertical and diagonal offsets', () => {
  const columns = hoverColumns('X,A\n50,50')
  const { toX, toY } = hoverLayout
  for (const [dx, dy] of [[0, 5], [0, -5], [3, 4], [-3, -4]]) {
    assert.deepEqual(findNearest(columns, hoverLayout, toX(50) + dx, toY(50) + dy, 5), { seriesIndex: 0, index: 0 })
  }
  assert.equal(findNearest(columns, hoverLayout, toX(50) + 4, toY(50) + 4, 5), null)
})

test('findNearest excludes invalid Y values while retaining their import diagnostics', () => {
  const parsed = parseDelimited('X,A\n0,0\n50,bad\n100,100')
  assert.deepEqual(parsed.issues, [['invalid-number', [[1, 1, 'bad']]]])
  const { columns } = buildChartData({ ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) })
  assert.equal(columns.ys[0][1], Infinity)
  assert.equal(findNearest(columns, hoverLayout, hoverLayout.toX(50), hoverLayout.toY(50), 10), null)
})

test('findNearest matches a full distance scan on sorted imported data', () => {
  let seed = 27
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const rows = Array.from({ length: 1000 }, () => `${Math.floor(random() * 101)},${random() < 0.1 ? '' : random() * 100},${random() < 0.1 ? '#N/A' : random() * 100}`)
  const columns = hoverColumns('X,A,B\n' + rows.join('\n'))
  const before = structuredClone(columns)
  for (let query = 0; query < 300; query++) {
    const px = random() * 500
    const py = random() * 300
    const maxDistance = random() * 30
    let expected = null
    let distance = maxDistance
    for (let seriesIndex = 0; seriesIndex < columns.ys.length; seriesIndex++) {
      for (let index = 0; index < columns.length; index++) {
        const y = columns.ys[seriesIndex][index]
        if (!Number.isFinite(y)) continue
        const candidate = Math.hypot(hoverLayout.toX(columns.x[index]) - px, hoverLayout.toY(y) - py)
        if (candidate < distance || (candidate === distance && !expected)) {
          distance = candidate
          expected = { seriesIndex, index }
        }
      }
    }
    assert.deepEqual(findNearest(columns, hoverLayout, px, py, maxDistance), expected)
  }
  assert.deepEqual(columns, before)
})

test('findNearest prunes distant rows on a 100,000-row column', () => {
  const length = 100000
  const columns = { length, x: Float64Array.from({ length }, (_, i) => i), ys: [new Float64Array(length).fill(50)] }
  const layout = computeLayout({ xMin: 0, xMax: length - 1, yMin: 0, yMax: 100 })
  let checked = 0
  const counted = { ...layout, toY: (value) => { checked++; return layout.toY(value) } }
  assert.deepEqual(findNearest(columns, counted, layout.toX(50000), layout.toY(50), 10), { seriesIndex: 0, index: 50000 })
  assert.equal(checked, 1)
})

test('findNearest uses each marker radius without enlarging every point target', () => {
  const layout = computeLayout({ xMin: 0, xMax: 100, yMin: 0, yMax: 100 })
  const columns = { length: 2, x: new Float64Array([40, 50]), ys: [new Float64Array([50, 50])] }
  const radii = { maxRadius: 100, radiusAt: (_series, index) => index === 1 ? 100 : 3 }
  // The small point is closer but outside its target; the large bubble contains the pointer.
  const px = layout.toX(40) - 20
  assert.deepEqual(findNearest(columns, layout, px, layout.toY(50), 10, radii), { seriesIndex: 0, index: 1 })
  assert.equal(findNearest(columns, layout, layout.toX(50) + 100.01, layout.toY(50), 10, radii), null)
  assert.deepEqual(findNearest(columns, layout, layout.toX(50) + 100, layout.toY(50), 10, radii), { seriesIndex: 0, index: 1 })
  assert.deepEqual(findNearest(columns, layout, layout.toX(40), layout.toY(50), 10, radii), { seriesIndex: 0, index: 0 })
})

test('findNearest checks neighboring rows for a larger marker before shrinking the search', () => {
  const columns = { length: 3, x: new Float64Array([10, 40, 50]), ys: [new Float64Array([50, 90, 50])] }
  const radii = { maxRadius: 100, radiusAt: (_series, index) => index === 0 ? 100 : 3 }
  assert.deepEqual(findNearest(columns, hoverLayout, hoverLayout.toX(30), hoverLayout.toY(50), 10, radii), { seriesIndex: 0, index: 0 })
})

test('findNearest does not project extreme missing-only rows outside the plotted domain', () => {
  const columns = hoverColumns('X,A\n-1e308,0\n0,1\n1e308,')
  const layout = computeLayout({ xMin: -1e308, xMax: 0, yMin: 0, yMax: 1 })
  assert.deepEqual(findNearest(columns, layout, layout.toX(0), layout.toY(1), 10), { seriesIndex: 0, index: 1 })
})

test('findNearest retains endpoint hover when inverse rounding crosses a missing-only row', () => {
  for (const [xMin, xMax, missingX] of [
    [-1e16, 3, 3.5],
    [-0.3, 0.1, 0.10000000000000002],
  ]) {
    const columns = hoverColumns(`X,A\n${xMin},0\n${xMax},1\n${missingX},`)
    const layout = computeLayout({ xMin, xMax, yMin: 0, yMax: 1 })
    for (const dx of [-2, 0, 2, 10]) {
      assert.deepEqual(findNearest(columns, layout, layout.toX(xMax) + dx, layout.toY(1), 10), { seriesIndex: 0, index: 1 })
    }
    assert.equal(findNearest(columns, layout, layout.toX(xMax) + 10.01, layout.toY(1), 10), null)
  }
})
