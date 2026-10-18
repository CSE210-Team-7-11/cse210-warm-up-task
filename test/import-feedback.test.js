import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_FILE_BYTES,
  checkFile,
  checkParsed,
  describeIssue,
  findIssues,
  isValidCellValue,
  isWarning,
  summarizeData,
} from '../src/importFeedback.js'
import { initialState, parseDelimited } from '../src/state.js'

const columns = [
  { key: 'c0', name: 'Month' },
  { key: 'c1', name: 'Owned' },
  { key: 'c2', name: 'Funds' },
]

test('reports rows the parser padded or cut, but not empty trailing fields', () => {
  const parsed = parseDelimited('Month,Owned,Funds\n1,2\n2,"1,010",5\n3,4,5,\n4,5,6')

  assert.deepEqual(parsed.issues, [['TooFewFields', [0]], ['TooManyFields', [1]]])
  assert.deepEqual(parsed.rows[0], [1, 2, ''])
  assert.deepEqual(parsed.rows[2], [3, 4, 5])
  assert.deepEqual(parseDelimited('a,b\n1,2').issues, [])
})

test('explains why a file is rejected before reading it', () => {
  assert.match(checkFile({ name: 'data.xlsx', size: 10 }), /data\.xlsx is an Excel file\. Save it as CSV/)
  assert.equal(checkFile({ name: 'notes.pdf', size: 10 }), 'notes.pdf isn’t a CSV, TSV or TXT file.')
  assert.equal(checkFile({ name: 'big.csv', size: MAX_FILE_BYTES + 1 }), 'big.csv is 10.1 MB; the limit is 10 MB.')
  assert.equal(checkFile({ name: 'ok.TSV', size: MAX_FILE_BYTES }), '')
})

test('explains why parsed text is rejected', () => {
  assert.equal(checkParsed(parseDelimited(' \n\n'), 'a.csv'), 'a.csv is empty.')
  assert.match(checkParsed(parseDelimited('x;y\n1;2'), 'a.csv'), /only one column\. Separate columns with commas or tabs/)
  assert.equal(checkParsed(parseDelimited('x,y'), 'a.csv'), 'a.csv has a header row but no data rows.')
  assert.equal(checkParsed(parseDelimited('x,y\n1,2'), 'a.csv'), '')
})

test('finds cell issues in the ADR-0007 [type, data] shape, after parser issues', () => {
  const rows = [[1, 2, 3], ['bad', 'also bad', ''], [3, 'n/a', ''], ['', 4, 5]]
  const issues = findIssues({ columns, rows, parseIssues: [['TooFewFields', [2]]] })

  assert.deepEqual(issues, [
    ['TooFewFields', [2]],
    ['invalid-x', [1, 3]],
    ['invalid-number', [[1, 2]]],
    ['empty-cell', [[2, 2]]],
  ])
  assert.deepEqual(issues.map(isWarning), [true, true, true, false])
})

test('only checks plotted columns and counts the ignored ones', () => {
  const wide = [...columns, { key: 'c3', name: 'D' }, { key: 'c4', name: 'E' }]
  assert.deepEqual(findIssues({ columns: wide, rows: [[1, 2, 3, 4, 'text']] }), [['ignored-columns', 1]])
})

test('accepts #N/A in series while retaining invalid X and number warnings', () => {
  const parsed = parseDelimited('X,A,B\n1,#N/A,0\n2, #N/A ,3\n#N/A,4,5\n4,n/a,bad\n5,,6')
  const originalRows = structuredClone(parsed.rows)

  assert.deepEqual(findIssues(parsed), [
    ['invalid-x', [2]],
    ['invalid-number', [[1, 3], [2, 3]]],
    ['empty-cell', [[1, 4]]],
  ])
  assert.deepEqual(parsed.rows, originalRows)
})

test('table validation accepts the series marker but requires numeric X values', () => {
  assert.equal(isValidCellValue('#N/A', 1), true)
  assert.equal(isValidCellValue(' #N/A ', 2), true)
  assert.equal(isValidCellValue('#N/A', 0), false)
  assert.equal(isValidCellValue('n/a', 1), false)
  assert.equal(isValidCellValue('bad', 1), false)
  assert.equal(isValidCellValue(0, 0), true)
  assert.equal(isValidCellValue(0, 1), true)
  assert.equal(isValidCellValue(NaN, 1), false)
  assert.equal(isValidCellValue(Infinity, 1), false)
})

test('the sample data has nothing to report', () => {
  assert.deepEqual(findIssues(initialState), [])
})

test('describes issues with row numbers from 1, column names and offending values', () => {
  const rows = [[1, 'abc', ''], [2, 'n/a', ''], [3, 'x', ''], [4, 'a very long value that keeps going', '']]
  const data = { columns, rows }

  assert.equal(
    describeIssue(['invalid-number', [[1, 0], [1, 1], [1, 2], [1, 3]]], data),
    '4 values aren’t numbers and won’t be plotted: “abc” in row 1 (Owned), “n/a” in row 2 (Owned), “x” in row 3 (Owned) and 1 more.',
  )
  assert.equal(
    describeIssue(['invalid-number', [[1, 3]]], data),
    '1 value isn’t a number and won’t be plotted: “a very long value t…” in row 4 (Owned).',
  )
  assert.equal(describeIssue(['empty-cell', [[2, 0]]], data), '1 empty cell won’t be plotted: row 1 (Funds).')
  assert.equal(
    describeIssue(['invalid-x', [4]], data),
    'Row 5 was skipped because its Month value is missing or isn’t a number.',
  )
  assert.equal(
    describeIssue(['TooManyFields', [0, 1, 2, 3, 4]], data),
    '5 rows (1, 2, 3 and 2 more) have more values than there are columns, so the extras were dropped. A comma inside a value (like 1,000) can cause this.',
  )
  assert.equal(describeIssue(['ignored-columns', 2], data), 'Only the first 3 series are plotted (2 columns ignored).')
  assert.equal(describeIssue(['UndetectableDelimiter', 1], data), 'UndetectableDelimiter: 1.')
})

test('summarizes the source, counts and X range, ignoring invalid X values', () => {
  const rows = [[5, 1, 1], ['bad', 1, 1], [-2, 1, 1], [12, 1, 1]]
  assert.deepEqual(summarizeData({ sourceName: 'a.csv', columns, rows }), {
    sourceName: 'a.csv', rowCount: 4, seriesCount: 2, xName: 'Month', xRange: [-2, 12],
  })
  assert.equal(summarizeData({ sourceName: 'a.csv', columns, rows: [['bad', 1, 1]] }).xRange, null)
})
