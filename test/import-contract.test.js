import assert from 'node:assert/strict'
import test from 'node:test'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { prepareChart } from '../src/components/charts/chartAdapter.js'
import { describeIssue, findIssues } from '../src/importFeedback.js'

// each series' values as { x, y } pairs
const seriesPoints = ({ columns }) =>
	columns.ys.map((ys) => Array.from(columns.x, (x, i) => ({ x, y: ys[i] })))

function imported(text) {
	const parsed = parseDelimited(text)
	return {
		...initialState,
		...parsed,
		parseIssues: parsed.issues,
		series: seriesFromColumns(parsed.columns),
	}
}

test('quoted empty/formula-empty fields break lines, #N/A connects, and actual zeros remain points', () => {
	const state = imported('X,A\n1,10\n2,""\n3,30\n4," #N/A "\n5,50\n6," \t "\n7,0')
	const line = prepareChart(state)
	assert.equal(line.pointCount, 4)
	assert.deepEqual(
		seriesPoints(line.graphProps)[0].map((p) => p.y),
		[10, Infinity, 30, -Infinity, 50, Infinity, 0],
	)
	const scatter = prepareChart({ ...state, chartType: 'scatter' })
	assert.deepEqual(
		seriesPoints(scatter.graphProps)[0].filter((p) => Number.isFinite(p.y)),
		[
			{ x: 1, y: 10 },
			{ x: 3, y: 30 },
			{ x: 5, y: 50 },
			{ x: 7, y: 0 },
		],
	)
	assert.deepEqual(findIssues(state), [
		[
			'empty-cell',
			[
				[1, 1],
				[1, 5],
			],
		],
	])
})

test('all invalid X forms are diagnosed and removed from every plotted series', () => {
	const invalid = ['', '   ', '#N/A', 'Infinity', '-Infinity', 'NaN', 'abc']
	const text = 'X,A,B\n0,0,1\n' + invalid.map((x) => `"${x}",20,30`).join('\n') + '\n2,4,5'
	const state = imported(text)
	assert.deepEqual(findIssues(state), [['invalid-x', invalid.map((_, i) => i + 1)]])
	for (const chartType of ['line', 'scatter']) {
		const chart = prepareChart({ ...state, chartType })
		assert.equal(chart.pointCount, 4)
		assert.deepEqual(seriesPoints(chart.graphProps), [
			[
				{ x: 0, y: 0 },
				{ x: 2, y: 4 },
			],
			[
				{ x: 0, y: 1 },
				{ x: 2, y: 5 },
			],
		])
	}
})

test('invalid Y text produces cell diagnostics and gaps rather than zero or #N/A connections', () => {
	const invalid = ['Infinity', '-Infinity', 'NaN', '12kg', 'true', 'false', 'n/a', '#n/a']
	const state = imported(
		'X,A\n1,10\n' + invalid.map((y, i) => `${i + 2},${y}`).join('\n') + '\n11,20',
	)
	assert.deepEqual(findIssues(state), [
		['invalid-number', invalid.map((value, i) => [1, i + 1, value])],
	])
	const line = prepareChart(state)
	assert.equal(line.pointCount, 2)
	assert.deepEqual(
		seriesPoints(line.graphProps)[0]
			.slice(1, -1)
			.map((p) => p.y),
		invalid.map(() => Infinity),
	)
	assert.deepEqual(
		seriesPoints(prepareChart({ ...state, chartType: 'scatter' }).graphProps)[0].filter((p) =>
			Number.isFinite(p.y),
		),
		[
			{ x: 1, y: 10 },
			{ x: 11, y: 20 },
		],
	)
})

test('quoted locale numbers retain field boundaries and convert without shifting later series', () => {
	for (const [delimiter, value, expected] of [
		[',', '1,010', 1010],
		[';', '1.010,5', 1010.5],
	]) {
		const state = imported(
			`X${delimiter}A${delimiter}B\n1${delimiter}"${value}"${delimiter}905`,
		)
		assert.deepEqual(state.rows, [[1, expected, 905]])
		assert.deepEqual(findIssues(state), [])
		assert.deepEqual(seriesPoints(prepareChart(state).graphProps), [
			[{ x: 1, y: expected }],
			[{ x: 1, y: 905 }],
		])
	}
})

test('parser row issues survive into feedback before cell issues, using one data-row convention', () => {
	const state = imported('\nX,A,B\n\n1,2\n2,3,4,5\n3,bad,6')
	const issues = findIssues(state)
	assert.deepEqual(issues, [
		['TooFewFields', [0]],
		['TooManyFields', [1]],
		['invalid-number', [[1, 2, 'bad']]],
		['empty-cell', [[2, 0]]],
	])
	assert.match(describeIssue(issues[0], state), /^Row 1 /)
	assert.match(describeIssue(issues[1], state), /^Row 2 /)
	assert.match(describeIssue(issues[2], state), /row 3 \(A\)/)
})

test('sorting and plotting retain duplicate X rows, paired values, and the original parsed data', () => {
	const state = imported('X,A,B\n3,30,300\n1,10,100\n1,11,110\n2,20,200')
	const before = structuredClone(state)
	Object.freeze(state.rows)
	for (const row of state.rows) {
		Object.freeze(row)
	}
	for (const chartType of ['line', 'scatter']) {
		assert.deepEqual(
			seriesPoints(prepareChart({ ...state, chartType }).graphProps).map((s) =>
				s.map((p) => [p.x, p.y]),
			),
			[
				[
					[1, 10],
					[1, 11],
					[2, 20],
					[3, 30],
				],
				[
					[1, 100],
					[1, 110],
					[2, 200],
					[3, 300],
				],
			],
		)
	}
	assert.deepEqual(state, before)
})

test('uploaded names and invalid values remain literal text through parsing and chart preparation', () => {
	const state = imported(
		'X,"<b>Cost</b>","<img src=x onerror=""alert(1)"">"\n1,"<script>alert(1)</script>",2',
	)
	assert.deepEqual(
		state.columns.map((c) => c.name),
		['X', '<b>Cost</b>', '<img src=x onerror="alert(1)">'],
	)
	assert.deepEqual(
		prepareChart(state).graphProps.series.map((s) => s.name),
		state.columns.slice(1).map((c) => c.name),
	)
	assert.deepEqual(findIssues(state), [['invalid-number', [[1, 0, '<script>alert(1)</script>']]]])
	assert.match(describeIssue(findIssues(state)[0], state), /<script>/)
})

test('100k imported rows retain counts, endpoints, missing values and series pairing', () => {
	const length = 100000
	const text =
		'X,A,B,C\n' +
		Array.from({ length }, (_, i) =>
			[
				i === 50000 ? 'invalid' : length - i,
				i === 33333 ? '   ' : i,
				i === 66666 ? '#N/A' : i * 2,
				-i,
			].join(','),
		).join('\n')
	const state = imported(text)
	assert.equal(state.rows.length, length - 1)
	assert.deepEqual(findIssues(state), [
		['invalid-x', [50000]],
		['empty-cell', [[1, 33333]]],
	])
	const line = prepareChart(state)
	assert.equal(line.pointCount, length * 3 - 5)
	assert.deepEqual(
		seriesPoints(line.graphProps).map((s) => s.length),
		[length - 1, length - 1, length - 1],
	)
	assert.deepEqual(
		seriesPoints(line.graphProps).map((s) => s[0]),
		[
			{ x: 1, y: 99999 },
			{ x: 1, y: 199998 },
			{ x: 1, y: -99999 },
		],
	)
	assert.deepEqual(
		seriesPoints(line.graphProps).map((s) => s.at(-1)),
		[
			{ x: length, y: 0 },
			{ x: length, y: 0 },
			{ x: length, y: 0 },
		],
	)
	assert.deepEqual(
		seriesPoints(prepareChart({ ...state, chartType: 'scatter' }).graphProps).map(
			(s) => s.filter((p) => Number.isFinite(p.y)).length,
		),
		[length - 2, length - 2, length - 1],
	)
})
