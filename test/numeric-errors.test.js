import assert from 'node:assert/strict'
import test from 'node:test'
import { collectOverflowErrors, Float32OverflowError, Float64OverflowError, NumericOverflowErrors } from '../src/numericErrors.js'
import { computeLayout, trendLine } from '../src/graph/scale.js'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { buildChartData } from '../src/components/charts/chartUtils.js'

test('input overflow messages share wording and identify the value and column using ASCII quotes', () => {
  assert.equal(new Float32OverflowError(1e40, 'Trial A').message,
    'The value 1e+40 in "Trial A" is too large for 32-bit precision. Switch to 64-bit mode.')
  assert.equal(new Float64OverflowError('1e309', 'Trial A').message,
    'The value 1e309 in "Trial A" is too large for 64-bit precision.')
})

test('axis overflow identifies the source column and both endpoints of the range', () => {
  assert.throws(() => computeLayout({ xMin: -1e308, xMax: 1e308, yMin: 0, yMax: 1, xColumnName: 'Time' }), {
    name: 'Float64OverflowError',
    message: 'The axis range for -1e+308 to 1e+308 in "Time" is too large for 64-bit precision.',
  })
})

test('trend overflow identifies the source value and series column', () => {
  assert.throws(() => trendLine([{ x: 0, y: 1e308 }, { x: 1, y: 1e308 }], 'Time', 'Trial A'), {
    name: 'Float64OverflowError',
    message: 'The trend line for 1e+308 in "Trial A" is too large for 64-bit precision.',
  })
})

test('reports every overflowing input cell together, including skipped-X records', () => {
  assert.throws(() => parseDelimited('X,A,B\n1,1e309,2\n1e309,2,-1e309\nbad,2e309,0'), (error) => {
    assert.ok(error instanceof NumericOverflowErrors)
    assert.equal(error.errors.length, 4)
    const messages = error.errors.map((oneError) => oneError.message)
    assert.ok(messages[0].includes('"A" (source data row 1)'))
    assert.ok(messages[1].includes('"X" (source data row 2)'))
    assert.ok(messages[2].includes('"B" (source data row 2)'))
    assert.ok(messages[3].includes('"A" (source data row 3)'))
    assert.ok(messages.every((message) => !message.includes('Switch')))
    return true
  })
})

test('reports all float32 overflows across X and every series without changing input', () => {
  const parsed = parseDelimited('X,A,B\n1e40,1e40,-1e40\n1,-1e40,1e40')
  const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
  const before = structuredClone(state)
  assert.throws(() => buildChartData(state, { precision: 'float32' }), (error) => {
    assert.ok(error instanceof NumericOverflowErrors)
    assert.equal(error.errors.length, 5)
    assert.ok(error.errors.every((oneError) => oneError instanceof Float32OverflowError))
    assert.ok(error.errors.every((oneError) => oneError.message.includes('Switch to 64-bit mode')))
    return true
  })
  assert.deepEqual(state, before)
})

test('collects independent axis and trend errors in one flat list', () => {
  assert.throws(() => collectOverflowErrors([
    () => computeLayout({ xMin: -1e308, xMax: 1e308, yMin: -1e308, yMax: 1e308, xColumnName: 'Time', yColumnName: 'Trial A' }),
    () => trendLine([{ x: 0, y: 1e308 }, { x: 1, y: 1e308 }], 'Time', 'Trial B'),
  ]), (error) => {
    assert.ok(error instanceof NumericOverflowErrors)
    assert.equal(error.errors.length, 3)
    assert.ok(error.errors.every((oneError) => oneError instanceof Float64OverflowError))
    for (const column of ['Time', 'Trial A', 'Trial B']) assert.ok(error.message.includes(`"${column}"`))
    return true
  })
})
