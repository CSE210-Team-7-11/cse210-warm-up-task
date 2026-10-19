import test from 'node:test'
import assert from 'node:assert/strict'
import { minMax } from '../src/graph/scale.js'

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
