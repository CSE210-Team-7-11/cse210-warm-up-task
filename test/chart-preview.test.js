import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'

let server
let ChartPreview
let DataPanel
let PrecisionWarnings
let NumericOverflowAlert
let SpecsPanel
let parseForUI
let ChartWarnings
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  ChartPreview = (await server.ssrLoadModule('/src/components/ChartPreview.jsx')).default
  DataPanel = (await server.ssrLoadModule('/src/components/DataPanel.jsx')).default
  PrecisionWarnings = (await server.ssrLoadModule('/src/components/PrecisionWarnings.jsx')).default
  NumericOverflowAlert = (await server.ssrLoadModule('/src/components/NumericOverflowAlert.jsx')).default
  SpecsPanel = (await server.ssrLoadModule('/src/components/SpecsPanel.jsx')).default
  parseForUI = (await server.ssrLoadModule('/src/state.js')).parseDelimited
  ChartWarnings = (await server.ssrLoadModule('/src/components/ChartWarnings.jsx')).default
})
after(async () => { await server?.close() })

test('chart warning feedback reports omitted legend entries', () => {
  assert.equal(renderToStaticMarkup(createElement(ChartWarnings, { warnings: [] })), '')
  for (const count of [1, 3]) {
    const html = renderToStaticMarkup(createElement(ChartWarnings, { warnings: [['legend-overflow', count]] }))
    assert.match(html, /role="status"/)
    assert.ok(html.includes(`${count} series ${count === 1 ? "doesn&#x27;t" : "don&#x27;t"} fit in the legend.`))
  }
})

test('precision feedback shows at most ten warnings and marks truncated lists', () => {
  for (const length of [0, 1, 10, 11]) {
    const parsed = parseDelimited('X,A\n' + '1,0.1\n'.repeat(length))
    const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
    const { warnings, warningCount } = prepareChart(state, { precision: 'float32' })
    const html = renderToStaticMarkup(createElement(PrecisionWarnings, { warnings, count: warningCount }))
    assert.equal(warnings.length, Math.min(length, 10))
    assert.equal(warningCount, length)
    assert.equal((html.match(/<li>/g) ?? []).length, Math.min(length, 10))
    if (length > 10) assert.ok(html.includes(`List truncated. Showing the first 10 of ${length} warnings.`))
    else assert.doesNotMatch(html, /truncated/)
    if (length) assert.ok(html.includes(`${length} ${length === 1 ? 'value was' : 'values were'} rounded`))
    else assert.equal(html, '')
  }
})

test('overflow feedback shows at most ten errors and marks truncated lists', () => {
  for (const length of [2, 10, 11]) {
    const text = 'X,A\n' + Array.from({ length }, (_, i) => `1,${i + 1}e309`).join('\n')
    assert.throws(() => parseForUI(text), (error) => {
      const html = renderToStaticMarkup(createElement(NumericOverflowAlert, { error }))
      assert.equal(error.errors.length, Math.min(length, 10))
      assert.equal(error.count, length)
      assert.equal((html.match(/<li>/g) ?? []).length, Math.min(length, 10))
      for (let i = 0; i < Math.min(length, 10); i++) assert.ok(html.includes(`${i + 1}e309 `))
      assert.doesNotMatch(html, /11e309/)
      if (length > 10) assert.ok(html.includes(`List truncated. Showing the first 10 of ${length} errors.`))
      else assert.doesNotMatch(html, /truncated/)
      assert.ok(html.includes(`${length} numeric overflow errors:`))
      return true
    })
  }
})

test('import precision feedback uses the truncated count and preserves the first ten positions', () => {
  for (const length of [10, 11]) {
    const parsed = parseDelimited('X,A\n' + '1,1e-400\n'.repeat(length))
    const state = { ...initialState, ...parsed, parseIssues: parsed.issues, series: seriesFromColumns(parsed.columns) }
    const html = renderToStaticMarkup(createElement(DataPanel, { state, onImport: () => {} }))
    assert.equal((html.match(/<li>/g) ?? []).length, 10)
    assert.match(html, /source data row 1\)/)
    assert.match(html, /source data row 10\)/)
    assert.doesNotMatch(html, /source data row 11\)/)
    assert.ok(html.includes(`${length} values were rounded`))
    if (length > 10) assert.match(html, /List truncated. Showing the first 10 of 11 warnings./)
    else assert.doesNotMatch(html, /truncated/)
  }
})

test('notifies the user of float32 overflow instead of displaying a corrupted chart', () => {
  for (const text of ['X,A\n1,1\n2,-1e40\n3,3', 'X,A\n1e40,1\n2e40,2']) {
    const parsed = parseDelimited(text)
    for (const chartType of ['line', 'scatter']) {
      const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns), chartType }
      const html = renderToStaticMarkup(createElement(ChartPreview, { state, precision: 'float32' }))

      assert.match(html, /role="alert"/)
      assert.match(html, /too large for 32-bit precision/)
      assert.match(html, /Switch to 64-bit mode/)
      assert.doesNotMatch(html, /smaller value/)
      assert.doesNotMatch(html, /data points|Hover over|Drop a file|NaN/)

      const fullPrecision = renderToStaticMarkup(createElement(ChartPreview, { state }))
      assert.doesNotMatch(fullPrecision, /role="alert"/)
      assert.match(fullPrecision, /data points/)
    }
  }
})

test('does not hide unrelated chart preparation errors', () => {
  assert.throws(() => renderToStaticMarkup(createElement(ChartPreview, {
    state: initialState, precision: 'float16',
  })), /precision must be/)
})

test('renders all overflow errors together instead of only the first value', () => {
  const parsed = parseDelimited('Time,A,B\n1e40,1e40,1\n2,2,1e40')
  const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
  const html = renderToStaticMarkup(createElement(ChartPreview, { state, precision: 'float32' }))
  assert.match(html, /3 numeric overflow errors:/)
  assert.equal((html.match(/<li>/g) ?? []).length, 3)
  for (const column of ['Time', 'A', 'B']) assert.ok(html.includes(`&quot;${column}&quot;`))
  assert.doesNotMatch(html, /data points|Hover over/)
})

test('precision-loss warnings are visible while the chart remains available', () => {
  const parsed = parseDelimited('Time,A\n1,0.1\n2,1e-50')
  const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
  const html = renderToStaticMarkup(createElement(ChartPreview, { state, precision: 'float32' }))
  assert.match(html, /2 values were rounded/)
  assert.match(html, /0\.10000000149011612/)
  assert.match(html, /rounded to 0/)
  assert.match(html, /2 data points/)
  assert.doesNotMatch(html, /role="alert"/)
})

test('import feedback shows all float64 precision changes and their source data rows', () => {
  const parsed = parseDelimited('X,A\n1,9007199254740993\n2,1e-400\n3,0.1')
  const state = { ...initialState, ...parsed, parseIssues: parsed.issues, series: seriesFromColumns(parsed.columns) }
  const html = renderToStaticMarkup(createElement(DataPanel, { state, onImport: () => {} }))
  assert.match(html, /2 values were rounded/)
  assert.match(html, /9007199254740993/)
  assert.match(html, /9007199254740992/)
  assert.match(html, /source data row 1/)
  assert.match(html, /source data row 2/)
  assert.doesNotMatch(html, /role="alert"|All values are valid/)
})

test('series that are not plotted show a warning instead of a key', () => {
  const columns = Array.from({ length: 14 }, (_, c) => ({ key: `c${c}`, name: c ? `S${c}` : 'X' }))
  for (const chartType of ['line', 'scatter']) {
    const state = { ...initialState, chartType, columns, series: seriesFromColumns(columns) }
    const html = renderToStaticMarkup(createElement(SpecsPanel, { state, update() {}, onReset() {} }))
    assert.equal((html.match(/aria-label="Not plotted: needs an explicit color"/g) ?? []).length, 2, chartType)
    assert.equal((html.match(/class="series-key"/g) ?? []).length, 11, chartType)
    assert.equal((html.match(/type="color"/g) ?? []).length, 13, chartType)
    assert.match(html, /aria-label="Plot S12"/)
    assert.match(html, /aria-label="Plot S13"/)
    assert.doesNotMatch(html, /aria-label="Plot S11"/)
  }
})

test('clicking a series key offers its shapes, with None only on line charts', () => {
  const series = initialState.series.map((oneSeries, i) => i === 0 ? { ...oneSeries, marker: 'none' } : oneSeries)
  const render = (chartType) => renderToStaticMarkup(createElement(SpecsPanel, { state: { ...initialState, chartType, series }, update() {}, onReset() {} }))
  const line = render('line')
  assert.match(line, /<select aria-label="Marker shape for Smitskis owned"[^>]*>(?:(?!<\/select>).)*<option value="none" selected="">None<\/option>/)
  assert.equal((line.match(/<option value="none"/g) ?? []).length, initialState.series.length)
  const scatter = render('scatter')
  assert.doesNotMatch(scatter, /value="none"/)
  assert.match(scatter, /<select aria-label="Marker shape for Smitskis owned"[^>]*><option value="circle" selected="">Circle<\/option>/)
})
