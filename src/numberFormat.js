// Spreadsheet number formats.
const DOT_GROUPING = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?(?:[eE][+-]?\d+)?$/
const COMMA_GROUPING = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d*)?(?:[eE][+-]?\d+)?$/
const NUMERIC_PUNCTUATION = /^[+-]?[\d.,]+(?:[eE][+-]?\d+)?$/

export const isEmptyCell = (value) =>
  value === null || value === undefined || String(value).trim() === ''

export function normalizeNumberText(text, decimalSeparator) {
  const grouping = decimalSeparator === '.' ? ',' : '.'
  const groupingPattern = decimalSeparator === '.' ? DOT_GROUPING : COMMA_GROUPING
  if (text.includes(grouping) && !groupingPattern.test(text)) return null
  return text.replaceAll(grouping, '').replace(decimalSeparator, '.')
}

function numericValue(text, decimalSeparator) {
  const normalized = normalizeNumberText(text, decimalSeparator)
  return normalized === null ? NaN : Number(normalized)
}

// Literal Infinity is invalid text; numeric input such as 1e309 is overflow.
export function isNumericOverflow(value, decimalSeparator) {
  if (isEmptyCell(value)) return false
  const text = String(value).trim()
  if (/^[+-]?Infinity$/.test(text)) return false
  const number = numericValue(text, decimalSeparator)
  return number === Infinity || number === -Infinity
}

export function emptyCellValue(emptyCells) {
  if (emptyCells === 'zero') return 0
  if (emptyCells === 'connect') return -Infinity
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
  if (isEmptyCell(value)) return emptyCellValue(emptyCells)
  const text = String(value).trim()
  if (text === '#N/A') return -Infinity
  const number = numericValue(text, decimalSeparator)
  return Number.isFinite(number) ? number : null
}

// Detect the file's number format from its placement of ',' and '.'.
export function resolveNumberFormat(rows, width, requested) {
  if (requested !== 'auto') return { numberFormat: requested, issues: [] }
  const formats = new Set()
  let ambiguous = false
  function scan(visit, includeDotOnly) {
    rows.forEach((row, r) => {
      for (let c = 0; c < Math.min(width, row.length); c++) {
        const text = row[c].trim()
        const hasComma = text.includes(',')
        const hasDot = text.includes('.')
        if (!(hasComma || (includeDotOnly && hasDot)) || !NUMERIC_PUNCTUATION.test(text)) continue
        const dot = Number.isFinite(parseCell(text, '.')) || isNumericOverflow(text, '.')
        const comma = Number.isFinite(parseCell(text, ',')) || isNumericOverflow(text, ',')
        let format = null
        if (dot !== comma) format = dot ? '.' : ','
        else if (!hasDot || !hasComma) continue
        visit(format, c, r, row[c])
      }
    })
  }
  const record = (format) => {
    if (format === null) ambiguous = true
    else formats.add(format)
  }
  scan(record, false)
  if (formats.has(',')) scan(record, true)
  if (!ambiguous && formats.size <= 1) {
    return { numberFormat: formats.values().next().value ?? '.', issues: [] }
  }
  const cells = []
  scan((_, c, r, text) => cells.push([c, r, text]), formats.has(','))
  return { numberFormat: '.', issues: [['number-format', cells]] }
}
