import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCell } from '../src/state.js'

test('empty and whitespace-only cells stay missing instead of becoming zero', () => {
  for (const value of ['', ' ', '   ', '\t', '\r\n', ' \t \r\n ', '\u00a0', '\ufeff', null, undefined]) {
    assert.equal(parseCell(value), Infinity, `empty cell: ${JSON.stringify(value)}`)
  }
})

test('finite Number-compatible input includes signs, exponents, bases and surrounding whitespace', () => {
  const cases = [
    ['0', 0], ['-0', -0], ['+0', 0], ['0.0', 0], [' 0 ', 0],
    ['42', 42], ['-42', -42], ['+42', 42], ['.5', 0.5], ['1.', 1],
    ['-1.25', -1.25], ['6.02e3', 6020], ['1E-3', 0.001],
    ['0x10', 16], ['0Xff', 255], ['0b101', 5], ['0o17', 15],
    [' \t12.5\r\n', 12.5], ['\u00a012.5\u00a0', 12.5],
    ['0.1000000001', 0.1000000001], ['5e-324', Number.MIN_VALUE],
  ]
  for (const [text, expected] of cases) {
    assert.equal(parseCell(text), expected, text)
  }
})

test('non-finite and invalid numeric text returns null, never a parsed prefix', () => {
  for (const value of ['Infinity', '+Infinity', '-Infinity', 'NaN', '1e309', '-1e309',
    '0x', '-0x10', '12kg', '12abc', '1.2.3', 'true', 'false', 'null', '2026-10-19', ' bad ']) {
    assert.equal(parseCell(value), null, value)
  }
})

test('#N/A becomes a skip marker, while other text is invalid', () => {
  for (const value of ['#N/A', ' #N/A ']) assert.equal(parseCell(value), -Infinity)
  for (const value of ['n/a', '#n/a', ' padded ', 'first\nsecond', 'say "hi"']) {
    assert.equal(parseCell(value), null)
  }
})
