import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCell, parseDelimited } from '../src/state.js'

test('defaults to comma thousands and decimal points independently of the delimiter', () => {
	for (const delimiter of [',', ';', '\t']) {
		const text = [
			['X', 'A', 'B', 'C'],
			['1', '1,010', '1.500', '1.5'],
		]
			.map((row) => row.map((value) => `"${value}"`).join(delimiter))
			.join('\n')
		const parsed = parseDelimited(text)
		assert.deepEqual(parsed.rows, [[1, 1010, 1.5, 1.5]])
		assert.equal(parsed.numberFormat, '.')
		assert.deepEqual(parsed.issues, [])
	}
})

test('number conversion validates grouping without changing finite Number-compatible syntax', () => {
	for (const [value, expected] of [
		['1,010', 1010],
		['-1,010.5', -1010.5],
		['1,000,000.25', 1000000.25],
		['1,000e-2', 10],
		['0x10', 16],
		['0b101', 5],
		['0o17', 15],
		['6.02e3', 6020],
		['.5', 0.5],
		['1.', 1],
	]) {
		assert.equal(parseCell(value), expected, value)
	}
	for (const value of ['1,01', '1,2,3', '1234,567', '1,,000', '1.2,3', '1e1,000', '0x1,000']) {
		assert.equal(parseCell(value), null, value)
	}
})

test('explicit decimal comma accepts valid grouping, signs, exponents and Number bases', () => {
	for (const [value, expected] of [
		['1.010,5', 1010.5],
		['1.000.000,25', 1000000.25],
		['1.500', 1500],
		['1,5', 1.5],
		[',5', 0.5],
		['1,', 1],
		['-0,0', -0],
		['+1.000,5e-2', 10.005],
		['0x10', 16],
		['5e-324', Number.MIN_VALUE],
	]) {
		assert.equal(parseCell(value, ','), expected, value)
	}
	for (const value of [
		'1.5',
		'1.00,5',
		'1,000.5',
		'12.34.567,8',
		'1,2,3',
		'Infinity',
		'-Infinity',
	]) {
		assert.equal(parseCell(value, ','), null, value)
	}
})

test('late evidence applies one detected format to earlier cells and numeric first rows', () => {
	const parsed = parseDelimited('1;1.500;1,5\n2;1.010,5;2,5')
	assert.equal(parsed.numberFormat, ',')
	assert.deepEqual(
		parsed.columns.map((column) => column.name),
		['Column 1', 'Column 2', 'Column 3'],
	)
	assert.deepEqual(parsed.rows, [
		[1, 1500, 1.5],
		[2, 1010.5, 2.5],
	])
	assert.deepEqual(parsed.issues, [])
})

test('mixed-separator values detect decimal points and keep the default interpretation elsewhere', () => {
	const parsed = parseDelimited('X;A;B\n1;1,010.5;1.500\n2;2,000.25;0')
	assert.equal(parsed.numberFormat, '.')
	assert.deepEqual(parsed.rows, [
		[1, 1010.5, 1.5],
		[2, 2000.25, 0],
	])
	assert.deepEqual(parsed.issues, [])
})

test('conflicting evidence falls back to decimal points and preserves original offending text', () => {
	const parsed = parseDelimited('X;A\n1;1.010,5\n2;1,010.5\n3;1,010\n4;1.500')
	assert.equal(parsed.numberFormat, '.')
	assert.deepEqual(parsed.rows, [
		[1, Infinity],
		[2, 1010.5],
		[3, 1010],
		[4, 1.5],
	])
	assert.deepEqual(parsed.issues, [
		[
			'number-format',
			[
				[1, 0, '1.010,5'],
				[1, 1, '1,010.5'],
			],
		],
		['invalid-number', [[1, 0, '1.010,5']]],
	])
})

test('invalid grouping in a numeric field containing both separators warns and uses the default', () => {
	const parsed = parseDelimited('X;A;B\n1;1.010,5;1,01.5\n2;1.500;0')
	assert.equal(parsed.numberFormat, '.')
	assert.deepEqual(parsed.rows, [
		[1, Infinity, Infinity],
		[2, 1.5, 0],
	])
	assert.deepEqual(parsed.issues[0], [
		'number-format',
		[
			[1, 0, '1.010,5'],
			[2, 0, '1,01.5'],
		],
	])
})

test('manual choices override detection and suppress automatic ambiguity warnings', () => {
	const text = 'X;A;B\n1;1.010,5;1.500\n2;1,010.5;1,010'
	const dot = parseDelimited(text, { numberFormat: '.' })
	const comma = parseDelimited(text, { numberFormat: ',' })
	assert.equal(dot.numberFormat, '.')
	assert.equal(comma.numberFormat, ',')
	assert.deepEqual(dot.rows, [
		[1, Infinity, 1.5],
		[2, 1010.5, 1010],
	])
	assert.deepEqual(comma.rows, [
		[1, 1010.5, 1500],
		[2, Infinity, 1.01],
	])
	assert.ok([...dot.issues, ...comma.issues].every(([type]) => type !== 'number-format'))
	assert.deepEqual(parseDelimited('X;A\n1;1,5\n2;2,5', { numberFormat: ',' }).rows, [
		[1, 1.5],
		[2, 2.5],
	])
})

test('header labels, dropped extra fields, and nonnumeric text do not select the number format', () => {
	const header = parseDelimited('X;1.010,5;B\n1;1.500;0')
	assert.equal(header.numberFormat, '.')
	assert.deepEqual(header.rows, [[1, 1.5, 0]])
	const extra = parseDelimited('X;A\n1;1.500;1.010,5\n2;0')
	assert.equal(extra.numberFormat, '.')
	assert.deepEqual(extra.issues, [['TooManyFields', [0]]])
	const text = parseDelimited('X;A\n1;version 1.2,3\n2;0')
	assert.equal(text.numberFormat, '.')
	assert.deepEqual(text.issues, [['invalid-number', [[1, 0, 'version 1.2,3']]]])
})

test('ambiguous single separators never request manual input', () => {
	const parsed = parseDelimited('X;A\n1;1,010\n2;1.500\n3;2,000\n4;1.5')
	assert.equal(parsed.numberFormat, '.')
	assert.deepEqual(parsed.rows, [
		[1, 1010],
		[2, 1.5],
		[3, 2000],
		[4, 1.5],
	])
	assert.deepEqual(parsed.issues, [])
})

test('a decimal comma like 1,5 is detected without a grouped value', () => {
	const parsed = parseDelimited('Time;Height;Weight\n1;1,5;2.300\n2,5;3,25;4\n3;-0,75;1,5e2')
	assert.equal(parsed.numberFormat, ',')
	assert.deepEqual(parsed.rows, [
		[1, 1.5, 2300],
		[2.5, 3.25, 4],
		[3, -0.75, 150],
	])
	assert.deepEqual(parsed.issues, [])
})

test('decimal commas and decimal points in one file are reported as mixed', () => {
	const parsed = parseDelimited('X;A\n1;1,010\n2;1.500\n3;1,5\n4;1.5')
	assert.equal(parsed.numberFormat, '.')
	assert.deepEqual(parsed.rows, [
		[1, 1010],
		[2, 1.5],
		[3, Infinity],
		[4, 1.5],
	])
	assert.deepEqual(parsed.issues, [
		[
			'number-format',
			[
				[1, 2, '1,5'],
				[1, 3, '1.5'],
			],
		],
		['invalid-number', [[1, 2, '1,5']]],
	])
})

test('conflicting evidence includes grouped dot-only values', () => {
	const parsed = parseDelimited('X;A;B\n1;1.234.567;1,5\n2;1.5;4')
	assert.equal(parsed.numberFormat, '.')
	assert.deepEqual(parsed.issues, [
		[
			'number-format',
			[
				[1, 0, '1.234.567'],
				[2, 0, '1,5'],
				[1, 1, '1.5'],
			],
		],
		[
			'invalid-number',
			[
				[1, 0, '1.234.567'],
				[2, 0, '1,5'],
			],
		],
	])
})

test('detected format applies to X as well as every series', () => {
	const parsed = parseDelimited('X;A\n1,5;2,5\n1.010,5;3,5')
	assert.deepEqual(parsed.rows, [
		[1.5, 2.5],
		[1010.5, 3.5],
	])
	assert.deepEqual(parsed.issues, [])
})

test('unsupported format options fail explicitly instead of being silently ignored', () => {
	assert.throws(() => parseDelimited('X,A\n1,2', { numberFormat: ';' }), /numberFormat/)
	assert.throws(() => parseDelimited('', { numberFormat: 'unknown' }), /numberFormat/)
	assert.throws(() => parseCell('1', ';'), /decimal separator/)
})

for (const delimiter of [',', ';', '\t']) {
	for (const decimal of ['.', ',']) {
		for (const requested of ['auto', decimal]) {
			test(`number format ${JSON.stringify({ delimiter, decimal, requested })} across spreadsheet dialects`, () => {
				for (const newline of ['\n', '\r\n', '\r']) {
					for (const header of [false, true]) {
						for (const bom of ['', '\ufeff']) {
							const body = [
								['1', decimal === '.' ? '-1,234.5' : '-1.234,5', '0'],
								['2', decimal === '.' ? '1.5' : '1,5', '#N/A'],
								['bad', '12', '30'],
								['3', '   ', '4'],
								['4', 'broken', '5'],
							]
							const records = header ? [['X', 'A', 'B'], ...body] : body
							const text =
								bom +
								records
									.map((row) => row.map((value) => `"${value}"`).join(delimiter))
									.join(newline) +
								newline
							const parsed = parseDelimited(text, { numberFormat: requested })
							assert.equal(parsed.delimiter, delimiter)
							assert.equal(parsed.numberFormat, decimal)
							assert.deepEqual(
								parsed.columns.map((column) => column.name),
								header ? ['X', 'A', 'B'] : ['Column 1', 'Column 2', 'Column 3'],
							)
							assert.deepEqual(parsed.rows, [
								[1, -1234.5, 0],
								[2, 1.5, -Infinity],
								[3, Infinity, 4],
								[4, Infinity, 5],
							])
							assert.deepEqual(parsed.issues, [
								['invalid-x', [2]],
								['invalid-number', [[1, 4, 'broken']]],
								['empty-cell', [[1, 3]]],
							])
						}
					}
				}
			})
		}
	}
}

test('blank cells, skips, zero and non-finite text keep their meaning under either number format', () => {
	for (const decimal of ['.', ',']) {
		for (const value of ['', ' ', '\t', '\r\n', '\u00a0', '\ufeff', null, undefined]) {
			assert.equal(parseCell(value, decimal), Infinity)
		}
		for (const value of ['#N/A', ' #N/A ', '\t#N/A\r\n']) {
			assert.equal(parseCell(value, decimal), -Infinity)
		}
		for (const value of ['0', '+0', `0${decimal}0`]) {
			assert.equal(parseCell(value, decimal), 0)
		}
		assert.equal(parseCell(`-0${decimal}0`, decimal), -0)
		for (const value of [
			'Infinity',
			'+Infinity',
			'-Infinity',
			'NaN',
			'1e309',
			'-1e309',
			'abc',
			'12kg',
			'#n/a',
		]) {
			assert.equal(parseCell(value, decimal), null)
		}
	}
})

test('auto detection accepts signed scientific notation and surrounding whitespace', () => {
	const parsed = parseDelimited('X;A\n1; \t-1.000,5e-2 \n2; +2,5E+1 ')
	assert.equal(parsed.numberFormat, ',')
	assert.deepEqual(parsed.rows, [
		[1, -10.005],
		[2, 25],
	])
	assert.deepEqual(parsed.issues, [])
})

test('conflict fallback is independent of evidence order and keeps original whitespace', () => {
	for (const values of [
		[' 1.010,5 ', '\t1,010.5 '],
		['\t1,010.5 ', ' 1.010,5 '],
	]) {
		const parsed = parseDelimited(
			'X;A\n' + values.map((value, row) => `${row};${value}`).join('\n'),
		)
		assert.equal(parsed.numberFormat, '.')
		assert.deepEqual(parsed.issues[0], [
			'number-format',
			values.map((value, row) => [1, row, value]),
		])
		assert.deepEqual(
			parsed.rows.map((row) => row[1]),
			values.map((value) => (value.includes('1,010.5') ? 1010.5 : Infinity)),
		)
	}
})

test('format evidence can come from X or a series beyond the current plotting limit', () => {
	const x = parseDelimited('X;A\n1.010,5;1.500\n2,5;3,5')
	assert.equal(x.numberFormat, ',')
	assert.deepEqual(x.rows, [
		[1010.5, 1500],
		[2.5, 3.5],
	])
	const laterSeries = parseDelimited('X;A;B;C;D\n1;1.500;2,5;0;1.010,5')
	assert.equal(laterSeries.numberFormat, ',')
	assert.deepEqual(laterSeries.rows, [[1, 1500, 2.5, 0, 1010.5]])
	assert.deepEqual(laterSeries.issues, [])
})

test('a malformed mixed-separator value alone reports its original text and uses the default', () => {
	const parsed = parseDelimited('X;A;B\n1;1,01.5;1.500\n2;2;3')
	assert.equal(parsed.numberFormat, '.')
	assert.deepEqual(parsed.rows, [
		[1, Infinity, 1.5],
		[2, 2, 3],
	])
	assert.deepEqual(parsed.issues, [
		['number-format', [[1, 0, '1,01.5']]],
		['invalid-number', [[1, 0, '1,01.5']]],
	])
})

test('conversion preserves precision and underflow behavior and rejects grouped overflow', () => {
	for (const [value, decimal, expected] of [
		['1.7976931348623157e308', '.', Number.MAX_VALUE],
		['1,7976931348623157e308', ',', Number.MAX_VALUE],
		['5e-324', '.', Number.MIN_VALUE],
		['5e-324', ',', Number.MIN_VALUE],
		['1e-400', '.', 0],
		['-1e-400', ',', -0],
		['0.1000000001', '.', 0.1000000001],
		['0,1000000001', ',', 0.1000000001],
	]) {
		assert.equal(parseCell(value, decimal), expected)
	}
	assert.equal(parseCell('1,000e308', '.'), null)
	assert.equal(parseCell('1.000e308', ','), null)
})
