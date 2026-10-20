import assert from 'node:assert/strict'
import test from 'node:test'
import { addDiagnostic, createDiagnostics } from '../src/diagnostics.js'
import { collectOverflowErrors, Float64OverflowError, NumericOverflowErrors } from '../src/numericErrors.js'

test('one million diagnostics create only the first ten entries', () => {
  const diagnostics = createDiagnostics()
  let generated = 0
  for (let i = 0; i < 1000000; i++) {
    addDiagnostic(diagnostics, () => {
      generated++
      return new Float64OverflowError(`${i + 1}e309`, 'A')
    })
  }
  assert.equal(generated, 10)
  assert.equal(diagnostics.count, 1000000)
  assert.equal(diagnostics.items.length, 10)
  assert.ok(diagnostics.items[0].message.includes('1e309'))
  assert.ok(diagnostics.items[9].message.includes('10e309'))
})

test('nested overflow collections retain the total count without expanding the error list', () => {
  const errors = Array.from({ length: 10 }, (_, i) => new Float64OverflowError(`${i + 1}e309`, 'A'))
  assert.throws(() => collectOverflowErrors([
    () => { throw new NumericOverflowErrors(errors, 1000000) },
    () => { throw new Float64OverflowError('2e309', 'B') },
  ]), (error) => {
    assert.equal(error.count, 1000001)
    assert.equal(error.errors.length, 10)
    assert.deepEqual(error.errors, errors)
    assert.match(error.message, /1000001 numeric overflow errors/)
    assert.match(error.message, /List truncated/)
    assert.ok(error.message.length < 1500)
    return true
  })
})
