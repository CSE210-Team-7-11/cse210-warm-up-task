// Spreadsheet number formats.
const DOT_GROUPING = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?(?:[eE][+-]?\d+)?$/
const COMMA_GROUPING = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d*)?(?:[eE][+-]?\d+)?$/
const NUMERIC_PUNCTUATION = /^[+-]?[\d.,]+(?:[eE][+-]?\d+)?$/

export const isEmptyCell = (value) =>
	value === null || value === undefined || String(value).trim() === ''

export function normalizeNumberText(text, decimalSeparator) {
	const grouping = decimalSeparator === '.' ? ',' : '.'
	const groupingPattern = decimalSeparator === '.' ? DOT_GROUPING : COMMA_GROUPING
	if (text.includes(grouping) && !groupingPattern.test(text)) {
		return null
	}
	return text.replaceAll(grouping, '').replace(decimalSeparator, '.')
}

function numericValue(text, decimalSeparator) {
	const normalized = normalizeNumberText(text, decimalSeparator)
	return normalized === null ? NaN : Number(normalized)
}

// Literal Infinity is invalid text; numeric input such as 1e309 is overflow.
export function isNumericOverflow(value, decimalSeparator) {
	if (isEmptyCell(value)) {
		return false
	}
	const text = String(value).trim()
	if (/^[+-]?Infinity$/.test(text)) {
		return false
	}
	const number = numericValue(text, decimalSeparator)
	return number === Infinity || number === -Infinity
}

export function emptyCellValue(emptyCells) {
	if (emptyCells === 'zero') {
		return 0
	}
	if (emptyCells === 'connect') {
		return -Infinity
	}
	return emptyCells === 'mark' ? NaN : Infinity
}

// Parse a number or missing-value marker. Returns null if invalid.
export function parseCell(value, decimalSeparator = '.', { emptyCells = 'gap' } = {}) {
	if (decimalSeparator !== '.' && decimalSeparator !== ',') {
		throw new TypeError('The decimal separator must be "." or ",".')
	}
	if (!['gap', 'zero', 'connect', 'mark'].includes(emptyCells)) {
		throw new TypeError('emptyCells must be "gap", "zero", "connect", or "mark".')
	}
	if (isEmptyCell(value)) {
		return emptyCellValue(emptyCells)
	}
	const text = String(value).trim()
	if (text === '#N/A') {
		return -Infinity
	}
	const number = numericValue(text, decimalSeparator)
	return Number.isFinite(number) ? number : null
}

// Detect the file's number format from its placement of ',' and '.'.
export function resolveNumberFormat(rows, width, requested) {
	const detector = createNumberFormatDetector(width, requested)
	detector.addRows(rows)
	const { numberFormat, collectIssues } = detector.finish()
	const cells = []
	rows.forEach((row, r) => collectIssues(row, r, cells))
	return { numberFormat, issues: cells.length ? [['number-format', cells]] : [] }
}

function formatEvidence(text) {
	if ((!text.includes(',') && !text.includes('.')) || !NUMERIC_PUNCTUATION.test(text)) {
		return undefined
	}
	if (!text.includes(',')) {
		const dot = !Number.isNaN(Number(text))
		const comma = COMMA_GROUPING.test(text)
		if (dot === comma) {
			return undefined
		}
		return dot ? '.' : ','
	}
	if (!text.includes('.')) {
		if (!Number.isNaN(Number(text.replace(',', '.')))) {
			return DOT_GROUPING.test(text) ? undefined : ','
		}
		return DOT_GROUPING.test(text) ? '.' : undefined
	}
	const dot = Number.isFinite(parseCell(text, '.')) || isNumericOverflow(text, '.')
	const comma = Number.isFinite(parseCell(text, ',')) || isNumericOverflow(text, ',')
	if (dot !== comma) {
		return dot ? '.' : ','
	}
	return null
}

export function createNumberFormatDetector(width, requested = 'auto') {
	const formats = new Set()
	let ambiguous = false
	let dotOnly = false
	function addRows(rows) {
		if (requested !== 'auto') {
			return
		}
		for (const row of rows) {
			for (let c = 0; c < Math.min(width, row.length); c++) {
				const text = row[c].trim()
				if (!text.includes(',')) {
					if (!dotOnly && formatEvidence(text) === '.') {
						dotOnly = true
					}
					continue
				}
				const format = formatEvidence(text)
				if (format === undefined) {
					continue
				}
				if (format === null) {
					ambiguous = true
				} else {
					formats.add(format)
				}
			}
		}
	}
	function finish() {
		const includeDotOnly = formats.has(',')
		if (includeDotOnly && dotOnly) {
			formats.add('.')
		}
		const conflict = ambiguous || formats.size > 1
		let numberFormat = requested
		if (requested === 'auto') {
			numberFormat = conflict ? '.' : (formats.values().next().value ?? '.')
		}
		return {
			numberFormat,
			collectIssues(row, r, cells) {
				if (requested !== 'auto' || !conflict) {
					return
				}
				for (let c = 0; c < Math.min(width, row.length); c++) {
					const text = row[c].trim()
					if (
						(text.includes(',') || includeDotOnly) &&
						formatEvidence(text) !== undefined
					) {
						cells.push([c, r, row[c]])
					}
				}
			},
		}
	}
	return { addRows, finish }
}
