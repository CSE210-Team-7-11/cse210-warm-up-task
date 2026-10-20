import assert from 'node:assert/strict'
import test from 'node:test'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { Float32OverflowError, Float64OverflowError } from '../src/numericErrors.js'

test('recommends switching modes only when the value fits float64', () => {
  for (const value of [1e40, -1e40, Number.MAX_VALUE, -Number.MAX_VALUE]) {
    const parsed = parseDelimited(`X,A\n1,${value}\n2,2`)
    const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
    assert.throws(() => prepareChart(state, { precision: 'float32' }), (error) => {
      assert.ok(error instanceof Float32OverflowError)
      assert.match(error.message, /Switch to 64-bit mode/)
      return true
    })
    const fullPrecision = prepareChart(state, { precision: 'float64' })
    assert.equal(fullPrecision.graphProps.columns.ys[0][0], value)
    assert.equal(fullPrecision.pointCount, 2)
  }

  for (const value of ['1e309', '-1e309']) {
    for (const precision of ['float32', 'float64']) {
      assert.throws(() => {
        const parsed = parseDelimited(`X,A\n1,${value}\n2,2`)
        return prepareChart({ ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }, { precision })
      }, (error) => {
        assert.ok(error instanceof Float64OverflowError)
        assert.doesNotMatch(error.message, /Switch|smaller/)
        return true
      })
    }
  }
})

test('the float32 error itself never recommends float64 for a nonfinite value', () => {
  for (const value of [Number('1e309'), Number('-1e309'), NaN]) {
    assert.doesNotMatch(new Float32OverflowError(value, 'A').message, /Switch to 64-bit mode/)
  }
})

test('float64 overflow rejects the whole import for X and Y, including headerless first records', () => {
  for (const value of ['1e309', '-1e309', '1,000e308', '-1.000,5e309']) {
    for (const header of [true, false]) {
      for (const column of [0, 1]) {
        const row = ['1', '2']
        row[column] = value
        const text = (header ? 'X;A\n' : '') + row.join(';') + '\n3;4'
        assert.throws(() => parseDelimited(text), (error) => {
          assert.ok(error instanceof Float64OverflowError)
          assert.match(error.message, /too large for 64-bit precision/)
          assert.ok(error.message.includes(`"${header ? ['X', 'A'][column] : `Column ${column + 1}`}"`))
          assert.ok(error.message.includes(value))
          assert.doesNotMatch(error.message, /smaller|Switch/)
          return true
        })
      }
    }
  }
})

test('overflow cannot be hidden in an invalid-X record or an unplotted series', () => {
  for (const text of [
    'X,A\n1,2\nbad,1e309',
    'X,A,B,C,D\n1,2,3,4,1e309',
  ]) {
    assert.throws(() => parseDelimited(text), Float64OverflowError)
  }
})

test('float64 limits and actual gap/skip markers remain valid imports', () => {
  const max = Number.MAX_VALUE
  const parsed = parseDelimited(`X,A,B\n${max},${-max},#N/A\n${-max},${max},\n0,5e-324,0`)
  assert.deepEqual(parsed.rows, [[max, -max, -Infinity], [-max, max, Infinity], [0, Number.MIN_VALUE, 0]])
  assert.deepEqual(parsed.issues, [['empty-cell', [[2, 1]]]])
})
