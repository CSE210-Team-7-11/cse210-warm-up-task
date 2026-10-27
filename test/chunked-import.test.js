import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { initialState, importFile, parseDelimited, seriesFromColumns } from '../src/state.js'
import { buildChartData, createColumnBuilder } from '../src/components/charts/chartUtils.js'
import { checkParsed, summarizeData } from '../src/importFeedback.js'

const stateFor = (parsed) => ({
	...initialState,
	...parsed,
	series: seriesFromColumns(parsed.columns),
})
const fixtures = new URL('./fixtures/', import.meta.url)
for (const name of readdirSync(fixtures).filter((fileName) => /\.(csv|tsv)$/.test(fileName))) {
	test(`chunked import matches the whole-file pipeline for ${name}`, async () => {
		const text = readFileSync(new URL(name, fixtures), 'utf8')
		const expected = parseDelimited(text, { emptyCells: 'mark' })
		for (const chunkSize of [1, 7, Buffer.byteLength(text)]) {
			const actual = await importFile(new File([text], name), {
				chunkSize,
				emptyCells: 'mark',
			})
			assert.equal('rows' in actual, false)
			for (const key of ['columns', 'issues', 'delimiter', 'numberFormat']) {
				assert.deepEqual(actual[key], expected[key], `${key}, ${chunkSize}`)
			}
			for (const precision of ['float32', 'float64']) {
				for (const emptyCells of ['gap', 'zero', 'connect']) {
					const old = buildChartData({ ...stateFor(expected), emptyCells }, { precision })
					const next = buildChartData(
						{
							...stateFor(actual),
							emptyCells,
							get rows() {
								throw Error('Numeric imports must not read rows')
							},
						},
						{ precision },
					)
					assert.deepEqual(next, old, `${precision}, ${emptyCells}, ${chunkSize}`)
					assert.equal(
						next.columns.x instanceof
							(precision === 'float64' ? Float64Array : Float32Array),
						true,
					)
					assert.ok(next.columns.ys.every((y) => !y.some(Number.isNaN)))
				}
			}
			assert.equal(checkParsed(actual, name), checkParsed(expected, name))
			assert.deepEqual(
				summarizeData({ ...actual, sourceName: name }),
				summarizeData({ ...expected, sourceName: name }),
			)
		}
	})
}

test('column growth, stable sorting, gaps and diagnostics are independent of row batch size', () => {
	const rows = Array.from({ length: 4097 }, (_, i) => [
		String(4097 - i),
		i % 11 ? String(i) : '',
		i % 13 ? '#N/A' : `bad-${i}`,
	])
	for (const precision of ['float32', 'float64']) {
		const results = []
		for (const size of [1, 7, rows.length]) {
			const builder = createColumnBuilder(2, { precision, emptyCells: 'mark' })
			for (let i = 0; i < rows.length; i += size) {
				builder.addRows(rows.slice(i, i + size))
			}
			results.push(builder.finish())
		}
		assert.deepEqual(results[0], results[1])
		assert.deepEqual(results[0], results[2])
		const { columns } = results[0]
		assert.equal(columns.length, rows.length)
		assert.deepEqual([columns.x[0], columns.x.at(-1)], [1, 4097])
		assert.equal(columns.x.buffer.byteLength, columns.x.byteLength)
		assert.equal(columns.ys[0][0], 4096)
	}
	const builder = createColumnBuilder(1, { precision: 'float32' })
	builder.addRows([
		['1.00000002', '2'],
		['1.00000001', '1'],
		['1.00000001', '3'],
	])
	assert.deepEqual([...builder.finish().columns.ys[0]], [1, 3, 2])
})

test('quoted records, UTF-8, blanks, newlines and quote errors survive byte boundaries', async () => {
	const cases = [
		'\ufeffX,"é😀\nseries"\n1,2\n2,3',
		'\nX,A\n\n1,"2"oops\n2,3',
		'X,A\n1,2\n\n2,"unclosed',
		'"',
		'X,A\n',
		'\n\n',
		'X\n1\n2',
		'1,2\n2,3',
		'X;A\n1;1.500\n2;1,5',
		'X;A\n1;1.5\n2;1.010,5',
	]
	for (const original of cases) {
		for (const newline of ['\n', '\r\n', '\r']) {
			const text = original.replaceAll('\n', newline)
			const expected = parseDelimited(text)
			for (const chunkSize of [1, 7, 1024]) {
				const actual = await importFile(new File([text], 'edge.csv'), { chunkSize })
				if (!expected) {
					assert.equal(actual, null)
				} else {
					for (const key of ['columns', 'issues', 'delimiter', 'numberFormat']) {
						assert.deepEqual(
							actual[key],
							expected[key],
							`${JSON.stringify(text)}, ${key}, ${chunkSize}`,
						)
					}
					assert.deepEqual(
						actual.numericColumns,
						buildChartData(stateFor(expected)).columns,
					)
				}
			}
		}
	}
})

test('manual number format, Float32 rounding and overflow retain bounded diagnostics', async () => {
	const text = 'X;A\n1;1.500\n2;1,5'
	for (const numberFormat of ['.', ',']) {
		const actual = await importFile(new File([text], 'manual.csv'), {
			numberFormat,
			precision: 'float32',
			chunkSize: 1,
		})
		const expected = parseDelimited(text, { numberFormat })
		assert.deepEqual(actual.issues, expected.issues)
		assert.deepEqual(
			actual.numericColumns,
			buildChartData(stateFor(expected), { precision: 'float32' }).columns,
		)
	}
	for (const value of ['1e309', '1e40']) {
		await assert.rejects(
			importFile(new File(['X,A\n' + `1,${value}\n`.repeat(20)], 'overflow.csv'), {
				precision: 'float32',
				chunkSize: 7,
			}),
			(error) => {
				assert.equal(error.count, 20)
				assert.equal(error.errors.length, 10)
				assert.match(error.message, /List truncated/)
				return true
			},
		)
	}
	const result = await importFile(new File(['X,A\n' + '1,0.1\n'.repeat(20)], 'round.csv'), {
		precision: 'float32',
	})
	assert.equal(result.warningCount, 20)
	assert.equal(result.warnings.length, 10)
	for (const options of [
		{ chunkSize: 0 },
		{ precision: 'float16' },
		{ numberFormat: 'x' },
		{ emptyCells: 'x' },
	]) {
		await assert.rejects(importFile(new File(['X,A\n1,2'], 'bad.csv'), options), TypeError)
	}
	await assert.rejects(
		importFile({
			size: 1,
			slice() {
				throw Error('Read failed')
			},
		}),
		/Read failed/,
	)
})

test('Float32 conversion preserves source sorting and warning order across columns', async () => {
	const text = 'X,A,B\n2.1,0.3,0.2\n1.1,0.2,0.3\n1.1,0.1,0.4'
	const expected = buildChartData(stateFor(parseDelimited(text)), { precision: 'float32' })
	const imported = await importFile(new File([text], 'rounding.csv'), {
		precision: 'float32',
		chunkSize: 7,
	})
	assert.deepEqual(imported.numericColumns, expected.columns)
	assert.deepEqual(imported.warnings, expected.warnings)
	assert.equal(imported.warningCount, expected.warningCount)
})

test('typed imports preserve disabled and manually colored series when changing empty cells', async () => {
	const header = ['X', ...Array.from({ length: 13 }, (_, i) => `S${i + 1}`)].join(',')
	const text = [
		header,
		[1, ...Array(11).fill(1), '', '#N/A'].join(','),
		[2, ...Array(11).fill(2), 5, 9].join(','),
	].join('\n')
	const old = stateFor(parseDelimited(text, { emptyCells: 'mark' }))
	const next = stateFor(
		await importFile(new File([text], 'series.csv'), { emptyCells: 'mark', chunkSize: 7 }),
	)
	for (const state of [old, next]) {
		state.series[12].color = '#000000'
	}
	for (const precision of ['float32', 'float64']) {
		for (const emptyCells of ['gap', 'zero', 'connect']) {
			for (const enable of [false, true]) {
				if (enable) {
					for (const state of [old, next]) {
						state.series[11].color = '#123456'
					}
				}
				const prepare = (state) =>
					buildChartData(
						{ ...state, emptyCells, series: state.series.filter((s) => s.color) },
						{ precision },
					)
				assert.deepEqual(prepare(next), prepare(old))
			}
			old.series[11].color = undefined
			next.series[11].color = undefined
		}
	}
})

test('streaming imports retain 1M points and 1M distinct diagnostic values', async (t) => {
	const length = 1000000
	const parts = ['X,A\n']
	for (let start = 0; start < length; start += 10000) {
		const rows = []
		for (let i = start; i < start + 10000; i++) {
			rows.push(`${i},bad-${i}\n`)
		}
		parts.push(rows.join(''))
	}
	const errors = await importFile(new File(parts, 'errors.csv'))
	const cells = errors.issues[0][1]
	assert.equal(errors.numericColumns.length, length)
	assert.equal(errors.issues[0][0], 'invalid-number')
	assert.equal(cells.length, length)
	for (let i = 0; i < length; i++) {
		assert.equal(errors.numericColumns.x[i], i)
		assert.equal(errors.numericColumns.ys[0][i], Infinity)
		assert.deepEqual(cells[i], [1, i, `bad-${i}`])
	}
	const valid = await importFile(new File(['X,A\n' + '1,2.5\n'.repeat(length)], 'points.csv'))
	assert.deepEqual(valid.issues, [])
	assert.equal(valid.numericColumns.length, length)
	assert.ok(valid.numericColumns.x.every((x) => x === 1))
	assert.ok(valid.numericColumns.ys[0].every((y) => y === 2.5))
	t.diagnostic(
		JSON.stringify({ rows: length, errors: cells.length, points: valid.numericColumns.length }),
	)
})
