import { MAX_DIAGNOSTICS, addDiagnostic, createDiagnostics } from './diagnostics.js'

export class Float32OverflowError extends RangeError {
  constructor(value, columnName) {
    const recommendation = Number.isFinite(value) ? ' Switch to 64-bit mode.' : ''
    super(`The value ${value} in "${columnName}" is too large for 32-bit precision.${recommendation}`)
    this.name = 'Float32OverflowError'
  }
}

export class Float64OverflowError extends RangeError {
  constructor(value, columnName, { calculation, sourceRow } = {}) {
    const subject = calculation ? `The ${calculation} for ${value}` : `The value ${value}`
    const location = sourceRow === undefined ? '' : ` (source data row ${sourceRow + 1})`
    super(`${subject} in "${columnName}"${location} is too large for 64-bit precision.`)
    this.name = 'Float64OverflowError'
  }
}

export class NumericOverflowErrors extends AggregateError {
  constructor(errors, count = errors.length) {
    const listed = errors.slice(0, MAX_DIAGNOSTICS)
    const marker = count > listed.length ? '\nList truncated.' : ''
    super(listed, `${count} numeric overflow errors:\n${listed.map((error) => error.message).join('\n')}${marker}`)
    this.name = 'NumericOverflowErrors'
    this.count = count
  }
}

export const isNumericOverflowError = (error) => error instanceof Float32OverflowError ||
  error instanceof Float64OverflowError || error instanceof NumericOverflowErrors

export function throwOverflowErrors({ items, count }) {
  if (count === 1) throw items[0]
  if (count > 1) throw new NumericOverflowErrors(items, count)
}

// Check independent calculations even after one has failed.
export function collectOverflowErrors(calculations) {
  const errors = createDiagnostics()
  const results = calculations.map((calculate) => {
    try {
      return calculate()
    } catch (error) {
      if (!isNumericOverflowError(error)) throw error
      const listed = error instanceof NumericOverflowErrors ? error.errors : [error]
      for (const oneError of listed) addDiagnostic(errors, () => oneError)
      if (error instanceof NumericOverflowErrors) errors.count += error.count - listed.length
    }
  })
  throwOverflowErrors(errors)
  return results
}

export function finiteCalculation(result, columnName, input, calculation) {
  if (!Number.isFinite(result)) {
    throw new Float64OverflowError(typeof input === 'function' ? input() : input, columnName, { calculation })
  }
  return result
}
