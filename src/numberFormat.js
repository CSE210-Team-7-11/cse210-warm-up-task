// Spreadsheet number formats.
const DOT_GROUPING = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?(?:[eE][+-]?\d+)?$/
const COMMA_GROUPING = /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d*)?(?:[eE][+-]?\d+)?$/
const NUMERIC_PUNCTUATION = /^[+-]?[\d.,]+(?:[eE][+-]?\d+)?$/

export const isEmptyCell = (value) =>
  value === null || value === undefined || String(value).trim() === ''

// Parse a number or missing-value marker. Returns null if invalid.
export function parseCell(value, decimalSeparator = '.') {
  if (decimalSeparator !== '.' && decimalSeparator !== ',') {
    throw new TypeError('The decimal separator must be "." or ",".')
  }
  if (isEmptyCell(value)) return Infinity
  const text = String(value).trim()
  if (text === '#N/A') return -Infinity
  const grouping = decimalSeparator === '.' ? ',' : '.'
  const groupingPattern = decimalSeparator === '.' ? DOT_GROUPING : COMMA_GROUPING
  if (text.includes(grouping) && !groupingPattern.test(text)) return null
  const normalized = text.replaceAll(grouping, '').replace(decimalSeparator, '.')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

// Detect the file's number format from its placement of ',' and '.'.
export function resolveNumberFormat(rows, width, requested) {
  if (requested !== 'auto') return { numberFormat: requested, issues: [] }
  const formats = new Set()
  let ambiguous = false
  function scan(visit) {
    rows.forEach((row, r) => {
      for (let c = 0; c < Math.min(width, row.length); c++) {
        const text = row[c].trim()
        if (!text.includes('.') || !text.includes(',') || !NUMERIC_PUNCTUATION.test(text)) continue
        const dot = Number.isFinite(parseCell(text, '.'))
        const comma = Number.isFinite(parseCell(text, ','))
        let format = null
        if (dot !== comma) format = dot ? '.' : ','
        visit(format, c, r, row[c])
      }
    })
  }
  scan((format) => {
    if (format === null) ambiguous = true
    else formats.add(format)
  })
  if (!ambiguous && formats.size <= 1) {
    return { numberFormat: formats.values().next().value ?? '.', issues: [] }
  }
  const cells = []
  scan((_, c, r, text) => cells.push([c, r, text]))
  return { numberFormat: '.', issues: [['number-format', cells]] }
}
