import assert from 'node:assert/strict'
import test from 'node:test'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { describeIssue, findIssues } from '../src/importFeedback.js'
import { buildChartData } from '../src/components/charts/chartUtils.js'
import { Float32OverflowError, Float64OverflowError, NumericOverflowErrors } from '../src/numericErrors.js'

test('1M points survive CSV conversion and both chart adapters', (t) => {
  const started = performance.now()
  const length = 1000000
  const text = 'X,A\n' + Array.from({ length }, (_, i) => `${length - i},${i}.5`).join('\n')
  const parsed = parseDelimited(text)
  const state = {
    ...initialState, ...parsed, parseIssues: parsed.issues,
    series: seriesFromColumns(parsed.columns),
  }

  assert.equal(parsed.rows.length, length)
  assert.deepEqual(findIssues(state), [])
  for (const chartType of ['line', 'scatter']) {
    const chart = prepareChart({ ...state, chartType })
    const points = chart.graphProps.series[0].points
    const columns = chart.graphProps.columns
    assert.equal(chart.pointCount, length)
    assert.equal(points.length, length)
    assert.equal(columns.length, length)
    assert.ok(columns.x instanceof Float64Array)
    assert.ok(columns.ys[0] instanceof Float64Array)
    assert.equal(columns.x.byteLength + columns.ys[0].byteLength, length * 16)
    for (let i = 0; i < length; i++) {
      assert.equal(points[i].x, i + 1)
      assert.equal(points[i].y, length - i - 0.5)
      assert.equal(columns.x[i], points[i].x)
      assert.equal(columns.ys[0][i], points[i].y)
    }
  }

  t.diagnostic(JSON.stringify({ rows: length, points: length, milliseconds: performance.now() - started, maxRssMiB: process.resourceUsage().maxRSS / 1024 }))
})

test('1M invalid cells retain every diagnostic and produce bounded feedback text', (t) => {
  const started = performance.now()
  const length = 1000000
  const text = 'X,A\n' + Array.from({ length }, (_, i) => `${i},bad-${i}`).join('\n')
  const parsed = parseDelimited(text)
  const state = {
    ...initialState, ...parsed, parseIssues: parsed.issues,
    series: seriesFromColumns(parsed.columns),
  }

  assert.equal(parsed.rows.length, length)
  assert.equal(parsed.issues.length, 1)
  const [type, cells] = parsed.issues[0]
  assert.equal(type, 'invalid-number')
  assert.equal(cells.length, length)
  for (let i = 0; i < length; i++) {
    assert.equal(parsed.rows[i][0], i)
    assert.equal(parsed.rows[i][1], Infinity)
    assert.equal(cells[i][0], 1)
    assert.equal(cells[i][1], i)
    assert.equal(cells[i][2], `bad-${i}`)
  }
  const issues = findIssues(state)
  assert.equal(issues.length, 1)
  assert.equal(issues[0][1], cells)
  const message = describeIssue(issues[0], state)
  assert.match(message, /^1000000 values aren’t numbers/)
  assert.match(message, /999997 more/)
  assert.ok(message.length < 300)
  assert.equal(prepareChart(state).pointCount, 0)

  t.diagnostic(JSON.stringify({ rows: length, errors: cells.length, messageCharacters: message.length, milliseconds: performance.now() - started, maxRssMiB: process.resourceUsage().maxRSS / 1024 }))
})

test('1M float64 precision changes retain ten diagnostics and a termination marker', () => {
  const length = 1000000
  const parsed = parseDelimited('X,A\n' + '1,1e-400\n'.repeat(length))
  assert.equal(parsed.rows.length, length)
  assert.ok(parsed.rows.every(([x, y]) => x === 1 && y === 0))
  assert.equal(parsed.issues.length, 2)
  assert.equal(parsed.issues[0][0], 'precision-loss')
  assert.deepEqual(parsed.issues[0][1], Array.from({ length: 10 }, (_, i) => [1, i, '1e-400', 0]))
  assert.deepEqual(parsed.issues[1], ['precision-loss-truncated', length - 10])
})

test('1M float32 precision changes and overflows retain at most ten diagnostics', () => {
  const length = 1000000
  for (const value of ['0.1', '1e40']) {
    const parsed = parseDelimited('X,A\n' + `1,${value}\n`.repeat(length))
    const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
    if (value === '1e40') {
      assert.throws(() => buildChartData(state, { precision: 'float32' }), (error) => {
        assert.ok(error instanceof NumericOverflowErrors)
        assert.equal(error.count, length)
        assert.equal(error.errors.length, 10)
        assert.ok(error.errors.every((oneError) => oneError instanceof Float32OverflowError))
        assert.match(error.message, /List truncated/)
        return true
      })
    } else {
      const result = buildChartData(state, { precision: 'float32' })
      assert.equal(result.warningCount, length)
      assert.equal(result.warnings.length, 10)
      assert.ok(result.warnings.every(({ value, storedValue }) => value === 0.1 && storedValue === Math.fround(0.1)))
      assert.equal(result.columns.length, length)
      assert.ok(result.columns.ys[0].every((value) => value === Math.fround(0.1)))
    }
  }
})

test('1M float64 overflows retain ten errors and reject the import', () => {
  const length = 1000000
  assert.throws(() => parseDelimited('X,A\n' + '1,1e309\n'.repeat(length)), (error) => {
    assert.ok(error instanceof NumericOverflowErrors)
    assert.equal(error.count, length)
    assert.equal(error.errors.length, 10)
    assert.ok(error.errors.every((oneError) => oneError instanceof Float64OverflowError))
    for (let i = 0; i < 10; i++) assert.ok(error.errors[i].message.includes(`source data row ${i + 1})`))
    assert.match(error.message, /List truncated/)
    assert.ok(error.message.length < 1500)
    return true
  })
})
