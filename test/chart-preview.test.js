import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'

let server
let ChartPreview
let DataPanel
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  ChartPreview = (await server.ssrLoadModule('/src/components/ChartPreview.jsx')).default
  DataPanel = (await server.ssrLoadModule('/src/components/DataPanel.jsx')).default
})
after(async () => { await server?.close() })

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
