import assert from 'node:assert/strict'
import test from 'node:test'
import { bounds, computeLayout, findNearest, minMax, trendLine } from '../src/graph/scale.js'
import {
	dashPattern,
	drawFrame,
	drawLegend,
	drawLines,
	drawMarker,
	drawTooltip,
	drawTrendLines,
	formatTicks,
} from '../src/graph/canvas.js'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'

function recorder() {
	const calls = []
	const ctx = new Proxy(
		{},
		{
			get(target, name) {
				if (name in target) {
					return target[name]
				}
				if (name === 'calls') {
					return calls
				}
				if (name === 'createLinearGradient') {
					return () => ({ addColorStop() {} })
				}
				if (name === 'measureText') {
					return (text) => ({ width: text.length * 4 })
				}
				return (...args) => calls.push([name, ...args])
			},
			set(target, name, value) {
				calls.push([`${String(name)}=`, value])
				return true
			},
		},
	)
	return ctx
}

const baseLayout = computeLayout({ xMin: 1, xMax: 5, yMin: 0, yMax: 50 })
const columnsFromY = (ys) => ({
	length: 5,
	x: Float64Array.from([1, 2, 3, 4, 5]),
	ys: ys.map((y) => Float64Array.from(y)),
})
const strokes = (ctx) => {
	const paths = []
	let path = []
	for (const [name, ...args] of ctx.calls) {
		if (name === 'beginPath') {
			path = []
		}
		if (name === 'moveTo' || name === 'lineTo') {
			path.push([name, baseLayout.fromX(args[0])])
		}
		if (name === 'stroke') {
			paths.push(path)
		}
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
	assert.deepEqual(formatTicks([0, 4e-311, 8e-311, 1.2e-310, 1.6e-310, 2e-310]), [
		'0',
		'4e-311',
		'8e-311',
		'1.2e-310',
		'1.6e-310',
		'2e-310',
	])
	assert.deepEqual(formatTicks([-2e-310, -1e-310, -0]), ['-2e-310', '-1e-310', '0'])
	assert.deepEqual(formatTicks([0, 0.2, 0.4, 0.6000000000000001, 0.8, 1]), [
		'0',
		'0.2',
		'0.4',
		'0.6',
		'0.8',
		'1',
	])
})

test('axis labels distinguish narrow ranges and compact large values', () => {
	for (const ticks of [
		[1, 1.000002, 1.000004],
		[1e12, 1e12 + 1, 1e12 + 2],
	]) {
		const labels = formatTicks(ticks)
		assert.equal(new Set(labels).size, ticks.length)
		assert.deepEqual(labels.map(Number), ticks)
	}
	assert.deepEqual(formatTicks([1e100, 2e100, Number.MAX_VALUE]), [
		'1e+100',
		'2e+100',
		'1.8e+308',
	])
	assert.deepEqual(formatTicks([5, 5, 5]), ['5', '5', '5'])
	assert.deepEqual(formatTicks([]), [])
})

test('tiny X and Y domains draw finite lines and markers at the layout positions', () => {
	for (const tinyX of [false, true]) {
		for (const tinyY of [false, true]) {
			if (!tinyX && !tinyY) {
				continue
			}
			const x = Float64Array.from(tinyX ? [0, 1e-310, 2e-310] : [0, 1, 2])
			const y = Float64Array.from(tinyY ? [-1e-310, 0, 1e-310] : [-1, 0, 1])
			const layout = computeLayout({ xMin: x[0], xMax: x[2], yMin: y[0], yMax: y[2] })
			for (const dense of [false, true]) {
				const ctx = recorder()
				drawLines(ctx, { length: 3, x, ys: [y] }, [{ color: '#000' }], layout, { dense })
				const paths = ctx.calls.filter(([name]) =>
					['moveTo', 'lineTo', 'arc'].includes(name),
				)
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
	assert.deepEqual(labels.slice(2, 8), [
		'0',
		'4e-311',
		'8e-311',
		'1.2e-310',
		'1.6e-310',
		'2e-310',
	])
	assert.deepEqual(labels.slice(8, 14), labels.slice(2, 8))
})

test('+Infinity breaks a line and -Infinity is skipped', () => {
	const ctx = recorder()
	drawLines(
		ctx,
		columnsFromY([[10, Infinity, 30, -Infinity, 50]]),
		[{ color: '#000' }],
		baseLayout,
		{ showPoints: false },
	)
	const [path] = strokes(ctx)
	assert.deepEqual(
		path.map(([name, x]) => [name, Math.round(x)]),
		[
			['moveTo', 1],
			['moveTo', 3],
			['lineTo', 5],
		],
	)
})

test('series 1 is drawn last, each with its own dash', () => {
	const ctx = recorder()
	const series = [
		{ color: '#a00', dash: '' },
		{ color: '#0a0', dash: '6 4' },
		{ color: '#00a', dash: '2 3' },
	]
	drawLines(
		ctx,
		columnsFromY([
			[1, 2, 3, 4, 5],
			[5, 4, 3, 2, 1],
			[2, 2, 2, 2, 2],
		]),
		series,
		baseLayout,
		{ showPoints: false },
	)
	const order = ctx.calls.filter(([name]) => name === 'strokeStyle=').map(([, color]) => color)
	const dashes = ctx.calls.filter(([name]) => name === 'setLineDash').map(([, dash]) => dash)
	assert.deepEqual(order, ['#00a', '#0a0', '#a00'])
	assert.deepEqual(dashes, [[2, 3], [6, 4], []])
})

test('markers are outlined, except on dense charts', () => {
	const series = [{ color: '#a00', marker: 'circle' }]
	const data = columnsFromY([[1, 2, -Infinity, 4, Infinity]])
	const outlined = recorder()
	drawLines(outlined, data, series, baseLayout, { showPoints: true })
	assert.equal(outlined.calls.filter(([name]) => name === 'fill').length, 3)
	assert.equal(
		outlined.calls.filter(([name, value]) => name === 'strokeStyle=' && value === '#fff')
			.length,
		3,
	)
	const dense = recorder()
	drawLines(dense, data, series, baseLayout, { showPoints: true, dense: true })
	assert.equal(dense.calls.filter(([name]) => name === 'fill').length, 1)
	assert.equal(
		dense.calls.filter(([name, value]) => name === 'strokeStyle=' && value === '#fff').length,
		0,
	)
})

test('labels and series names are drawn as plain text', () => {
	const name = '<b>Cost</b>'
	const texts = (ctx) => ctx.calls.filter(([call]) => call === 'fillText').map(([, text]) => text)
	const legend = recorder()
	drawLegend(legend, [{ name, color: '#a00', marker: 'square' }], baseLayout)
	assert.deepEqual(texts(legend), [name])
	const tooltip = recorder()
	drawTooltip(tooltip, {
		point: { x: 2, y: 20 },
		name,
		color: '#a00',
		marker: 'square',
		xLabel: 'Month',
		toX: baseLayout.toX,
		toY: baseLayout.toY,
		gap: 9,
		bounds: baseLayout,
	})
	assert.deepEqual(texts(tooltip), ['Month: 2', `${name}: `, '20'])
	const frame = recorder()
	drawFrame(frame, baseLayout, {
		title: name,
		subtitle: '',
		x_axis_label: 'X',
		y_axis_label: 'Y',
	})
	assert.equal(texts(frame)[0], name)
})

function drawnSegments({ columns, series }, includeY = false) {
	const { min: xMin, max: xMax } = minMax(columns.x)
	const layout = computeLayout({ xMin, xMax, yMin: 0, yMax: 60 })
	return series.map((oneSeries, s) => {
		const ctx = recorder()
		drawLines(ctx, { ...columns, ys: [columns.ys[s]] }, [oneSeries], layout, {
			showPoints: false,
		})
		const segments = []
		for (const [call, x, y] of ctx.calls) {
			if (call === 'moveTo') {
				segments.push([])
			}
			if (call === 'moveTo' || call === 'lineTo') {
				const value = Math.round(layout.fromX(x))
				segments.at(-1).push(includeY ? [value, Math.round(layout.fromY(y))] : value)
			}
		}
		return segments
	})
}

function importedChart(text) {
	const parsed = parseDelimited(text)
	return prepareChart({
		...initialState,
		...parsed,
		series: seriesFromColumns(parsed.columns),
		chartType: 'line',
	}).graphProps
}

test('the empty cell setting decides how Canvas lines cross empty cells', () => {
	const cases = [
		[
			'gap',
			[
				[
					[[1, 10]],
					[
						[3, 30],
						[4, 0],
					],
				],
				[[[2, 20]], [[4, 40]]],
			],
		],
		[
			'connect',
			[
				[
					[
						[1, 10],
						[3, 30],
						[4, 0],
					],
				],
				[
					[
						[2, 20],
						[4, 40],
					],
				],
			],
		],
		[
			'zero',
			[
				[
					[
						[1, 10],
						[2, 0],
						[3, 30],
						[4, 0],
					],
				],
				[
					[
						[1, 0],
						[2, 20],
						[3, 0],
						[4, 40],
					],
				],
			],
		],
	]
	for (const [emptyCells, expected] of cases) {
		const parsed = parseDelimited('X,A,B\n1,10,\n2,,20\n3,30,\n4,0,40', { emptyCells })
		const state = { ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) }
		assert.deepEqual(drawnSegments(prepareChart(state).graphProps, true), expected)
	}
})

test('Canvas breaks at CSV empty cells and connects across #N/A independently per series', () => {
	const graph = importedChart('X,A,B\n1,10,15\n2,20,25\n3,,#N/A\n4,40,45\n5,50,55')
	assert.deepEqual(drawnSegments(graph), [
		[
			[1, 2],
			[4, 5],
		],
		[[1, 2, 4, 5]],
	])
})

test('changing the empty cell setting changes Canvas lines without reimporting the data', () => {
	const parsed = parseDelimited('X,A,B\n1,10,\n2,,20\n3,30,\n4,0,40', { emptyCells: 'mark' })
	const state = {
		...initialState,
		...parsed,
		series: seriesFromColumns(parsed.columns),
		chartType: 'line',
	}
	const original = structuredClone(parsed.rows)
	for (const [emptyCells, expected] of [
		[
			'gap',
			[
				[
					[[1, 10]],
					[
						[3, 30],
						[4, 0],
					],
				],
				[[[2, 20]], [[4, 40]]],
			],
		],
		[
			'connect',
			[
				[
					[
						[1, 10],
						[3, 30],
						[4, 0],
					],
				],
				[
					[
						[2, 20],
						[4, 40],
					],
				],
			],
		],
		[
			'zero',
			[
				[
					[
						[1, 10],
						[2, 0],
						[3, 30],
						[4, 0],
					],
				],
				[
					[
						[1, 0],
						[2, 20],
						[3, 0],
						[4, 40],
					],
				],
			],
		],
		[
			'gap',
			[
				[
					[[1, 10]],
					[
						[3, 30],
						[4, 0],
					],
				],
				[[[2, 20]], [[4, 40]]],
			],
		],
	]) {
		assert.deepEqual(
			drawnSegments(prepareChart({ ...state, emptyCells }).graphProps, true),
			expected,
			emptyCells,
		)
		assert.deepEqual(parsed.rows, original)
	}
})

test('Canvas skips do not erase a break or create segments at missing-only edges', () => {
	const graph = importedChart(
		'X,A\n0,#N/A\n1,\n2,0\n3,#N/A\n4,\n5,#N/A\n6,\n7,8\n8,9\n9,#N/A\n10,',
	)
	assert.deepEqual(drawnSegments(graph), [[[2], [7, 8]]])
	assert.deepEqual(drawnSegments(importedChart('X,A\n1,\n2,#N/A')), [[]])
})

test('Canvas draws quoted empty fields as breaks, #N/A as a connection, and zero as a point', () => {
	const graph = importedChart('X,A\n1,10\n2,""\n3,30\n4," #N/A "\n5,50\n6," \t "\n7,0')
	assert.deepEqual(drawnSegments(graph), [[[1], [3, 5], [7]]])
})

test('Canvas breaks at diagnosed invalid Y text rather than connecting or plotting zero', () => {
	const invalid = ['Infinity', '-Infinity', 'NaN', '12kg', 'true', 'false', 'n/a', '#n/a']
	const graph = importedChart(
		'X,A\n1,10\n' + invalid.map((y, i) => `${i + 2},${y}`).join('\n') + '\n11,20',
	)
	assert.deepEqual(drawnSegments(graph), [[[1], [11]]])
})

test('dense Canvas drawing records only markers that survived pixel deduplication', () => {
	const data = {
		length: 4,
		x: new Float64Array([1, 1, 1, 2]),
		ys: [new Float64Array([10, 10, Infinity, 20])],
	}
	const ctx = recorder()
	const rows = drawLines(ctx, data, [{ color: '#a00' }], baseLayout, { dense: true })
	assert.equal(rows[0][0], 0b1001)
	assert.equal(
		drawLines(recorder(), data, [{ color: '#a00' }], baseLayout, { dense: false }),
		null,
	)
	assert.equal(
		drawLines(recorder(), data, [{ color: '#a00' }], baseLayout, {
			dense: true,
			showPoints: false,
		}),
		null,
	)
})

// the shape, color and center of each marker drawn at size 7
function drawnMarkers(ctx) {
	const markers = []
	let fill
	for (const [name, ...args] of ctx.calls) {
		const last = markers.at(-1)
		if (name === 'fillStyle=') {
			fill = args[0]
		}
		if (name === 'fill') {
			for (const marker of markers) {
				marker.color ??= fill
			}
		}
		if (name === 'arc') {
			markers.push({ shape: 'circle', x: args[0], y: args[1] })
		}
		if (name === 'moveTo') {
			markers.push({ x: args[0], y: args[1] })
		}
		if (name === 'arcTo' && !last.shape) {
			Object.assign(last, { shape: 'square', x: last.x + 2.5, y: last.y + 3.5 })
		}
		if (name === 'closePath' && !last.shape) {
			Object.assign(last, { shape: 'triangle', y: last.y + 4.35 })
		}
	}
	return markers.filter((marker) => marker.shape)
}

test('scatter markers for the sample data keep their positions, shapes and colors', () => {
	const { graphProps } = prepareChart({ ...initialState, chartType: 'scatter' })
	const { columns, series } = graphProps
	const layout = computeLayout(bounds(columns))
	const ctx = recorder()
	drawLines(ctx, columns, series, layout, { showLines: false })
	const expected = []
	series.toReversed().forEach((oneSeries, r) => {
		const s = series.length - 1 - r
		for (let i = 0; i < columns.length; i++) {
			const y = columns.ys[s][i]
			if (Number.isFinite(y)) {
				expected.push({
					shape: oneSeries.marker,
					color: oneSeries.color,
					x: layout.toX(columns.x[i]),
					y: layout.toY(y),
				})
			}
		}
	})
	const markers = drawnMarkers(ctx)
	assert.equal(markers.length, expected.length)
	assert.deepEqual(
		new Set(markers.map((marker) => marker.shape)),
		new Set(series.map((oneSeries) => oneSeries.marker)),
	)
	markers.forEach((marker, i) => {
		assert.equal(marker.shape, expected[i].shape)
		assert.equal(marker.color, expected[i].color)
		assert.ok(
			Math.abs(marker.x - expected[i].x) < 1e-9 && Math.abs(marker.y - expected[i].y) < 1e-9,
		)
	})
	assert.equal(ctx.calls.filter(([name]) => name === 'setLineDash').length, 0)
})

test('a 100,000-point scatter draws in batches and its points can be hovered', () => {
	const length = 100_000
	const x = Float64Array.from({ length }, (_, i) => i)
	const y = Float64Array.from({ length }, (_, i) => Math.sin(i / 1000) * 50 + (i % 7))
	const data = { length, x, ys: [y] }
	const layout = computeLayout(bounds(data))
	const ctx = recorder()
	const rows = drawLines(ctx, data, [{ color: '#a00', marker: 'square' }], layout, {
		showLines: false,
		dense: true,
	})
	const fills = ctx.calls.filter(([name]) => name === 'fill').length
	const drawn = rows[0].reduce(
		(sum, byte) => sum + byte.toString(2).replaceAll('0', '').length,
		0,
	)
	assert.ok(drawn > 0 && drawn < length)
	assert.equal(fills, Math.floor(drawn / 256) + 1)
	const nearest = findNearest(data, layout, layout.toX(x[500]), layout.toY(y[500]), 10)
	assert.equal(nearest.seriesIndex, 0)
	assert.ok(Math.abs(nearest.index - 500) < 100)
})

test('trend lines are dashed, faded and clipped to the plot area', () => {
	const ctx = recorder()
	drawTrendLines(
		ctx,
		[
			{ color: '#a00', firstX: 1, firstY: 0, lastX: 5, lastY: 60 },
			{ firstX: 1, firstY: 10, lastX: 5, lastY: 10 },
		],
		baseLayout,
	)
	const { left, right, top, bottom } = baseLayout
	const round = (value) => Math.round(value * 1e6) / 1e6
	const calls = ctx.calls.map(([name, ...args]) => [
		name,
		...args.map((value) => (typeof value === 'number' ? round(value) : value)),
	])
	assert.deepEqual(calls.slice(0, 5), [
		['save'],
		['beginPath'],
		['rect', left, top, right - left, bottom - top],
		['clip'],
		['globalAlpha=', 0.5],
	])
	assert.deepEqual(
		calls.find(([name]) => name === 'setLineDash'),
		['setLineDash', [4, 3]],
	)
	assert.deepEqual(
		calls.filter(([name]) => ['moveTo', 'lineTo', 'strokeStyle='].includes(name)),
		[
			['moveTo', round(baseLayout.toX(1)), round(baseLayout.toY(0))],
			['lineTo', round(baseLayout.toX(5)), round(baseLayout.toY(60))],
			['strokeStyle=', '#a00'],
			['moveTo', round(baseLayout.toX(1)), round(baseLayout.toY(10))],
			['lineTo', round(baseLayout.toX(5)), round(baseLayout.toY(10))],
			['strokeStyle=', '#256b47'],
		],
	)
	assert.deepEqual(calls.at(-1), ['restore'])
})

test('series with one point or a single X value have no trend line', () => {
	assert.equal(trendLine([1, 2], [5, -Infinity], 2), null)
	assert.equal(trendLine([2, 2, 2], [1, 5, 9], 3), null)
})

test('finite trend lines can extend beyond the data bounds and remain clipped', () => {
	const graph = importedChart('X,A\n-0.55,-8.2\n-0.275,-8.2\n0.275,8.2\n0.55,8.2')
	const layout = computeLayout(bounds(graph.columns))
	const fit = trendLine(graph.columns.x, graph.columns.ys[0], graph.columns.length)
	const trend = {
		...fit,
		firstY: fit.slope * fit.firstX + fit.startHeight,
		lastY: fit.slope * fit.lastX + fit.startHeight,
	}
	const ctx = recorder()
	drawTrendLines(ctx, [trend], layout)
	const move = ctx.calls.find(([name]) => name === 'moveTo')
	const line = ctx.calls.find(([name]) => name === 'lineTo')
	assert.deepEqual(move, ['moveTo', layout.toX(trend.firstX), layout.toY(trend.firstY)])
	assert.deepEqual(line, ['lineTo', layout.toX(trend.lastX), layout.toY(trend.lastY)])
	assert.ok(move[2] > layout.bottom)
	assert.ok(line[2] < layout.top)
	assert.ok(ctx.calls.some(([name]) => name === 'clip'))
})

test('trend projection overflow reports the source column and restores Canvas state', () => {
	for (const values of [
		['-8.2e307', '-8.2e307', '8.2e307', '8.2e307'],
		['8.2e307', '8.2e307', '-8.2e307', '-8.2e307'],
	]) {
		const text =
			'Time,Trial A\n' +
			['-0.55', '-0.275', '0.275', '0.55'].map((x, i) => `${x},${values[i]}`).join('\n')
		const graph = importedChart(text)
		const layout = computeLayout({
			...bounds(graph.columns),
			xColumnName: 'Time',
			yColumnName: 'Trial A',
		})
		const fit = trendLine(graph.columns.x, graph.columns.ys[0], graph.columns.length)
		const trend = {
			...fit,
			firstY: fit.slope * fit.firstX + fit.startHeight,
			lastY: fit.slope * fit.lastX + fit.startHeight,
		}
		assert.ok(Object.values(fit).every(Number.isFinite))
		assert.ok(Number.isFinite(trend.firstY) && Number.isFinite(trend.lastY))
		const ctx = recorder()
		assert.throws(() => drawTrendLines(ctx, [trend], layout), {
			name: 'Float64OverflowError',
			message:
				'The chart position for 9.84e+307 in "Trial A" is too large for 64-bit precision.',
		})
		assert.ok(
			ctx.calls.every((call) =>
				call.every((value) => typeof value !== 'number' || Number.isFinite(value)),
			),
		)
		assert.equal(
			ctx.calls.some(([name]) => name === 'moveTo' || name === 'lineTo'),
			false,
		)
		assert.deepEqual(ctx.calls.at(-1), ['restore'])
	}
})

test('a series without a marker keeps its line while the others keep their markers', () => {
	const series = [
		{ color: '#a00', marker: 'none' },
		{ color: '#00a', marker: 'square' },
	]
	const data = columnsFromY([
		[1, 2, 3, 4, 5],
		[5, 4, 3, 2, 1],
	])
	for (const dense of [false, true]) {
		const ctx = recorder()
		const rows = drawLines(ctx, data, series, baseLayout, { dense })
		const fills = []
		let fill
		for (const [name, value] of ctx.calls) {
			if (name === 'fillStyle=') {
				fill = value
			}
			if (name === 'fill') {
				fills.push(fill)
			}
		}
		assert.ok(fills.length > 0 && fills.every((color) => color === '#00a'), String(dense))
		assert.equal(strokes(ctx).filter((path) => path.length === 5).length, 2)
		if (dense) {
			assert.ok(rows[0].every((byte) => byte === 0))
		}
	}
})

test('the legend keys a series without markers by a short line', () => {
	const ctx = recorder()
	drawLegend(ctx, [{ name: 'A', color: '#a00', marker: 'none' }], baseLayout)
	assert.equal(
		ctx.calls.some(([name]) => name === 'fill' || name === 'arc'),
		false,
	)
	assert.deepEqual(
		ctx.calls.filter(([name]) => ['strokeStyle=', 'lineWidth='].includes(name)),
		[
			['strokeStyle=', '#a00'],
			['lineWidth=', 2],
		],
	)
})

test('no marker is drawn for a shape of none, whoever draws it', () => {
	const ctx = recorder()
	drawMarker(ctx, 'none', 10, 10, 7, '#a00')
	assert.deepEqual(ctx.calls, [])
})
