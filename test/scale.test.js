import assert from 'node:assert/strict'
import test from 'node:test'
import { computeLayout, minMax } from '../src/graph/scale.js'

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
