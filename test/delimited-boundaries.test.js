import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDelimited } from '../src/state.js'

// Everything in this test suite is quoted so we have more quote test cases
const quote = value => `"${String(value).replaceAll('"', '""')}"`
const record = (fields, delimiter) => fields.map(quote).join(delimiter)

for (const delimiter of [',', ';', '\t']) {
  for (const newline of ['\n', '\r\n', '\r']) {
    for (const header of [false, true]) {
      for (const bom of ['', '\ufeff']) {
        test(`spreadsheet dialect ${JSON.stringify({ delimiter, newline, header, bom: Boolean(bom) })}`, () => {
          const names = ['X', `A${delimiter}"quoted"${newline}label`, 'B']
          const body = [['2', '0', ''], ['1', ' \t ', '#N/A'], ['3', '-1.25', '5e1']]
          const records = header ? [names, ...body] : body
          const parsed = parseDelimited(bom + records.map(row => record(row, delimiter)).join(newline) + newline)

          assert.equal(parsed.delimiter, delimiter)
          assert.deepEqual(parsed.columns, (header ? names : ['Column 1', 'Column 2', 'Column 3'])
            .map((name, i) => ({ key: `c${i}`, name })))
          assert.deepEqual(parsed.rows, [[2, 0, Infinity], [1, Infinity, -Infinity], [3, -1.25, 50]])
          assert.deepEqual(parsed.issues, [['empty-cell', [[2, 0], [1, 1]]]])
        })
      }
    }
  }
}

test('quoted delimiter characters do not select the file delimiter', () => {
  const parsed = parseDelimited('X,"comma, tab\t and semicolon;",B\n1,"value,\t;",3\n2,4,5')
  assert.equal(parsed.delimiter, ',')
  assert.deepEqual(parsed.columns.map(column => column.name), ['X', 'comma, tab\t and semicolon;', 'B'])
  assert.deepEqual(parsed.rows, [[1, Infinity, 3], [2, 4, 5]])
  assert.deepEqual(parsed.issues, [['invalid-number', [[1, 0, 'value,\t;']]]])
})

test('leading and trailing empty fields retain their column positions in every dialect', () => {
  for (const delimiter of [',', ';', '\t']) {
    const parsed = parseDelimited(['X', 'A', 'B'].join(delimiter) + '\n' +
      ['', '2', ''].join(delimiter) + '\n' + ['3', '', '4'].join(delimiter))
    assert.deepEqual(parsed.rows, [[3, Infinity, 4]])
    assert.deepEqual(parsed.issues, [['invalid-x', [0]], ['empty-cell', [[1, 1]]]])
  }
})

test('the first nonnumeric header cell is enough, while numeric first rows remain data', () => {
  assert.deepEqual(parseDelimited('1,Name,3\n4,5,6').columns.map(c => c.name), ['1', 'Name', '3'])
  const parsed = parseDelimited('0x1,2e1,-3\n2,0,4')
  assert.deepEqual(parsed.columns.map(c => c.name), ['Column 1', 'Column 2', 'Column 3'])
  assert.deepEqual(parsed.rows, [[1, 20, -3], [2, 0, 4]])
})

test('empty and duplicate headers keep distinct keys, and parsing retains columns beyond the plotting limit', () => {
  const parsed = parseDelimited('X,A,,A,E,F\n1,2,3,4,5,6')
  assert.deepEqual(parsed.columns, ['X', 'A', '', 'A', 'E', 'F'].map((name, i) => ({ key: `c${i}`, name })))
  assert.deepEqual(parsed.rows, [[1, 2, 3, 4, 5, 6]])
  assert.deepEqual(parsed.issues, [['duplicate-header', [1, 3]]])
})

test('empty files and greedy blank records return null, while header-only files retain their columns', () => {
  for (const text of ['', '\ufeff', '\r\n \t \r\n', ',,\n"","",""\n']) {
    assert.equal(parseDelimited(text), null, JSON.stringify(text))
  }
  const parsed = parseDelimited('\ufeffX,A\r\n')
  assert.deepEqual(parsed.columns.map(c => c.name), ['X', 'A'])
  assert.deepEqual(parsed.rows, [])
  assert.deepEqual(parsed.issues, [])
})

test('field-count diagnostics exclude headers and blank records in every dialect', () => {
  for (const delimiter of [',', ';', '\t']) {
    const parsed = parseDelimited([
      '', ['X', 'A', 'B'].join(delimiter), '',
      ['1', '2'].join(delimiter), ['2', '3', '4', '5'].join(delimiter),
      ['3', '4', '5', '   '].join(delimiter),
    ].join('\n'))
    assert.deepEqual(parsed.rows, [[1, 2, Infinity], [2, 3, 4], [3, 4, 5]])
    assert.deepEqual(parsed.issues, [['TooFewFields', [0]], ['TooManyFields', [1]], ['empty-cell', [[2, 0]]]])
  }
})

test('malformed-record diagnostics use source data-row indexes across delimiters and line endings', () => {
  for (const delimiter of [',', ';', '\t']) {
    for (const newline of ['\n', '\r\n', '\r']) {
      const text = '\ufeff' + [
        '', ['X', 'A', 'B'].join(delimiter), '',
        record(['1', `first${newline}second`, '3'], delimiter), '',
        `2${delimiter}"broken`,
      ].join(newline)
      const parsed = parseDelimited(text)
      assert.deepEqual(parsed.rows, [[1, Infinity, 3], [2, Infinity, Infinity]])
      assert.deepEqual(parsed.issues, [
        ['TooFewFields', [1]], ['MissingQuotes', [1]],
        ['invalid-number', [[1, 0, `first${newline}second`], [1, 1, 'broken']]],
        ['empty-cell', [[2, 1]]],
      ])
    }
  }
})

test('an unterminated empty quoted field reports its parse error instead of appearing to be an empty file', () => {
  for (const text of ['"', '"   ', '\n"\t']) {
    const parsed = parseDelimited(text)
    assert.notEqual(parsed, null)
    assert.deepEqual(parsed.rows, [])
    assert.ok(parsed.issues.some(([type, data]) => type === 'MissingQuotes' && data === 1))
  }
})

test('dynamic typing stays off for booleans, dates and formula text', () => {
  const values = ['true', 'false', 'null', '2026-10-19T00:00:00Z', '=SUM(A1:A2)', '<b>Cost</b>']
  const parsed = parseDelimited('X,A\n' + values.map((value, i) => record([i + 1, value], ',')).join('\n'))
  assert.deepEqual(parsed.rows, values.map((_, i) => [i + 1, Infinity]))
  assert.deepEqual(parsed.issues, [['invalid-number', values.map((value, i) => [1, i, value])]])
})
