// Import feedback: why a file can't be imported, what's wrong with imported
// data, and a compact summary of it. Plain functions with no React, so any
// import UI can share the same checks and wording.
//
// Issues use the ADR-0007 import-result shape, a list of [type, data]:
//   'TooFewFields'    row indexes      row padded with empty cells (parser)
//   'TooManyFields'   row indexes      non-empty extra values dropped (parser)
//   'invalid-x'       row indexes      X missing or not a number; row skipped
//   'invalid-number'  [column, row]s   series value isn't a number; not plotted
//   'empty-cell'      [column, row]s   series value is empty; not plotted
//   'ignored-columns' count            columns past MAX_SERIES; not plotted
// Rows are 0-based indexes into `rows` (the header isn't a row) and column 0
// is X. Messages number rows from 1, matching the data table.

import { MAX_SERIES } from './state.js'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPTED_EXT = /\.(csv|tsv|txt)$/i
const INFO_TYPES = new Set(['empty-cell', 'ignored-columns'])
const MAX_LISTED = 3
const MAX_VALUE_CHARS = 20

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v)

/** Why a file can't be imported, or '' when it's worth reading. */
export function checkFile({ name, size }) {
  if (/\.xlsx?$/i.test(name)) {
    return `${name} is an Excel file. Save it as CSV, then drop the CSV here.`
  }
  if (!ACCEPTED_EXT.test(name)) return `${name} isn’t a CSV, TSV or TXT file.`
  if (size > MAX_FILE_BYTES) {
    const mb = Math.ceil((size / 1024 / 1024) * 10) / 10
    return `${name} is ${mb} MB; the limit is 10 MB.`
  }
  return ''
}

/** Why a parseDelimited() result can't be imported, or '' when it can. */
export function checkParsed(parsed, name) {
  if (!parsed) return `${name} is empty.`
  if (parsed.columns.length < 2) {
    return `${name} has only one column. Separate columns with commas or tabs: X first, then at least one series.`
  }
  if (parsed.rows.length === 0) return `${name} has a header row but no data rows.`
  return ''
}

/** Every issue with the current data: parser issues first, then cell checks. */
export function findIssues({ columns, rows, parseIssues = [] }) {
  const invalidX = []
  const invalidNumbers = []
  const emptyCells = []
  const lastSeries = Math.min(columns.length - 1, MAX_SERIES)
  rows.forEach((row, r) => {
    if (!isNumber(row[0])) {
      invalidX.push(r)
      return
    }
    for (let c = 1; c <= lastSeries; c++) {
      const v = row[c]
      if (v === '' || v === undefined) emptyCells.push([c, r])
      else if (!isNumber(v)) invalidNumbers.push([c, r])
    }
  })

  const issues = [...parseIssues]
  if (invalidX.length) issues.push(['invalid-x', invalidX])
  if (invalidNumbers.length) issues.push(['invalid-number', invalidNumbers])
  if (emptyCells.length) issues.push(['empty-cell', emptyCells])
  const ignored = columns.length - 1 - MAX_SERIES
  if (ignored > 0) issues.push(['ignored-columns', ignored])
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

function shortValue(v) {
  const s = String(v)
  return s.length > MAX_VALUE_CHARS ? `${s.slice(0, MAX_VALUE_CHARS - 1)}…` : s
}

function cellList(cells, columns, rows) {
  const listed = cells.slice(0, MAX_LISTED).map(([c, r]) => {
    const where = `row ${r + 1} (${columns[c]?.name ?? `column ${c + 1}`})`
    return rows ? `“${shortValue(rows[r][c])}” in ${where}` : where
  })
  return listed.join(', ') + more(cells)
}

/** One plain-language sentence for an issue from findIssues(). */
export function describeIssue([type, data], { columns, rows }) {
  const plural = Array.isArray(data) && data.length !== 1
  const xName = columns[0]?.name || 'X'
  switch (type) {
    case 'TooFewFields':
      return `${rowList(data)} ${plural ? 'have' : 'has'} fewer values than there are columns; the missing ones are left empty.`
    case 'TooManyFields':
      return `${rowList(data)} ${plural ? 'have' : 'has'} more values than there are columns, so the extras were dropped. A comma inside a value (like 1,000) can cause this.`
    case 'invalid-x':
      return `${rowList(data)} ${plural ? 'were' : 'was'} skipped because ${plural ? 'their' : 'its'} ${xName} value is missing or isn’t a number.`
    case 'invalid-number':
      return `${count(data.length, 'value isn’t a number', 'values aren’t numbers')} and won’t be plotted: ${cellList(data, columns, rows)}.`
    case 'empty-cell':
      return `${count(data.length, 'empty cell')} won’t be plotted: ${cellList(data, columns)}.`
    case 'ignored-columns':
      return `Only the first ${MAX_SERIES} series are plotted (${count(data, 'column')} ignored).`
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
    seriesCount: Math.max(0, Math.min(columns.length - 1, MAX_SERIES)),
    xName: columns[0]?.name ?? '',
    xRange: xMin <= xMax ? [xMin, xMax] : null,
  }
}
