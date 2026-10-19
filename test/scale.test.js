import assert from 'node:assert/strict'
import test from 'node:test'
import { computeLayout } from '../src/graph/scale.js'

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