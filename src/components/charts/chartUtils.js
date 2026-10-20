import { Float32OverflowError, throwOverflowErrors } from '../../numericErrors.js'

import { precisionWarning } from '../../precision.js'
import { addDiagnostic, createDiagnostics } from '../../diagnostics.js'

// Build sorted numeric columns. Series metadata follows the same order as ys.
// Collects overflow errors before returning and reports non-blocking precision warnings.
export function buildChartData(state, { precision = 'float64' } = {}) {
  if (precision !== 'float64' && precision !== 'float32') {
    throw new TypeError('precision must be "float64" or "float32".')
  }
  const Column = precision === 'float32' ? Float32Array : Float64Array
  const indexes = []
  for (let i = 0; i < state.rows.length; i++) {
    if (Number.isFinite(state.rows[i][0])) indexes.push(i)
  }
  indexes.sort((a, b) => state.rows[a][0] - state.rows[b][0])

  const length = indexes.length
  const x = new Column(length)
  const ys = state.series.map(() => new Column(length))
  const errors = createDiagnostics()
  const warnings = createDiagnostics()
  for (let i = 0; i < length; i++) {
    const row = state.rows[indexes[i]]
    x[i] = row[0]
    if (precision === 'float32' && !Number.isFinite(x[i])) {
      addDiagnostic(errors, () => new Float32OverflowError(row[0], state.columns[0]?.name ?? 'X'))
    } else if (!Object.is(row[0], x[i])) {
      addDiagnostic(warnings, () => precisionWarning(row[0], x[i], state.columns[0]?.name ?? 'X', 32))
    }
    for (let s = 0; s < state.series.length; s++) {
      const columnIndex = state.series[s].columnIndex
      const value = row[columnIndex]
      ys[s][i] = value
      if (precision === 'float32' && Number.isFinite(value) && !Number.isFinite(ys[s][i])) {
        addDiagnostic(errors, () => new Float32OverflowError(value, state.columns[columnIndex]?.name ?? `Column ${columnIndex + 1}`))
      } else if (Number.isFinite(value) && !Object.is(value, ys[s][i])) {
        addDiagnostic(warnings, () => precisionWarning(value, ys[s][i], state.columns[columnIndex]?.name ?? `Column ${columnIndex + 1}`, 32))
      }
    }
  }
  throwOverflowErrors(errors)
  return { columns: { length, x, ys }, series: state.series, warnings: warnings.items, warningCount: warnings.count }
}
