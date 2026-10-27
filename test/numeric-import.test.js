import assert from 'node:assert/strict'
import test from 'node:test'
import { initialState, parseDelimited, seriesFromColumns } from '../src/state.js'
import { checkParsed, describeIssue, findIssues } from '../src/importFeedback.js'
import { buildChartData } from '../src/components/charts/chartUtils.js'

test('a headerless first record containing #N/A remains data', () => {
	const parsed = parseDelimited('1,#N/A,10\n#N/A,20,30\n2,,40')
	assert.deepEqual(
		parsed.columns.map((column) => column.name),
		['Column 1', 'Column 2', 'Column 3'],
	)
	assert.deepEqual(parsed.rows, [
		[1, -Infinity, 10],
		[2, Infinity, 40],
	])
	assert.deepEqual(parsed.issues, [
		['invalid-x', [1]],
		['empty-cell', [[1, 2]]],
	])
})

test('parser owns invalid X, invalid Y, empty-cell and duplicate-header diagnostics', () => {
	const parsed = parseDelimited('X,A,A,B\n0,0,,#N/A\nbad,broken,,oops\n2, padded ,4,5\n3,6')
	assert.deepEqual(parsed.rows, [
		[0, 0, Infinity, -Infinity],
		[2, Infinity, 4, 5],
		[3, 6, Infinity, Infinity],
	])
	assert.deepEqual(parsed.issues, [
		['TooFewFields', [3]],
		['invalid-x', [1]],
		['invalid-number', [[1, 2, ' padded ']]],
		[
			'empty-cell',
			[
				[2, 0],
				[2, 3],
				[3, 3],
			],
		],
		['duplicate-header', [1, 2]],
	])
	assert.ok(
		parsed.rows.flat().every((value) => typeof value === 'number' && !Number.isNaN(value)),
	)
	const state = {
		...initialState,
		...parsed,
		parseIssues: parsed.issues,
		series: seriesFromColumns(parsed.columns),
	}
	assert.deepEqual(
		findIssues(state),
		parsed.issues,
		'feedback must not invent or duplicate numeric-cell issues',
	)
	const { columns } = buildChartData(state)
	assert.deepEqual(
		columns.ys.map((y) => Array.from(y)),
		[
			[0, Infinity, 6],
			[Infinity, 4, Infinity],
			[-Infinity, 5, Infinity],
		],
	)
})

test('parser and quote-error positions stay in source data rows after invalid X records are removed', () => {
	const parsed = parseDelimited('\nX,A,B\n\nbad,1,2\n1,"first\nsecond",3\n\n,4,5\n2,"broken')
	assert.deepEqual(parsed.rows, [
		[1, Infinity, 3],
		[2, Infinity, Infinity],
	])
	assert.deepEqual(parsed.issues, [
		['TooFewFields', [3]],
		['MissingQuotes', [3]],
		['invalid-x', [0, 2]],
		[
			'invalid-number',
			[
				[1, 1, 'first\nsecond'],
				[1, 3, 'broken'],
			],
		],
		['empty-cell', [[2, 3]]],
	])
	assert.equal(
		describeIssue(parsed.issues[3], parsed),
		'2 nonnumeric values: "first\nsecond" in row 2 (A), "broken" in row 4 (A). Replace with numbers.',
	)
})

test('headers retain distinct keys and report every repeated name, including blank names', () => {
	const parsed = parseDelimited('X,A,,A,,A\n1,2,3,4,5,6')
	assert.deepEqual(
		parsed.columns.map((column) => column.key),
		['c0', 'c1', 'c2', 'c3', 'c4', 'c5'],
	)
	assert.deepEqual(parsed.issues, [['duplicate-header', [1, 2, 3, 4, 5]]])
	assert.deepEqual(
		parseDelimited('1,1,2\n3,4,5').issues,
		[],
		'numeric first rows are not duplicate headers',
	)
})

test('all-invalid-X imports are rejected with the actual cause', () => {
	const parsed = parseDelimited('X,A\n,10\n#N/A,20\nInfinity,30\nabc,40')
	assert.deepEqual(parsed.rows, [])
	assert.deepEqual(parsed.issues, [['invalid-x', [0, 1, 2, 3]]])
	assert.equal(checkParsed(parsed, 'bad.csv'), 'bad.csv has no valid X values.')
})

test('feedback keeps original diagnostic text even when source row indexes exceed returned rows', () => {
	const parsed = parseDelimited('X,A\nbad,10\n,20\n3,"<script>bad</script>"')
	assert.deepEqual(parsed.rows, [[3, Infinity]])
	assert.equal(
		describeIssue(parsed.issues[1], parsed),
		'1 nonnumeric value: "<script>bad</script>" in row 3 (A). Replace with numbers.',
	)
})

test('locale conversion round-trips a deterministic range without silently scaling values', () => {
	for (const decimal of ['.', ',']) {
		const other = decimal === '.' ? ',' : '.'
		const expected = Array.from(
			{ length: 250 },
			(_, index) => (index % 2 ? -1 : 1) * (1000000 + index * 1234.125),
		)
		const values = expected.map((value) => {
			const [integer, fraction] = String(value).split('.')
			const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, other)
			return `${grouped}${decimal}${fraction ?? '0'}`
		})
		const text = 'X;A\n' + values.map((value, row) => `${row};${value}`).join('\n')
		const parsed = parseDelimited(text)
		assert.equal(parsed.numberFormat, decimal)
		assert.deepEqual(
			parsed.rows.map((row) => row[1]),
			expected,
		)
		assert.deepEqual(parsed.issues, [])
	}
})

test('format evidence at the end of a 100k-row file applies to all earlier rows', () => {
	const length = 100000
	const text =
		'X;A\n' +
		Array.from(
			{ length },
			(_, index) => `${index};${index === length - 1 ? '1.010,5' : '1.500'}`,
		).join('\n')
	const parsed = parseDelimited(text)
	assert.equal(parsed.numberFormat, ',')
	assert.equal(parsed.rows.length, length)
	assert.equal(parsed.rows[0][1], 1500)
	assert.equal(parsed.rows[length - 2][1], 1500)
	assert.equal(parsed.rows.at(-1)[1], 1010.5)
	assert.deepEqual(parsed.issues, [])
})

test('manual reimports do not mutate an earlier result or reuse stale detection', () => {
	const text = 'X;A\n1;1.010,5\n2;1.500'
	const detected = parseDelimited(text)
	const before = structuredClone(detected)
	const manual = parseDelimited(text, { numberFormat: '.' })
	assert.deepEqual(manual.rows, [
		[1, Infinity],
		[2, 1.5],
	])
	assert.deepEqual(detected, before)
	assert.deepEqual(parseDelimited(text), before)
})
