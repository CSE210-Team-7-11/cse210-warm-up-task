import assert from 'node:assert/strict'
import test from 'node:test'
import { computeLayout, findNearest } from '../src/graph/scale.js'
import { dashPattern, drawFrame, drawLegend, drawLines, drawTooltip, formatTicks } from '../src/graph/canvas.js'
import { columnsFromPoints } from '../src/graph/pointColumns.js'
import { parseDelimited } from '../src/state.js'

function recorder() {
  const calls = []
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name in target) return target[name]
      if (name === 'calls') return calls
      if (name === 'createLinearGradient') return () => ({ addColorStop() {} })
      if (name === 'measureText') return (text) => ({ width: text.length * 4 })
      return (...args) => calls.push([name, ...args])
    },
    set(target, name, value) {
      calls.push([`${String(name)}=`, value])
      return true
    },
  })
  return ctx
}

const layout = computeLayout({ xMin: 1, xMax: 5, yMin: 0, yMax: 50 })
const columns = (ys) => ({ length: 5, x: Float64Array.from([1, 2, 3, 4, 5]), ys: ys.map((y) => Float64Array.from(y)) })
const strokes = (ctx) => {
  const paths = []
  let path = []
  for (const [name, ...args] of ctx.calls) {
    if (name === 'beginPath') path = []
    if (name === 'moveTo' || name === 'lineTo') path.push([name, layout.fromX(args[0])])
    if (name === 'stroke') paths.push(path)
  }
  return paths
}

test('dash strings become canvas dash arrays', () => {
  assert.deepEqual(dashPattern('6 4'), [6, 4])
  assert.deepEqual(dashPattern(' 2,3 '), [2, 3])
  assert.deepEqual(dashPattern(''), [])
  assert.deepEqual(dashPattern(undefined), [])
})

test('axis labels retain tiny values without floating-point noise', () => {
  assert.deepEqual(formatTicks([0, 4e-311, 8e-311, 1.2e-310, 1.6e-310, 2e-310]),
    ['0', '4e-311', '8e-311', '1.2e-310', '1.6e-310', '2e-310'])
  assert.deepEqual(formatTicks([-2e-310, -1e-310, -0]), ['-2e-310', '-1e-310', '0'])
  assert.deepEqual(formatTicks([0, 0.2, 0.4, 0.6000000000000001, 0.8, 1]),
    ['0', '0.2', '0.4', '0.6', '0.8', '1'])
})

test('axis labels distinguish narrow ranges and compact large values', () => {
  for (const ticks of [[1, 1.000002, 1.000004], [1e12, 1e12 + 1, 1e12 + 2]]) {
    const labels = formatTicks(ticks)
    assert.equal(new Set(labels).size, ticks.length)
    assert.deepEqual(labels.map(Number), ticks)
  }
  assert.deepEqual(formatTicks([1e100, 2e100, Number.MAX_VALUE]), ['1e+100', '2e+100', '1.8e+308'])
  assert.deepEqual(formatTicks([5, 5, 5]), ['5', '5', '5'])
  assert.deepEqual(formatTicks([]), [])
})

test('tiny X and Y domains draw finite lines and markers at the layout positions', () => {
  for (const tinyX of [false, true]) {
    for (const tinyY of [false, true]) {
      if (!tinyX && !tinyY) continue
      const x = Float64Array.from(tinyX ? [0, 1e-310, 2e-310] : [0, 1, 2])
      const y = Float64Array.from(tinyY ? [-1e-310, 0, 1e-310] : [-1, 0, 1])
      const layout = computeLayout({ xMin: x[0], xMax: x[2], yMin: y[0], yMax: y[2] })
      for (const dense of [false, true]) {
        const ctx = recorder()
        drawLines(ctx, { length: 3, x, ys: [y] }, [{ color: '#000' }], layout, { dense })
        const paths = ctx.calls.filter(([name]) => ['moveTo', 'lineTo', 'arc'].includes(name))
        assert.ok(paths.length > 0)
        assert.ok(paths.every(([, ...args]) => args.every(Number.isFinite)))
        const vertices = paths.filter(([name]) => name !== 'arc').slice(0, 3)
        for (let i = 0; i < 3; i++) {
          assert.ok(Math.abs(vertices[i][1] - layout.toX(x[i])) < 1e-10)
          assert.ok(Math.abs(vertices[i][2] - layout.toY(y[i])) < 1e-10)
        }
      }
    }
  }
})

test('frame labels display distinct scientific values on tiny axes', () => {
  const ctx = recorder()
  const layout = computeLayout({ xMin: 0, xMax: 2e-310, yMin: 0, yMax: 2e-310 })
  drawFrame(ctx, layout, { title: '', subtitle: '', x_axis_label: 'X', y_axis_label: 'Y' })
  const labels = ctx.calls.filter(([name]) => name === 'fillText').map(([, text]) => text)
  assert.deepEqual(labels.slice(2, 8), ['0', '4e-311', '8e-311', '1.2e-310', '1.6e-310', '2e-310'])
  assert.deepEqual(labels.slice(8, 14), labels.slice(2, 8))
})

test('+Infinity breaks a line and -Infinity is skipped', () => {
  const ctx = recorder()
  drawLines(ctx, columns([[10, Infinity, 30, -Infinity, 50]]), [{ color: '#000' }], layout, { showPoints: false })
  const [path] = strokes(ctx)
  assert.deepEqual(path.map(([name, x]) => [name, Math.round(x)]), [['moveTo', 1], ['moveTo', 3], ['lineTo', 5]])
})

test('series 1 is drawn last, each with its own dash', () => {
  const ctx = recorder()
  const series = [{ color: '#a00', dash: '' }, { color: '#0a0', dash: '6 4' }, { color: '#00a', dash: '2 3' }]
  drawLines(ctx, columns([[1, 2, 3, 4, 5], [5, 4, 3, 2, 1], [2, 2, 2, 2, 2]]), series, layout, { showPoints: false })
  const order = ctx.calls.filter(([name]) => name === 'strokeStyle=').map(([, color]) => color)
  const dashes = ctx.calls.filter(([name]) => name === 'setLineDash').map(([, dash]) => dash)
  assert.deepEqual(order, ['#00a', '#0a0', '#a00'])
  assert.deepEqual(dashes, [[2, 3], [6, 4], []])
})

test('markers are outlined, except on dense charts', () => {
  const series = [{ color: '#a00', marker: 'circle' }]
  const data = columns([[1, 2, -Infinity, 4, Infinity]])
  const outlined = recorder()
  drawLines(outlined, data, series, layout, { showPoints: true })
  assert.equal(outlined.calls.filter(([name]) => name === 'fill').length, 3)
  assert.equal(outlined.calls.filter(([name, value]) => name === 'strokeStyle=' && value === '#fff').length, 3)
  const dense = recorder()
  drawLines(dense, data, series, layout, { showPoints: true, dense: true })
  assert.equal(dense.calls.filter(([name]) => name === 'fill').length, 1)
  assert.equal(dense.calls.filter(([name, value]) => name === 'strokeStyle=' && value === '#fff').length, 0)
})

test('labels and series names are drawn as plain text', () => {
  const name = '<b>Cost</b>'
  const texts = (ctx) => ctx.calls.filter(([call]) => call === 'fillText').map(([, text]) => text)
  const legend = recorder()
  drawLegend(legend, [{ name, color: '#a00', marker: 'square' }], layout)
  assert.deepEqual(texts(legend), [name])
  const tooltip = recorder()
  drawTooltip(tooltip, { point: { x: 2, y: 20 }, name, color: '#a00', marker: 'square', xLabel: 'Month', toX: layout.toX, toY: layout.toY, gap: 9, bounds: layout })
  assert.deepEqual(texts(tooltip), ['Month: 2', `${name}: `, '20'])
  const frame = recorder()
  drawFrame(frame, layout, { title: name, subtitle: '', x_axis_label: 'X', y_axis_label: 'Y' })
  assert.equal(texts(frame)[0], name)
})

function pointSeries() {
  const { rows } = parseDelimited('X,A,B\n1,10,50\n2,,40\n3,30,#N/A\n4,#N/A,20\n5,50,10')
  return [0, 1].map((s) => ({
    name: ['A', 'B'][s],
    color: ['#a00', '#00a'][s],
    points: rows.map((row) => ({ x: row[0], y: row[s + 1] })).reverse(),
  }))
}

test('point-object series retain separate values, gaps and connections when drawn', () => {
  const series = pointSeries()
  const original = structuredClone(series)
  const { columns } = columnsFromPoints(series)
  const ctx = recorder()
  drawLines(ctx, columns, series, layout, { showPoints: false })
  assert.deepEqual(strokes(ctx).map((path) => path.map(([name, x]) => [name, Math.round(x)])), [
    [['moveTo', 1], ['lineTo', 2], ['lineTo', 4], ['lineTo', 5]],
    [['moveTo', 1], ['moveTo', 3], ['lineTo', 5]],
  ])
  assert.deepEqual(series, original)
})

test('point-object hover maps sorted rows back to each original series and point', () => {
  const series = pointSeries()
  const { columns, hoverPoints } = columnsFromPoints(series)
  for (const [seriesNumber, oneSeries] of series.entries()) {
    for (const [pointNumber, point] of oneSeries.points.entries()) {
      if (!Number.isFinite(point.y)) continue
      const nearest = findNearest(columns, layout, layout.toX(point.x), layout.toY(point.y), 0)
      assert.equal(nearest.seriesIndex, seriesNumber)
      const mapped = hoverPoints[nearest.index]
      assert.equal(mapped.seriesNumber, seriesNumber)
      assert.equal(mapped.pointNumber, pointNumber)
      assert.equal(mapped.point, point)
    }
  }
})

test('point-object conversion preserves duplicate X rows and independent series lengths', () => {
  const series = pointSeries()
  series[0].points.push({ x: 3, y: 35 })
  series[1].points = [series[1].points[0], series[1].points[4]]
  series.push({ name: 'empty', points: [] })
  const original = structuredClone(series)
  const { columns, hoverPoints } = columnsFromPoints(series)
  for (const [s, oneSeries] of series.entries()) {
    const expected = oneSeries.points.toSorted((a, b) => a.x - b.x)
    const actual = []
    for (let i = 0; i < columns.length; i++) {
      if (hoverPoints[i].seriesNumber === s) actual.push({ x: columns.x[i], y: columns.ys[s][i] })
      else assert.equal(columns.ys[s][i], -Infinity)
    }
    assert.deepEqual(actual, expected)
  }
  assert.deepEqual(series, original)
})

test('point-object conversion handles empty series and excludes nonfinite X rows', () => {
  const series = [{ points: [{ x: NaN, y: 1 }, { x: Infinity, y: 2 }, { x: 1, y: Infinity }] }]
  const { columns, hoverPoints } = columnsFromPoints(series)
  assert.deepEqual(Array.from(columns.x), [1])
  assert.deepEqual(Array.from(columns.ys[0]), [Infinity])
  assert.equal(hoverPoints[0].pointNumber, 2)
  const empty = columnsFromPoints([])
  assert.equal(empty.columns.length, 0)
  assert.deepEqual(empty.columns.ys, [])
  assert.deepEqual(empty.hoverPoints, [])
})
