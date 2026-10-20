import { normalizeNumberText } from './numberFormat.js'

// Compare numeric decimal values, ignoring grouping, notation and trailing zeros.
function decimalValue(text) {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text)
  if (!match) return null
  const [, sign, integer, fraction = '', exponent = '0'] = match
  const digits = (integer + fraction).replace(/^0+/, '')
  const coefficient = digits.replace(/0+$/, '')
  if (!coefficient) return '0'
  const power = Number(exponent) - fraction.length + digits.length - coefficient.length
  return `${sign === '-' ? '-' : ''}${coefficient}e${power}`
}

// Warn when parsing changes the numeric value shown by the stored Float64.
export function losesFloat64Precision(value, stored, decimalSeparator) {
  const text = String(value).trim()
  if (!Number.isFinite(stored) || text === String(stored)) return false
  const normalized = normalizeNumberText(text, decimalSeparator)
  if (normalized === null) return false
  if (/^0[xob]/i.test(normalized)) return BigInt(normalized) !== BigInt(stored)
  return decimalValue(normalized) !== decimalValue(String(stored))
}

const displayValue = (value) => Object.is(value, -0) ? '-0' : String(value)

export function precisionWarning(value, storedValue, columnName, precision, sourceRow) {
  const location = sourceRow === undefined ? '' : ` (source data row ${sourceRow + 1})`
  return {
    value, storedValue, columnName, precision, sourceRow,
    message: `The value ${displayValue(value)} in "${columnName}"${location} was rounded to ${displayValue(storedValue)} for ${precision}-bit precision.`,
  }
}
