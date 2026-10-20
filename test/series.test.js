import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareSeries } from '../src/graph/series.js'
import { columnsFromPoints } from '../src/graph/pointColumns.js'
import { buildChartData } from '../src/components/charts/chartUtils.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { MAX_AUTO_COLORS } from '../src/graph/colors.js'

test('renderer preparation assigns available colors and excludes excess series', () => {
  const series = Array.from({ length: 13 }, (_, i) => ({ name: `S${i + 1}`, points: [{ x: i, y: i }] }))
  const before = structuredClone(series)
  const plotted = prepareSeries(series)
  assert.equal(plotted.series.length, MAX_AUTO_COLORS)
  assert.equal(new Set(plotted.series.map(s => s.color)).size, MAX_AUTO_COLORS)
  assert.deepEqual(plotted.series.map(s => s.name), series.slice(0, MAX_AUTO_COLORS).map(s => s.name))
  assert.equal(plotted.columns, undefined)
  assert.deepEqual(series, before)
})

test('renderer preparation keeps explicitly colored later series aligned with their Y columns', () => {
  const header = ['X', ...Array.from({ length: 13 }, (_, i) => `S${i + 1}`)].join(',')
  const csv = [header, ...[1, 2].map(x => [x, ...Array.from({ length: 13 }, (_, i) => x * 100 + i)].join(','))].join('\n')
  const parsed = parseDelimited(csv)
  const series = seriesFromColumns(parsed.columns)
  series[12].color = '#000000'
  for (const precision of ['float32', 'float64']) {
    const { columns } = buildChartData({ ...initialState, ...parsed, series }, { precision })
    const before = structuredClone({ columns, series })
    const plotted = prepareSeries(series, columns)
    assert.equal(plotted.series.length, 12)
    assert.equal(plotted.series[11], series[12])
    assert.equal(plotted.series.some(s => s.name === 'S12'), false)
    assert.equal(plotted.columns.x, columns.x)
    assert.equal(plotted.columns.length, columns.length)
    assert.equal(plotted.columns.ys.length, plotted.series.length)
    assert.equal(plotted.columns.ys[11], columns.ys[12])
    assert.deepEqual([...plotted.columns.ys[11]], [112, 212])
    assert.deepEqual({ columns, series }, before)
  }
})

test('explicit colors are not limited and retain the existing numeric storage', () => {
  const series = Array.from({ length: 20 }, (_, i) => ({ name: `S${i}`, color: '#123456' }))
  const columns = { length: 1, x: new Float64Array([1]), ys: series.map(() => new Float64Array([2])) }
  const plotted = prepareSeries(series, columns)
  assert.deepEqual(plotted.series, series)
  assert.equal(plotted.columns, columns)
})

test('disabled point-object series are excluded from columns and hover mapping', () => {
  const series = Array.from({ length: 12 }, (_, i) => ({ name: `S${i + 1}`, points: [{ x: i, y: i }] }))
  series[11].points = [{ x: 1e300, y: 1e300 }]
  const plotted = prepareSeries(series)
  const { columns, hoverPoints } = columnsFromPoints(plotted.series)
  assert.equal(columns.length, 11)
  assert.equal(columns.x.at(-1), 10)
  assert.ok(hoverPoints.every(p => p.seriesNumber < 11))
  assert.equal(hoverPoints.some(p => p.point === series[11].points[0]), false)
})

test('manual colors and empty cell settings preserve series values without reimporting', () => {
  const header = ['X', ...Array.from({ length: 13 }, (_, i) => `S${i + 1}`)].join(',')
  const text = [header, [1, ...Array(11).fill(1), '', '#N/A'].join(','), [2, ...Array(11).fill(2), 5, 9].join(',')].join('\n')
  const parsed = parseDelimited(text, { emptyCells: 'mark' })
  const series = seriesFromColumns(parsed.columns)
  series[12].color = '#000000'
  const state = { ...initialState, ...parsed, series }
  const original = structuredClone(state)
  for (const precision of ['float32', 'float64']) {
    for (const chartType of ['line', 'scatter']) {
      for (const [emptyCells, empty] of [['gap', Infinity], ['connect', -Infinity], ['zero', 0]]) {
        const disabled = prepareChart({ ...state, chartType, emptyCells }, { precision })
        assert.equal(disabled.pointCount, 23)
        assert.equal(disabled.graphProps.series[11].name, 'S13')
        assert.deepEqual([...disabled.graphProps.columns.ys[11]], [-Infinity, 9])
        const enabled = prepareChart({
          ...state, chartType, emptyCells,
          series: series.map((s, i) => i === 11 ? { ...s, color: '#123456' } : s),
        }, { precision })
        assert.equal(enabled.pointCount, emptyCells === 'zero' ? 25 : 24)
        assert.deepEqual([...enabled.graphProps.columns.ys[11]], [empty, 5])
        assert.deepEqual([...enabled.graphProps.columns.ys[12]], [-Infinity, 9])
        assert.ok(enabled.graphProps.columns.ys.every(y => y.every(value => !Number.isNaN(value))))
      }
    }
  }
  assert.deepEqual(state, original)
})
