import assert from 'node:assert/strict'
import test from 'node:test'
import { losesFloat64Precision } from '../src/precision.js'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'

test('detects changed decimal values, integer bases, locale numbers and underflow', () => {
  for (const [value, stored, decimal] of [
    ['9007199254740993', 9007199254740992, '.'],
    ['1.00000000000000001', 1, '.'],
    ['0.10000000000000001', 0.1, '.'],
    ['1e-400', 0, '.'],
    ['-1e-400', -0, '.'],
    ['0x20000000000001', 9007199254740992, '.'],
    ['9.007.199.254.740.993', 9007199254740992, ','],
    ['1,00000000000000001', 1, ','],
  ]) {
    assert.equal(losesFloat64Precision(value, stored, decimal), true, value)
  }
})

test('does not warn for decimal values that round-trip or harmless formatting changes', () => {
  for (const [value, stored, decimal] of [
    ['0.1', 0.1, '.'], ['0.10', 0.1, '.'], ['0,1', 0.1, ','],
    ['1.2300', 1.23, '.'], ['123e-2', 1.23, '.'], ['  +001.2300  ', 1.23, '.'],
    ['1,000', 1000, '.'], ['0x10', 16, '.'], ['-0', -0, '.'],
    ['0e-999999', 0, '.'], ['5e-324', Number.MIN_VALUE, '.'],
  ]) {
    assert.equal(losesFloat64Precision(value, stored, decimal), false, value)
  }
})

test('parser retains rounded values and records every source position without rejecting the file', () => {
  const parsed = parseDelimited('X,A\n1,9007199254740993\nbad,3\n2,1e-400\n3,0.1')
  assert.deepEqual(parsed.rows, [[1, 9007199254740992], [2, 0], [3, 0.1]])
  assert.deepEqual(parsed.issues, [
    ['invalid-x', [1]],
    ['precision-loss', [[1, 0, '9007199254740993', 9007199254740992], [1, 2, '1e-400', 0]]],
  ])
})

test('float32 warns for each rounded coordinate and underflow but continues both chart modes', () => {
  const parsed = parseDelimited('X,A,B\n1.1,0.1,#N/A\n2.2,1e-50,\n3,2.5,0')
  const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
  const before = structuredClone(state)
  for (const chartType of ['line', 'scatter']) {
    const chart = prepareChart({ ...state, chartType }, { precision: 'float32' })
    assert.equal(chart.pointCount, 4)
    assert.deepEqual(chart.warnings.map(({ value, storedValue, columnName }) => [value, storedValue, columnName]), [
      [1.1, Math.fround(1.1), 'X'], [0.1, Math.fround(0.1), 'A'],
      [2.2, Math.fround(2.2), 'X'], [1e-50, 0, 'A'],
    ])
    assert.equal(chart.graphProps.columns.ys[0][1], 0)
    assert.deepEqual(prepareChart({ ...state, chartType }).warnings, [])
  }
  assert.deepEqual(state, before)
})

test('exact float32 values, signed zero and gap/skip markers do not warn', () => {
  const parsed = parseDelimited('X,A,B\n1,2.5,#N/A\n2,-0,\n3,0,1')
  const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
  const chart = prepareChart(state, { precision: 'float32' })
  assert.deepEqual(chart.warnings, [])
  assert.ok(Object.is(chart.graphProps.columns.ys[0][1], -0))
})
