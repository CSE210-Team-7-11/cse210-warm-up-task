import { isEmptyCell, isNumericOverflow, parseCell } from './numberFormat.js'
import { Float64OverflowError, throwOverflowErrors } from './numericErrors.js'
import { losesFloat64Precision } from './precision.js'
import { addDiagnostic, createDiagnostics } from './diagnostics.js'

export function readHeader(first) {
  const headerIsText = first.some(v => parseCell(v, '.') === null && parseCell(v, ',') === null &&
    !isNumericOverflow(v, '.') && !isNumericOverflow(v, ','))
  const columns = first.map((name, i) => ({ key: `c${i}`, name: headerIsText ? name : `Column ${i + 1}` }))
  return { columns, headerIsText }
}

export function createRowParser(columns, { numberFormat = '.', emptyCells: emptyCellMode = 'gap', headerIsText = false, reuseRows = false, onRow }) {
  const tooFew = []
  const tooMany = []
  const invalidX = []
  const invalidNumbers = []
  const emptyCells = []
  let rowIndex = 0
  const overflowErrors = createDiagnostics()
  const precisionChanges = createDiagnostics()
  const reusable = []
  function importedCell(value, c, r, recordPrecision = true) {
    const parsed = parseCell(value, numberFormat, { emptyCells: c === 0 ? 'gap' : emptyCellMode })
    if (parsed === null && isNumericOverflow(value, numberFormat)) {
      addDiagnostic(overflowErrors, () => new Float64OverflowError(String(value).trim(), columns[c].name, { sourceRow: r }))
    }
    if (recordPrecision && !isEmptyCell(value) && Number.isFinite(parsed) && losesFloat64Precision(value, parsed, numberFormat)) {
      addDiagnostic(precisionChanges, () => [c, r, value, parsed])
    }
    return parsed
  }
  function addRows(rows) {
    rows.forEach((row) => {
      const r = rowIndex++
      if (overflowErrors.count) {
        for (let c = 0; c < columns.length; c++) {
          if (isNumericOverflow(row[c], numberFormat)) {
            addDiagnostic(overflowErrors, () => new Float64OverflowError(String(row[c]).trim(), columns[c].name, { sourceRow: r }))
          }
        }
        return
      }
      if (row.length < columns.length) tooFew.push(r)
      if (row.length > columns.length && row.slice(columns.length).some((v) => !isEmptyCell(v))) tooMany.push(r)
      const x = importedCell(row[0], 0, r)
      if (!Number.isFinite(x)) {
        for (let c = 1; c < columns.length; c++) importedCell(row[c], c, r, false)
        invalidX.push(r)
        return
      }
      const cells = reuseRows ? reusable : []
      cells.length = 1
      cells[0] = x
      for (let c = 1; c < columns.length; c++) {
        const value = row[c]
        const parsed = importedCell(value, c, r)
        if (parsed === null) invalidNumbers.push([c, r, value])
        else if (isEmptyCell(value) && emptyCellMode !== 'zero') emptyCells.push([c, r])
        cells.push(parsed === null ? Infinity : parsed)
      }
      onRow(cells)
    })
  }
  function finish({ parseIssues = [], formatIssues = [] } = {}) {
    throwOverflowErrors(overflowErrors)
    const issues = []
    if (tooFew.length) issues.push(['TooFewFields', tooFew])
    if (tooMany.length) issues.push(['TooManyFields', tooMany])
    issues.push(...parseIssues)
    issues.push(...formatIssues)
    if (invalidX.length) issues.push(['invalid-x', invalidX])
    if (invalidNumbers.length) issues.push(['invalid-number', invalidNumbers])
    if (emptyCells.length) issues.push(['empty-cell', emptyCells])
    if (precisionChanges.count) issues.push(['precision-loss', precisionChanges.items])
    if (precisionChanges.count > precisionChanges.items.length) {
      issues.push(['precision-loss-truncated', precisionChanges.count - precisionChanges.items.length])
    }
    if (headerIsText) {
      const names = new Map()
      columns.forEach(({ name }, c) => {
        if (!names.has(name)) names.set(name, [])
        names.get(name).push(c)
      })
      const duplicates = [...names.values()]
        .filter((indexes) => indexes.length > 1)
        .flat()
        .sort((a, b) => a - b)
      if (duplicates.length) issues.push(['duplicate-header', duplicates])
    }
    return issues
  }
  return { addRows, finish }
}
