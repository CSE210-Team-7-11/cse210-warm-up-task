import assert from 'node:assert/strict'
import test from 'node:test'
import { containsMarker } from '../src/graph/markerHit.js'
import { computeLayout, findNearest } from '../src/graph/scale.js'
import { buildChartData } from '../src/components/charts/chartUtils.js'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'

const layout = computeLayout({ xMin: 0, xMax: 100, yMin: 0, yMax: 100 })
function imported(text) {
	const parsed = parseDelimited(text)
	return buildChartData({ ...initialState, ...parsed, series: seriesFromColumns(parsed.columns) })
		.columns
}
const markerOptions = (isAbove) => ({
	maxRadius: 7,
	hitTest: (_s, _i, dx, dy) => containsMarker('circle', -dx, -dy, 7),
	isAbove,
})

test('visible marker shapes include their edges and reject transparent corners', () => {
	assert.equal(containsMarker('circle', 3, 4, 5), true)
	assert.equal(containsMarker('circle', 5, 5, 5), false)
	assert.equal(containsMarker('square', 4.5, 4.5, 5), true)
	assert.equal(containsMarker('square', 5, 5, 5), false)
	assert.equal(containsMarker('triangle', 5, 5, 5), true)
	assert.equal(containsMarker('triangle', 5, -5, 5), false)
	assert.equal(containsMarker('triangle', 0, -6, 5), true)
	assert.equal(containsMarker('triangle', 0, -6.01, 5), false)
	assert.equal(containsMarker('circle', 0, 0, 0), false)
	assert.equal(containsMarker('none', 0, 0, 5), false)
})

test('marker hit testing includes visible outlines', () => {
	assert.equal(containsMarker('circle', 5.5, 0, 5, 0.5), true)
	assert.equal(containsMarker('square', 5.5, 0, 5, 0.5), true)
	assert.equal(containsMarker('square', 5.5, 5.5, 5, 0.5), false)
	assert.equal(containsMarker('triangle', 0, -6.5, 5, 0.5), true)
	assert.equal(containsMarker('triangle', 0, -7.5, 5, 0.5), false)
})

test('a visible upper series wins over a covered point with a closer centre', () => {
	const columns = imported('X,Upper,Lower\n50,52,50')
	const px = layout.toX(50)
	const py = layout.toY(50)
	assert.deepEqual(findNearest(columns, layout, px, py, 10), { seriesIndex: 1, index: 0 })
	assert.deepEqual(findNearest(columns, layout, px, py, 10, markerOptions()), {
		seriesIndex: 0,
		index: 0,
	})
})

test('hover respects the scatter renderer drawing later series on top', () => {
	const columns = imported('X,Lower,Upper\n50,50,52')
	const isAbove = (s, i, otherSeries, otherIndex) =>
		s > otherSeries || (s === otherSeries && i > otherIndex)
	assert.deepEqual(
		findNearest(columns, layout, layout.toX(50), layout.toY(50), 10, markerOptions(isAbove)),
		{ seriesIndex: 1, index: 0 },
	)
})

test('overlapping later rows win even when the nearest centre was an exact hit', () => {
	const columns = imported('X,A\n50,50\n51,50')
	assert.deepEqual(
		findNearest(columns, layout, layout.toX(50), layout.toY(50), 10, markerOptions()),
		{ seriesIndex: 0, index: 1 },
	)
	const duplicates = imported('X,A\n50,50\n50,50')
	assert.deepEqual(
		findNearest(duplicates, layout, layout.toX(50), layout.toY(50), 10, markerOptions()),
		{ seriesIndex: 0, index: 1 },
	)
})

test('visible upper markers are still checked to the left of a covered exact hit', () => {
	const columns = imported('X,Upper,Lower\n49,50,#N/A\n50,#N/A,50')
	assert.deepEqual(
		findNearest(columns, layout, layout.toX(50), layout.toY(50), 10, markerOptions()),
		{ seriesIndex: 0, index: 0 },
	)
})

test('nearest-point selection remains available between markers and when markers are hidden', () => {
	const columns = imported('X,A\n50,50\n51,50')
	const options = { ...markerOptions(), hitTest: () => false }
	assert.deepEqual(
		findNearest(columns, layout, layout.toX(50) - 9, layout.toY(50), 10, options),
		{
			seriesIndex: 0,
			index: 0,
		},
	)
	assert.equal(
		findNearest(columns, layout, layout.toX(50) - 11, layout.toY(50), 10, options),
		null,
	)
	assert.deepEqual(findNearest(columns, layout, layout.toX(50), layout.toY(50), 10), {
		seriesIndex: 0,
		index: 0,
	})
})

test('square corners outside a circular target are still visible hits', () => {
	const columns = imported('X,A\n50,50')
	const options = {
		maxRadius: 3,
		hitTest: (_s, _i, dx, dy) => containsMarker('square', -dx, -dy, 3),
	}
	assert.deepEqual(
		findNearest(columns, layout, layout.toX(50) + 2.5, layout.toY(50) + 2.5, 0, options),
		{ seriesIndex: 0, index: 0 },
	)
})

test('missing values cannot become visible hits and inputs remain unchanged', () => {
	const columns = imported('X,A,B\n50,,50\n51,#N/A,50')
	const before = structuredClone(columns)
	assert.deepEqual(
		findNearest(columns, layout, layout.toX(50), layout.toY(50), 10, markerOptions()),
		{ seriesIndex: 1, index: 1 },
	)
	assert.deepEqual(columns, before)
})
