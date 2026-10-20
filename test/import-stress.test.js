import assert from 'node:assert/strict'
import test from 'node:test'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { describeIssue, findIssues } from '../src/importFeedback.js'

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
