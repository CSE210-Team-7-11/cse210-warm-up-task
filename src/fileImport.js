import Papa from 'papaparse'
import { createNumberFormatDetector } from './numberFormat.js'
import { readHeader } from './importRows.js'
import { createColumnBuilder } from './components/charts/chartUtils.js'

const blank = row => row.join('').trim() === ''

async function fileDialect(file) {
  let size = Math.min(file.size, 65536)
  while (true) {
    const result = Papa.parse(await file.slice(0, size).text(), { preview: 10, skipEmptyLines: 'greedy' })
    if (size === file.size || result.meta.truncated) return result
    size = Math.min(file.size, size * 2)
  }
}

async function scanFile(file, { delimiter, newline, chunkSize }, visit) {
  // Preserve UTF-8 characters split across byte chunks.
  const decoder = new TextDecoder()
  let pending = ''
  let yielded = performance.now()
  for (let start = 0; start < file.size || start === 0; start += chunkSize) {
    const end = Math.min(start + chunkSize, file.size)
    const finished = end === file.size
    pending += decoder.decode(await file.slice(start, end).arrayBuffer(), { stream: !finished })
    const result = new Papa.Parser({ delimiter, newline }).parse(pending, 0, !finished)
    pending = pending.slice(result.meta.cursor)
    // Incomplete quoted records are reparsed with the next decoded chunk.
    if (!finished) result.errors = result.errors.filter(error => error.row < result.data.length)
    visit(result)
    if (performance.now() - yielded >= 12) {
      await new Promise(resolve => setTimeout(resolve, 0))
      yielded = performance.now()
    }
    if (finished) break
  }
}

export async function importFile(file, { precision = 'float64', numberFormat: requested = 'auto', emptyCells = 'gap', chunkSize = 1024 * 1024 } = {}) {
  if (!['float32', 'float64'].includes(precision)) throw new TypeError('precision must be "float64" or "float32".')
  if (!['auto', '.', ','].includes(requested)) throw new TypeError('numberFormat must be "auto", ".", or ",".')
  if (!['gap', 'zero', 'connect', 'mark'].includes(emptyCells)) throw new TypeError('Invalid emptyCells option.')
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) throw new TypeError('chunkSize must be a positive integer.')
  const sample = await fileDialect(file)
  const dialect = { delimiter: sample.meta.delimiter, newline: sample.meta.linebreak, chunkSize }
  let header
  let detector
  let malformed = false
  await scanFile(file, dialect, result => {
    if (result.errors.length) malformed = true
    const rows = result.data.filter(row => !blank(row))
    if (!header && rows.length) {
      header = readHeader(rows[0])
      detector = createNumberFormatDetector(header.columns.length, requested)
      if (header.headerIsText) rows.shift()
    }
    detector?.addRows(rows)
  })
  if (!header && !malformed) return null
  header ??= { columns: [], headerIsText: false }
  detector ??= createNumberFormatDetector(0, requested)
  const { numberFormat, collectIssues } = detector.finish()
  const builder = createColumnBuilder(Math.max(0, header.columns.length - 1), { ...header, numberFormat, emptyCells, precision })
  const formatCells = []
  const parseErrors = new Map()
  let first = true
  let dataRow = 0
  await scanFile(file, dialect, result => {
    const positions = result.errors.length ? new Map() : null
    const rows = []
    result.data.forEach((row, index) => {
      if (blank(row)) return
      if (first) {
        first = false
        if (header.headerIsText) return
      }
      positions?.set(index, dataRow)
      collectIssues(row, dataRow++, formatCells)
      rows.push(row)
    })
    builder.addRows(rows)
    for (const { code, row } of result.errors) {
      if (!parseErrors.has(code)) parseErrors.set(code, { rows: [], count: 0 })
      const issue = parseErrors.get(code)
      issue.count++
      if (positions.has(row)) issue.rows.push(positions.get(row))
    }
  })
  if (header.columns.length < 2 && sample.errors.some(e => e.code === 'UndetectableDelimiter')) {
    parseErrors.set('UndetectableDelimiter', { rows: [], count: 1 })
  }
  const parseIssues = Array.from(parseErrors, ([code, { rows, count }]) => [code, rows.length === count ? rows : count])
  const built = builder.finish({ parseIssues, formatIssues: formatCells.length ? [['number-format', formatCells]] : [] })
  return { columns: header.columns, numericColumns: built.columns, issues: built.issues, delimiter: dialect.delimiter, numberFormat,
    warnings: built.warnings, warningCount: built.warningCount }
}
