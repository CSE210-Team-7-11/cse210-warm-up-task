import assert from 'node:assert/strict'
import test from 'node:test'
import { legendEntries, MAX_LEGEND_ROWS } from '../src/graph/Legend.js'
import { computeLayout } from '../src/graph/scale.js'

const series = (names) => names.map((name) => ({ name, marker: 'circle', color: '#123456' }))
const place = (names, options = {}) =>
	legendEntries({
		series: series(names),
		left: 45,
		right: 495,
		measureText: (label) => label.length * 8,
		...options,
	})

test('short legends stay on the original row and are right aligned using measured widths', () => {
	const result = place(['A', 'BB', 'CCC'])
	assert.equal(result.extraHeight, 0)
	assert.deepEqual(result.warnings, [])
	assert.ok(result.entries.every((e) => e.y === 20))
	assert.equal(result.entries.at(-1).x + result.entries.at(-1).width, 495)
	assert.equal(result.entries[1].x - result.entries[0].x, 29)
})

test('twelve explicit series wrap without changing the plot dimensions', () => {
	const result = place(Array.from({ length: 12 }, (_, i) => `Series ${i + 1}`))
	assert.equal(result.entries.length, 12)
	assert.deepEqual(result.warnings, [])
	assert.ok(result.extraHeight > 0)
	const before = computeLayout({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 })
	const after = computeLayout({
		xMin: 0,
		xMax: 1,
		yMin: 0,
		yMax: 1,
		extraHeight: result.extraHeight,
	})
	assert.equal(after.bottom - after.top, before.bottom - before.top)
	assert.equal(after.right - after.left, before.right - before.left)
	assert.equal(after.height - before.height, result.extraHeight)
	for (const y of new Set(result.entries.map((e) => e.y))) {
		const row = result.entries.filter((e) => e.y === y)
		assert.ok(row[0].x >= 45)
		assert.equal(row.at(-1).x + row.at(-1).width, 495)
		for (let i = 1; i < row.length; i++) {
			assert.ok(row[i].x >= row[i - 1].x + row[i - 1].width + 10)
		}
	}
})

test('measured glyph widths and header text determine placement', () => {
	const narrow = place(['iii', 'WWW'], {
		measureText: (label) => (label === 'iii' ? 3 : 90),
		headerRight: 400,
	})
	assert.equal(narrow.entries[0].width, 14)
	assert.equal(narrow.entries[1].width, 101)
	assert.deepEqual(
		narrow.entries.map((e) => e.y),
		[20, 40],
	)
	const below = place(['long'], { headerRight: 490 })
	assert.equal(below.entries[0].y, 40)
	assert.equal(below.extraHeight, 20)
})

test('overwide entries and excess rows are omitted with an exact warning count', () => {
	const result = place(['x'.repeat(100), ...Array.from({ length: 9 }, (_, i) => `${i}`)], {
		measureText: (label) => (label.length > 1 ? 1000 : 430),
	})
	assert.equal(new Set(result.entries.map((e) => e.y)).size, MAX_LEGEND_ROWS)
	assert.equal(result.entries.length, 4)
	assert.deepEqual(result.warnings, [['legend-overflow', 6]])
	const all = place(['x'.repeat(100)])
	assert.deepEqual(all.entries, [])
	assert.equal(all.extraHeight, 0)
	assert.deepEqual(all.warnings, [['legend-overflow', 1]])
	assert.deepEqual(place([]), { entries: [], extraHeight: 0, warnings: [] })
})
