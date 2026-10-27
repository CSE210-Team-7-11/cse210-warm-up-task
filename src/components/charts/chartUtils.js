// @ts-check

import { Float32OverflowError, throwOverflowErrors } from '../../numericErrors.js'

import { precisionWarning } from '../../precision.js'
import { addDiagnostic, createDiagnostics } from '../../diagnostics.js'
import { emptyCellValue } from '../../numberFormat.js'
import { createRowParser } from '../../importRows.js'

// Build sorted numeric columns. Series metadata follows the same order as ys.
export function buildChartData(state, { precision = 'float64' } = {}) {
	if (precision !== 'float64' && precision !== 'float32') {
		throw new TypeError('precision must be "float64" or "float32".')
	}
	const { emptyCells = 'gap' } = state
	if (!['gap', 'zero', 'connect'].includes(emptyCells)) {
		throw new TypeError('emptyCells must be "gap", "zero", or "connect".')
	}
	const Column = precision === 'float32' ? Float32Array : Float64Array
	const empty = emptyCellValue(emptyCells)
	if (state.numericColumns) {
		return convertColumns(state.numericColumns, state.columns, state.series, precision, empty)
	}
	const indexes = []
	for (let i = 0; i < state.rows.length; i++) {
		if (Number.isFinite(state.rows[i][0])) {
			indexes.push(i)
		}
	}
	indexes.sort((a, b) => state.rows[a][0] - state.rows[b][0])

	const length = indexes.length
	const x = new Column(length)
	const ys = state.series.map(() => new Column(length))
	const errors = createDiagnostics()
	const warnings = createDiagnostics()
	for (let i = 0; i < length; i++) {
		const row = state.rows[indexes[i]]
		x[i] = row[0]
		if (precision === 'float32' && !Number.isFinite(x[i])) {
			addDiagnostic(
				errors,
				() => new Float32OverflowError(row[0], state.columns[0]?.name ?? 'X'),
			)
		} else if (!Object.is(row[0], x[i])) {
			addDiagnostic(warnings, () =>
				precisionWarning(row[0], x[i], state.columns[0]?.name ?? 'X', 32),
			)
		}
		for (let s = 0; s < state.series.length; s++) {
			const columnIndex = state.series[s].columnIndex
			const value = Number.isNaN(row[columnIndex]) ? empty : row[columnIndex]
			ys[s][i] = value
			if (precision === 'float32' && Number.isFinite(value) && !Number.isFinite(ys[s][i])) {
				addDiagnostic(
					errors,
					() =>
						new Float32OverflowError(
							value,
							state.columns[columnIndex]?.name ?? `Column ${columnIndex + 1}`,
						),
				)
			} else if (Number.isFinite(value) && !Object.is(value, ys[s][i])) {
				addDiagnostic(warnings, () =>
					precisionWarning(
						value,
						ys[s][i],
						state.columns[columnIndex]?.name ?? `Column ${columnIndex + 1}`,
						32,
					),
				)
			}
		}
	}
	throwOverflowErrors(errors)
	return {
		columns: { length, x, ys },
		series: state.series,
		warnings: warnings.items,
		warningCount: warnings.count,
	}
}

function convertColumns(source, names, series, precision, empty) {
	const Column = precision === 'float32' ? Float32Array : Float64Array
	const errors = createDiagnostics()
	const warnings = createDiagnostics()
	const selected = [0, ...series.map((s) => s.columnIndex)]
	const originals = selected.map((c) => (c === 0 ? source.x : source.ys[c - 1]))
	const buffers = originals.map((values) =>
		values instanceof Column && (Number.isNaN(empty) || !values.some(Number.isNaN))
			? values
			: new Column(source.length),
	)
	if (buffers.every((buffer, c) => buffer === originals[c])) {
		return {
			columns: { length: source.length, x: buffers[0], ys: buffers.slice(1) },
			series,
			warnings: [],
			warningCount: 0,
		}
	}
	for (let i = 0; i < source.length; i++) {
		for (let c = 0; c < buffers.length; c++) {
			if (buffers[c] === originals[c]) {
				continue
			}
			const value = Number.isNaN(originals[c][i]) ? empty : originals[c][i]
			buffers[c][i] = value
			const stored = buffers[c][i]
			const columnName = names[selected[c]].name
			if (Number.isFinite(value) && !Number.isFinite(stored)) {
				addDiagnostic(errors, () => new Float32OverflowError(value, columnName))
			} else if (Number.isFinite(value) && !Object.is(value, stored)) {
				addDiagnostic(warnings, () => precisionWarning(value, stored, columnName, 32))
			}
		}
	}
	const [x, ...ys] = buffers
	throwOverflowErrors(errors)
	return {
		columns: { length: source.length, x, ys },
		series,
		warnings: warnings.items,
		warningCount: warnings.count,
	}
}

export function createColumnBuilder(
	seriesCount,
	{
		columns = Array.from({ length: seriesCount + 1 }, (_, i) => ({
			key: `c${i}`,
			name: `Column ${i + 1}`,
		})),
		numberFormat = '.',
		emptyCells = 'gap',
		precision = 'float64',
		headerIsText = false,
	} = {},
) {
	if (!Number.isSafeInteger(seriesCount) || seriesCount < 0) {
		throw new TypeError('seriesCount must be a nonnegative integer.')
	}
	if (!['float32', 'float64'].includes(precision)) {
		throw new TypeError('precision must be "float64" or "float32".')
	}
	if (!['gap', 'zero', 'connect', 'mark'].includes(emptyCells)) {
		throw new TypeError('Invalid emptyCells option.')
	}
	if (!['.', ','].includes(numberFormat)) {
		throw new TypeError('The decimal separator must be "." or ",".')
	}
	let capacity = 1024
	let length = 0
	let sorted = true
	let buffers = Array.from({ length: seriesCount + 1 }, () => new Float64Array(capacity))
	const parser = createRowParser(columns, {
		numberFormat,
		emptyCells,
		headerIsText,
		reuseRows: true,
		onRow(row) {
			if (length === capacity) {
				capacity *= 2
				buffers = buffers.map((buffer) => {
					const grown = new Float64Array(capacity)
					grown.set(buffer)
					return grown
				})
			}
			if (length && row[0] < buffers[0][length - 1]) {
				sorted = false
			}
			for (let c = 0; c < buffers.length; c++) {
				buffers[c][length] = row[c]
			}
			length++
		},
	})
	function finish(options) {
		const issues = parser.finish(options)
		if (sorted) {
			buffers = buffers.map((b) => (b.length === length ? b : b.slice(0, length)))
		} else {
			const indexes = Array.from({ length }, (_, i) => i)
			indexes.sort((a, b) => buffers[0][a] - buffers[0][b])
			buffers = buffers.map((b) => {
				const ordered = new Float64Array(length)
				for (let i = 0; i < length; i++) {
					ordered[i] = b[indexes[i]]
				}
				return ordered
			})
		}
		const source = { length, x: buffers[0], ys: buffers.slice(1) }
		const series = Array.from({ length: seriesCount }, (_, i) => ({ columnIndex: i + 1 }))
		const result =
			precision === 'float64'
				? { columns: source, warnings: [], warningCount: 0 }
				: convertColumns(source, columns, series, precision, emptyCellValue(emptyCells))
		return {
			columns: result.columns,
			issues,
			warnings: result.warnings,
			warningCount: result.warningCount,
		}
	}
	return { addRows: parser.addRows, finish }
}
