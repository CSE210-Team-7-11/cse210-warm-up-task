import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCell, parseDelimited } from '../src/state.js'

const OPTIONS = [['gap', Infinity], ['zero', 0], ['connect', -Infinity]]

test('emptyCells sets what an empty cell becomes', () => {
  for (const [emptyCells, expected] of OPTIONS) {
    for (const value of ['', '  ', '\t', null, undefined]) {
      assert.equal(parseCell(value, '.', { emptyCells }), expected, `${emptyCells}: ${JSON.stringify(value)}`)
    }
  }
})

test('#N/A becomes -Infinity under every emptyCells option', () => {
  for (const [emptyCells] of OPTIONS) {
    assert.equal(parseCell('#N/A', '.', { emptyCells }), -Infinity, emptyCells)
    assert.equal(parseCell(' #N/A ', ',', { emptyCells }), -Infinity, emptyCells)
  }
})

test('emptyCells leaves numbers and invalid text unchanged', () => {
  for (const [emptyCells] of OPTIONS) {
    assert.equal(parseCell('1,5', ',', { emptyCells }), 1.5)
    assert.equal(parseCell('0', '.', { emptyCells }), 0)
    assert.equal(parseCell('abc', '.', { emptyCells }), null)
  }
})

test('leaving emptyCells out matches gap', () => {
  for (const value of ['', ' ', '#N/A', '12', 'abc']) {
    assert.equal(parseCell(value), parseCell(value, '.', { emptyCells: 'gap' }), JSON.stringify(value))
  }
  const text = 'X,A,B\n1,,#N/A\n2,5,\n,3,4'
  assert.deepEqual(parseDelimited(text), parseDelimited(text, { emptyCells: 'gap' }))
})

test('parseDelimited passes emptyCells to Y cells', () => {
  const text = 'X,A,B\n1,,#N/A\n2,5,\n3,7,8'
  for (const [emptyCells, expected] of OPTIONS) {
    const parsed = parseDelimited(text, { emptyCells })
    assert.deepEqual(parsed.rows, [[1, expected, -Infinity], [2, 5, expected], [3, 7, 8]], emptyCells)
  }
})

test('empty cells are reported unless they are set to zero', () => {
  const text = 'X,A,B\n1,,#N/A\n2,5,'
  for (const emptyCells of ['gap', 'connect']) {
    assert.deepEqual(parseDelimited(text, { emptyCells }).issues, [['empty-cell', [[1, 0], [2, 1]]]], emptyCells)
  }
  assert.deepEqual(parseDelimited(text, { emptyCells: 'zero' }).issues, [])
})

test('a real zero stays zero beside empty cells', () => {
  for (const [emptyCells, expected] of OPTIONS) {
    const parsed = parseDelimited('X,A\n1,0\n2,\n3,-0', { emptyCells })
    assert.deepEqual(parsed.rows, [[1, 0], [2, expected], [3, -0]], emptyCells)
  }
})

test('missing fields in a short row follow emptyCells without precision warnings', () => {
  for (const [emptyCells, expected] of OPTIONS) {
    const parsed = parseDelimited('X,A,B\n1,2\n2,3,4', { emptyCells })
    assert.deepEqual(parsed.rows, [[1, 2, expected], [2, 3, 4]], emptyCells)
    assert.ok(!parsed.issues.some(([type]) => type === 'precision-loss'), emptyCells)
  }
})

test('emptyCells works with comma decimals', () => {
  for (const [emptyCells, expected] of OPTIONS) {
    const parsed = parseDelimited('X;A\n1;2,5\n2;\n3;1.234,5', { emptyCells })
    assert.equal(parsed.numberFormat, ',', emptyCells)
    assert.deepEqual(parsed.rows, [[1, 2.5], [2, expected], [3, 1234.5]], emptyCells)
  }
})

test('an empty X cell stays invalid under every emptyCells option', () => {
  for (const [emptyCells] of OPTIONS) {
    const parsed = parseDelimited('X,A\n,10\n1,20', { emptyCells })
    assert.deepEqual(parsed.rows, [[1, 20]], emptyCells)
    assert.deepEqual(parsed.issues, [['invalid-x', [0]]], emptyCells)
  }
})

test('unknown emptyCells values throw', () => {
  for (const emptyCells of ['Gap', 'skip', '', null, 0, 'toString']) {
    assert.throws(() => parseCell('', '.', { emptyCells }), TypeError, String(emptyCells))
    assert.throws(() => parseDelimited('X,A\n1,2', { emptyCells }), TypeError, String(emptyCells))
  }
})
