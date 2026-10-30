// @ts-check

// Import feedback: why a file can't be imported, what's wrong with imported
// data, and a compact summary of it. Plain functions with no React, so any
// import UI can share the same checks and wording.
//
// Issues use the ADR-0007 import-result shape, a list of [type, data]:
//   'TooFewFields'     row indexes           row padded with empty cells
//   'TooManyFields'    row indexes           non-empty extra values dropped
//   'invalid-x'        row indexes           X invalid; row skipped
//   'invalid-number'   [column, row, text]s  invalid series value; not plotted
//   'empty-cell'       [column, row]s        series value is empty; not plotted
//   'duplicate-header' column indexes        repeated header names
//   'number-format'    [column, row, text]s  separators don't agree
//   'needs-color'      count                 series without a color; not plotted
// Row indexes refer to source data records, excluding headers and blanks.
// Messages show row numbers starting from 1.

import { MAX_AUTO_COLORS } from './graph/colors.js'

const ACCEPTED_EXT = /\.(csv|tsv|txt)$/i
const INFO_TYPES = new Set(['empty-cell', 'precision-loss', 'precision-loss-truncated'])
const MAX_LISTED = 3
const MAX_VALUE_CHARS = 20

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * Check the file extension before reading its contents. This does not parse
 * the file or impose a size limit; a supported extension can still contain
 * invalid data and must pass checkParsed after import.
 * @param {Object} file - Browser File or an object with a filename.
 * @param {string} file.name - Filename, including its extension.
 * @returns {string} A rejection message, or an empty string to continue reading.
 */
export function checkFile({ name }) {
	if (/\.xlsx?$/i.test(name)) {
		return `${name} is an Excel file. Save it as CSV, then drop the CSV here.`
	}
	if (!ACCEPTED_EXT.test(name)) {
		return `${name} isn’t a CSV, TSV or TXT file.`
	}
	return ''
}

/**
 * Decide whether a parsed dataset can replace the editor's current data.
 * Accepts both parseDelimited rows and importFile numeric columns. Missing
 * closing quotes, fewer than two columns, or no usable X rows reject the
 * result. Other diagnostics remain available as non-blocking feedback.
 * @param {ParsedDataset|null} parsed
 *   Parser result with either legacy rows or typed numericColumns, or null for empty input.
 * @param {string} name - Filename used in rejection messages.
 * @returns {string} A rejection message, or an empty string for an accepted result.
 */
export function checkParsed(parsed, name) {
	if (!parsed) {
		return `${name} is empty.`
	}
	if (parsed.issues.some(([type]) => type === 'MissingQuotes')) {
		return `${name} has a quoted field without a closing quote.`
	}
	if (parsed.columns.length === 0) {
		return `${name} has no readable columns.`
	}
	if (parsed.columns.length < 2) {
		return `${name} has only one column. Separate columns with commas or tabs: X first, then at least one series.`
	}
	const length = parsed.numericColumns ? parsed.numericColumns.length : parsed.rows.length
	if (length === 0) {
		if (parsed.issues.some(([type]) => type === 'invalid-x')) {
			return `${name} has no valid X values.`
		}
		return `${name} has a header row but no data rows.`
	}
	return ''
}

/**
 * Combine parser diagnostics with the editor's missing-color warning.
 * Returns a new outer array; diagnostic entries are shared and must be treated
 * as read-only. Raw cells are not scanned again, preserving source locations.
 * @param {Object} input - Current editor diagnostics and series styles.
 * @param {ImportIssues} [input.parseIssues=[]] - Parser [type, data] entries.
 * @param {Array<SeriesStyle>} [input.series=[]] - Series with an optional color.
 * @returns {ImportIssues} Parser issues followed by needs-color when applicable.
 */
export function findIssues({ parseIssues = [], series = [] }) {
	const issues = [...parseIssues]
	const uncolored = series.filter((oneSeries) => !oneSeries.color).length
	if (uncolored) {
		issues.push(['needs-color', uncolored])
	}
	return issues
}

/**
 * Classify diagnostics for the import panel. Empty-cell and precision entries
 * are notes; DataPanel presents precision details through PrecisionWarnings.
 * @param {ImportIssues[number]} issue - A [type, data] diagnostic entry.
 * @returns {boolean} Whether to show this issue as a general import warning.
 */
export const isWarning = ([type]) => !INFO_TYPES.has(type)

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function more(items) {
	return items.length > MAX_LISTED ? ` and ${items.length - MAX_LISTED} more` : ''
}

function rowList(rowIndexes) {
	if (rowIndexes.length === 1) {
		return `Row ${rowIndexes[0] + 1}`
	}
	const listed = rowIndexes.slice(0, MAX_LISTED).map((r) => r + 1)
	return `${rowIndexes.length} rows (${listed.join(', ')}${more(rowIndexes)})`
}

const quoteLocations = (data) =>
	Array.isArray(data) ? rowList([...new Set(data)]) : count(data, 'field')

function shortValue(v) {
	const s = String(v)
	return s.length > MAX_VALUE_CHARS ? `${s.slice(0, MAX_VALUE_CHARS - 1)}…` : s
}

function cellList(cells, columns) {
	const listed = cells.slice(0, MAX_LISTED).map(([c, r, text]) => {
		const where = `row ${r + 1} (${columns[c]?.name ?? `column ${c + 1}`})`
		return text !== undefined ? `"${shortValue(text)}" in ${where}` : where
	})
	return listed.join(', ') + more(cells)
}

/**
 * Describe one diagnostic using column names and one-based source data rows.
 * Source rows exclude the header and blank records; they are not sorted chart
 * indexes or physical text-file line numbers. Long cell lists are abbreviated.
 * @param {ImportIssues[number]} issue - A [type, data] entry from the parser or findIssues.
 * @param {Object} context - Column metadata for the imported file.
 * @param {Array<{key: string, name: string}>} context.columns - Columns in their original order.
 * @returns {string} Plain text for React to render, not an HTML fragment.
 */
export function describeIssue([type, data], { columns }) {
	const plural = Array.isArray(data) && data.length !== 1
	const xName = columns[0]?.name || 'X'
	switch (type) {
		case 'TooFewFields':
			return `${rowList(data)} ${plural ? 'have' : 'has'} fewer values than there are columns.`
		case 'TooManyFields':
			return `${rowList(data)} ${plural ? 'have' : 'has'} more values than there are columns`
		case 'invalid-x':
			return `${rowList(data)}: ${xName} must be a number.`
		case 'invalid-number':
			return `${count(data.length, 'nonnumeric value')}: ${cellList(data, columns)}. Replace with numbers.`
		case 'empty-cell':
			return `${count(data.length, 'empty cell')}: ${cellList(data, columns)}.`
		case 'precision-loss':
			return `Rounded for 64-bit precision: ${cellList(data, columns)}.`
		case 'precision-loss-truncated':
			return `${count(data, 'more precision warning')}.`
		case 'duplicate-header':
			return `Duplicate column names: ${data.map((c) => `"${columns[c].name}" (column ${c + 1})`).join(', ')}. Use unique names.`
		case 'number-format':
			return `Invalid or mixed number formats: ${cellList(data, columns)}. Use 1,234.56.`
		case 'needs-color':
			return `Series after the first ${MAX_AUTO_COLORS} need an explicit color: ${count(data, 'series', 'series')} not plotted.`
		case 'UndetectableDelimiter':
			return 'Column separator not detected. Use commas or tabs.'
		case 'MissingQuotes':
			return `Missing closing quote: ${quoteLocations(data)}.`
		case 'InvalidQuotes':
			return `Invalid quotes: ${quoteLocations(data)}. Escape quotes inside fields as "".`
		default:
			return `${type}: ${Array.isArray(data) ? count(data.length, 'place') : data}.`
	}
}

/**
 * Summarize the loaded dataset without modifying it. Typed columns take
 * precedence over legacy rows. Row count describes retained rows; series
 * count includes all Y columns, even those awaiting a manual color.
 * @param {DatasetSummaryInput} input - Filename, column metadata, and at least one
 *   data representation. Typed columns take precedence when both are supplied.
 * @returns {{sourceName: string, rowCount: number, seriesCount: number, xName: string, xRange: Array<number>|null}}
 *   Finite X bounds, or null when no finite X value exists, plus dataset counts.
 */
export function summarizeData(input) {
	const { sourceName, columns } = input
	let xMin = Infinity
	let xMax = -Infinity
	const length = input.numericColumns ? input.numericColumns.length : input.rows.length
	for (let i = 0; i < length; i++) {
		const x = input.numericColumns ? input.numericColumns.x[i] : input.rows[i][0]
		if (!isNumber(x)) {
			continue
		}
		if (x < xMin) {
			xMin = x
		}
		if (x > xMax) {
			xMax = x
		}
	}
	return {
		sourceName,
		rowCount: length,
		seriesCount: Math.max(0, columns.length - 1),
		xName: columns[0]?.name ?? '',
		xRange: xMin <= xMax ? [xMin, xMax] : null,
	}
}
