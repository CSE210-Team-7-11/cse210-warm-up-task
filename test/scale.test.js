import assert from 'node:assert/strict'
import test from 'node:test'
import { computeLayout, invert, minMax, scale, ticks, trendLine } from '../src/graph/scale.js'
import { buildChartData, computeScales, linear } from '../src/components/charts/chartUtils.js'
import { initialState } from '../src/state.js'
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
