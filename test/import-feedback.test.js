import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkFile,
  checkParsed,
  describeIssue,
  findIssues,
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
  const parsed = parseDelimited('Month,Owned,Funds\n1,2\n2,3,4,5\n3,4,5,\n4,5,6')

  assert.deepEqual(parsed.issues, [['TooFewFields', [0]], ['TooManyFields', [1]], ['empty-cell', [[2, 0]]]])
  assert.deepEqual(parsed.rows[0], [1, 2, Infinity])
  assert.deepEqual(parsed.rows[2], [3, 4, 5])
  assert.deepEqual(parseDelimited('a,b\n1,2').issues, [])
})

test('explains why a file is rejected before reading it', () => {
  assert.match(checkFile({ name: 'data.xlsx', size: 10 }), /data\.xlsx is an Excel file\. Save it as CSV/)
  assert.equal(checkFile({ name: 'notes.pdf', size: 10 }), 'notes.pdf isn’t a CSV, TSV or TXT file.')
  assert.equal(checkFile({ name: 'big.csv', size: 1024 ** 3 }), '')
  assert.equal(checkFile({ name: 'ok.TSV', size: 10 }), '')
})

test('explains why parsed text is rejected', () => {
  assert.equal(checkParsed(parseDelimited(' \n\n'), 'a.csv'), 'a.csv is empty.')
  assert.equal(checkParsed(parseDelimited('"'), 'a.csv'), 'a.csv has a quoted field without a closing quote.')
  assert.match(checkParsed(parseDelimited('x\n1'), 'a.csv'), /only one column\. Separate columns with commas or tabs/)
  assert.equal(checkParsed(parseDelimited('x,y'), 'a.csv'), 'a.csv has a header row but no data rows.')
  assert.equal(checkParsed(parseDelimited('x,y\n1,2'), 'a.csv'), '')
})

test('an unclosed quote rejects the file even when earlier rows were read', () => {
  const parsed = parseDelimited('X,Y\n1,2\n3,"4\n5,6')
  assert.equal(parsed.rows.length, 2)
  assert.equal(checkParsed(parsed, 'a.csv'), 'a.csv has a quoted field without a closing quote.')
})

test('a comma file with uneven rows imports without a separator note', () => {
  for (const text of ['X,Y\n1', 'a,b,c\n1\n2,3\n4']) {
    const parsed = parseDelimited(text)
    assert.equal(checkParsed(parsed, 'a.csv'), '')
    assert.equal(parsed.issues.some(([type]) => type === 'UndetectableDelimiter'), false)
    assert.equal(parsed.issues[0][0], 'TooFewFields')
  }
})

test('the parser finds cell issues in the ADR-0007 [type, data] shape, after its row issues', () => {
  const parsed = parseDelimited('Month,Owned,Funds\n1,2,3\nbad,also bad,\n3,n/a,\n,4,5\n6')
  assert.deepEqual(parsed.issues, [
    ['TooFewFields', [4]],
    ['invalid-x', [1, 3]],
    ['invalid-number', [[1, 2, 'n/a']]],
    ['empty-cell', [[2, 2], [1, 4], [2, 4]]],
  ])
  assert.deepEqual(parsed.issues.map(isWarning), [true, true, true, false])
})

test('import messages are the parser issues, plus series that need a color', () => {
  const parsed = parseDelimited('X,A,B\n1,#N/A,0\n2, #N/A ,3\n#N/A,4,5\n4,n/a,bad\n5,,6')
  const originalRows = structuredClone(parsed.rows)
  assert.deepEqual(parsed.issues, [
    ['invalid-x', [2]],
    ['invalid-number', [[1, 3, 'n/a'], [2, 3, 'bad']]],
    ['empty-cell', [[1, 4]]],
  ])
  assert.deepEqual(findIssues({ parseIssues: parsed.issues }), parsed.issues)
  assert.deepEqual(findIssues({ parseIssues: parsed.issues, series: [{ color: '#000' }, {}] }), [...parsed.issues, ['needs-color', 1]])
  assert.deepEqual(parsed.rows, originalRows)
})

test('the parser checks every series column, with no limit on how many', () => {
  assert.deepEqual(parseDelimited('X,A,B,C,D\n1,2,3,4,text').issues, [['invalid-number', [[4, 0, 'text']]]])
  const twelve = Array.from({ length: 13 }, (_, c) => ({ key: `c${c}`, name: `S${c}` }))
  assert.equal(summarizeData({ sourceName: 'a.csv', columns: twelve, rows: [] }).seriesCount, 12)
})

test('the sample data has nothing to report', () => {
  assert.deepEqual(findIssues(initialState), [])
})

test('describes issues with row numbers from 1, column names and offending values', () => {
  const data = { columns }
  const invalid = [[1, 0, 'abc'], [1, 1, 'n/a'], [1, 2, 'x'], [1, 3, 'a very long value that keeps going']]

  assert.equal(
    describeIssue(['invalid-number', invalid], data),
    '4 nonnumeric values: "abc" in row 1 (Owned), "n/a" in row 2 (Owned), "x" in row 3 (Owned) and 1 more. Replace with numbers.',
  )
  assert.equal(
    describeIssue(['invalid-number', [invalid[3]]], data),
    '1 nonnumeric value: "a very long value t…" in row 4 (Owned). Replace with numbers.',
  )
  assert.equal(describeIssue(['empty-cell', [[2, 0]]], data), '1 empty cell: row 1 (Funds).')
  assert.equal(
    describeIssue(['invalid-x', [4]], data),
    'Row 5: Month must be a number.',
  )
  assert.equal(
    describeIssue(['TooManyFields', [0, 1, 2, 3, 4]], data),
    '5 rows (1, 2, 3 and 2 more) have more values than there are columns',
  )
  assert.equal(describeIssue(['UndetectableDelimiter', 1], data), 'Column separator not detected. Use commas or tabs.')
})

test('quote feedback counts distinct source rows without changing parser diagnostics', () => {
  const parsed = parseDelimited('X,Y\n\n1,"a"b\n2,"c"d')
  const issue = parsed.issues.find(([type]) => type === 'InvalidQuotes')
  assert.equal(describeIssue(issue, parsed), 'Invalid quotes: Row 1. Escape quotes inside fields as "".')
  assert.deepEqual(issue, ['InvalidQuotes', [0, 0, 0]])
  assert.equal(describeIssue(['MissingQuotes', [1, 1, 3, 3]], parsed), 'Missing closing quote: 2 rows (2, 4).')
})

test('summarizes the source, counts and X range, ignoring invalid X values', () => {
  const rows = [[5, 1, 1], ['bad', 1, 1], [-2, 1, 1], [12, 1, 1]]
  assert.deepEqual(summarizeData({ sourceName: 'a.csv', columns, rows }), {
    sourceName: 'a.csv', rowCount: 4, seriesCount: 2, xName: 'Month', xRange: [-2, 12],
  })
  assert.equal(summarizeData({ sourceName: 'a.csv', columns, rows: [['bad', 1, 1]] }).xRange, null)
})
