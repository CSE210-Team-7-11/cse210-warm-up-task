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
  constructor(errors) {
    super(errors, `${errors.length} numeric overflow errors:\n${errors.map((error) => error.message).join('\n')}`)
    this.name = 'NumericOverflowErrors'
  }
}

export const isNumericOverflowError = (error) => error instanceof Float32OverflowError ||
  error instanceof Float64OverflowError || error instanceof NumericOverflowErrors

export function throwOverflowErrors(errors) {
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new NumericOverflowErrors(errors)
}

// Check independent calculations even after one has failed.
export function collectOverflowErrors(calculations) {
  const errors = []
  const results = calculations.map((calculate) => {
    try {
      return calculate()
    } catch (error) {
      if (!isNumericOverflowError(error)) throw error
      for (const oneError of error instanceof NumericOverflowErrors ? error.errors : [error]) errors.push(oneError)
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
