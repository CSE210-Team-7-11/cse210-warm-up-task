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

export const isValidCellValue = (value, columnIndex) =>
  isNumber(value) || (columnIndex > 0 && (value === Infinity || value === -Infinity ||
    (typeof value === 'string' && value.trim() === '#N/A')))

/** Why a file can't be imported, or '' when it's worth reading. */
export function checkFile({ name }) {
  if (/\.xlsx?$/i.test(name)) {
    return `${name} is an Excel file. Save it as CSV, then drop the CSV here.`
  }
  if (!ACCEPTED_EXT.test(name)) return `${name} isn’t a CSV, TSV or TXT file.`
  return ''
}

/** Why a parseDelimited() result can't be imported, or '' when it can. */
export function checkParsed(parsed, name) {
  if (!parsed) return `${name} is empty.`
  if (parsed.columns.length === 0) {
    if (parsed.issues.some(([type]) => type === 'MissingQuotes')) {
      return `${name} has a quoted field without a closing quote.`
    }
    return `${name} has no readable columns.`
  }
  if (parsed.columns.length < 2) {
    return `${name} has only one column. Separate columns with commas or tabs: X first, then at least one series.`
  }
  if (parsed.rows.length === 0) {
    if (parsed.issues.some(([type]) => type === 'invalid-x')) return `${name} has no valid X values.`
    return `${name} has a header row but no data rows.`
  }
  return ''
}

/** Every issue with the current data: parser issues first, then cell checks. */
export function findIssues({ columns, rows, parseIssues = [], series = [] }) {
  const invalidX = []
  const invalidNumbers = []
  const emptyCells = []
  rows.forEach((row, r) => {
    if (!isNumber(row[0])) {
      invalidX.push(r)
      return
    }
    for (let c = 1; c < columns.length; c++) {
      const v = row[c]
      if (v === '' || v === undefined) emptyCells.push([c, r])
      else if (!isValidCellValue(v, c)) invalidNumbers.push([c, r])
    }
  })

  const issues = [...parseIssues]
  if (invalidX.length) issues.push(['invalid-x', invalidX])
  if (invalidNumbers.length) issues.push(['invalid-number', invalidNumbers])
  if (emptyCells.length) issues.push(['empty-cell', emptyCells])
  const uncolored = series.filter((oneSeries) => !oneSeries.color).length
  if (uncolored) issues.push(['needs-color', uncolored])
  return issues
}

/** Warnings change or drop data the user gave us; the rest are just notes. */
export const isWarning = ([type]) => !INFO_TYPES.has(type)

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function more(items) {
  return items.length > MAX_LISTED ? ` and ${items.length - MAX_LISTED} more` : ''
}

function rowList(rowIndexes) {
  if (rowIndexes.length === 1) return `Row ${rowIndexes[0] + 1}`
  const listed = rowIndexes.slice(0, MAX_LISTED).map((r) => r + 1)
  return `${rowIndexes.length} rows (${listed.join(', ')}${more(rowIndexes)})`
}

const quoteLocations = (data) => Array.isArray(data)
  ? rowList([...new Set(data)])
  : count(data, 'field')

function shortValue(v) {
  const s = String(v)
  return s.length > MAX_VALUE_CHARS ? `${s.slice(0, MAX_VALUE_CHARS - 1)}…` : s
}

function cellList(cells, columns, rows) {
  const listed = cells.slice(0, MAX_LISTED).map(([c, r, text]) => {
    const where = `row ${r + 1} (${columns[c]?.name ?? `column ${c + 1}`})`
    return text !== undefined || rows ? `"${shortValue(text ?? rows?.[r]?.[c])}" in ${where}` : where
  })
  return listed.join(', ') + more(cells)
}

/** Compact data problem, location, and correction where needed. */
export function describeIssue([type, data], { columns, rows }) {
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
      return `${count(data.length, 'nonnumeric value')}: ${cellList(data, columns, rows)}. Replace with numbers.`
    case 'empty-cell':
      return `${count(data.length, 'empty cell')}: ${cellList(data, columns)}.`
    case 'precision-loss':
      return `Rounded for 64-bit precision: ${cellList(data, columns, rows)}.`
    case 'precision-loss-truncated':
      return `${count(data, 'more precision warning')}.`
    case 'duplicate-header':
      return `Duplicate column names: ${data.map((c) => `"${columns[c].name}" (column ${c + 1})`).join(', ')}. Use unique names.`
    case 'number-format':
      return `Invalid or mixed number formats: ${cellList(data, columns, rows)}. Use 1,234.56.`
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

/** Compact facts about the loaded data, for a one- or two-line summary. */
export function summarizeData({ sourceName, columns, rows }) {
  let xMin = Infinity
  let xMax = -Infinity
  for (const row of rows) {
    if (!isNumber(row[0])) continue
    if (row[0] < xMin) xMin = row[0]
    if (row[0] > xMax) xMax = row[0]
  }
  return {
    sourceName,
    rowCount: rows.length,
    seriesCount: Math.max(0, columns.length - 1),
    xName: columns[0]?.name ?? '',
    xRange: xMin <= xMax ? [xMin, xMax] : null,
  }
}
