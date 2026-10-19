import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDelimited } from '../src/state.js'

test('keeps quoted commas in one field without shifting later values', () => {
  const parsed = parseDelimited('X,A,B\n2,"1,010",905')

  assert.deepEqual(parsed.rows, [[2, '1,010', 905]])
  assert.deepEqual(parsed.issues, [])
  assert.equal(parsed.delimiter, ',')
})

test('preserves quoted newlines, escaped quotes and spaces inside fields', () => {
  const parsed = parseDelimited('X,A,B\n1,"first\nsecond","say ""hi"""\n2," padded ",3')

  assert.deepEqual(parsed.rows, [[1, 'first\nsecond', 'say "hi"'], [2, ' padded ', 3]])
  assert.deepEqual(parsed.issues, [])
})

test('detects semicolon and tab delimiters', () => {
  for (const delimiter of [';', '\t']) {
    const parsed = parseDelimited(`X${delimiter}A\n1${delimiter}2\n3${delimiter}4`)

    assert.equal(parsed.delimiter, delimiter)
    assert.deepEqual(parsed.columns, [{ key: 'c0', name: 'X' }, { key: 'c1', name: 'A' }])
    assert.deepEqual(parsed.rows, [[1, 2], [3, 4]])
    assert.deepEqual(parsed.issues, [])
  }
})

test('retains numeric first rows and the existing numeric conversion', () => {
  const parsed = parseDelimited('1,0x10,2e2\n2,,#N/A')

  assert.deepEqual(parsed.columns.map(({ name }) => name), ['Column 1', 'Column 2', 'Column 3'])
  assert.deepEqual(parsed.rows, [[1, 16, 200], [2, '', '#N/A']])
  assert.deepEqual(parsed.issues, [])
})

test('keeps duplicate header names without renaming or dropping columns', () => {
  const parsed = parseDelimited('X,A,A\n1,2,3')

  assert.deepEqual(parsed.columns, [
    { key: 'c0', name: 'X' }, { key: 'c1', name: 'A' }, { key: 'c2', name: 'A' },
  ])
  assert.deepEqual(parsed.rows, [[1, 2, 3]])
})

test('reports short and long rows before padding or trimming them', () => {
  const parsed = parseDelimited('X,A,B\n1,2\n2,3,4,5\n3,4,5,\n4,5,6')

  assert.deepEqual(parsed.issues, [['TooFewFields', [0]], ['TooManyFields', [1]]])
  assert.deepEqual(parsed.rows, [[1, 2, ''], [2, 3, 4], [3, 4, 5], [4, 5, 6]])
})

test('skips blank records without dropping zero values or creating trailing rows', () => {
  const parsed = parseDelimited('X,A\r\n0,0\r\n\r\n1,2\r\n \t \r\n,,\r\n')

  assert.deepEqual(parsed.rows, [[0, 0], [1, 2]])
  assert.deepEqual(parsed.issues, [])
  assert.equal(parseDelimited(' \n\t\r\n,,\n'), null)
})

test('reports malformed quotes alongside row-width issues', () => {
  const parsed = parseDelimited('X,A,B\n1,2\n2,"broken')

  assert.deepEqual(parsed.issues, [['TooFewFields', [0, 1]], ['MissingQuotes', [1]]])
})

test('groups repeated Papa errors by code using data-row positions', () => {
  const parsed = parseDelimited('X,Y\n\n1,"a"b\n2,"c"d')

  assert.deepEqual(parsed.issues, [
    ['InvalidQuotes', [0, 0, 0]],
    ['MissingQuotes', [0]],
  ])
})

test('maps errors past leading blanks, a header, and a multiline record to returned rows', () => {
  const parsed = parseDelimited('\n \nX,Y,Z\n1,"first\nsecond",3\n\n2,"broken')

  assert.deepEqual(parsed.rows, [[1, 'first\nsecond', 3], [2, 'broken', '']])
  assert.deepEqual(parsed.issues, [['TooFewFields', [1]], ['MissingQuotes', [1]]])
})

test('uses the same row indexes without a header', () => {
  const parsed = parseDelimited('\n1,2,3\n\n2,"broken')

  assert.deepEqual(parsed.rows, [[1, 2, 3], [2, 'broken', '']])
  assert.deepEqual(parsed.issues, [['TooFewFields', [1]], ['MissingQuotes', [1]]])
})

test('reports a malformed header as a count rather than a data-row position', () => {
  const parsed = parseDelimited('X,"broken')

  assert.deepEqual(parsed.rows, [])
  assert.deepEqual(parsed.issues, [['MissingQuotes', 1]])
})

test('records delimiter errors without inventing a row position', () => {
  const parsed = parseDelimited('X\n1\n2')

  assert.deepEqual(parsed.issues, [['UndetectableDelimiter', 1]])
  assert.equal(parsed.delimiter, ',')
})
