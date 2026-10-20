// Plain-JS helpers shared by every chart type. No charting library: we draw
// SVG ourselves, so all the math (data shaping, scales, ticks) lives here.

import { Float32OverflowError, finiteCalculation, throwOverflowErrors } from '../../numericErrors.js'

export { Float32OverflowError } from '../../numericErrors.js'
import { precisionWarning } from '../../precision.js'

export const CHART_HEIGHT = 420

/** Space around the plot area for tick labels and axis titles (px). */
export const MARGIN = { top: 12, right: 16, bottom: 44, left: 52 }

// SVG attributes can't read CSS var(), and the exported SVG must stand on its
// own, so chart colors are literals. Keep in sync with src/index.css.
export const CHART_THEME = {
  grid: '#eff2ec', // --border-soft
  tick: '#a8afaa', // --text-faint
  label: '#8a968c', // --text-muted
  surface: '#ffffff', // --bg-surface
  fontSize: 11,
}

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
  const errors = []
  const warnings = []
  for (let i = 0; i < length; i++) {
    const row = state.rows[indexes[i]]
    x[i] = row[0]
    if (precision === 'float32' && !Number.isFinite(x[i])) {
      errors.push(new Float32OverflowError(row[0], state.columns[0]?.name ?? 'X'))
    } else if (!Object.is(row[0], x[i])) {
      warnings.push(precisionWarning(row[0], x[i], state.columns[0]?.name ?? 'X', 32))
    }
    for (let s = 0; s < state.series.length; s++) {
      const columnIndex = state.series[s].columnIndex
      const value = row[columnIndex]
      ys[s][i] = value
      if (precision === 'float32' && Number.isFinite(value) && !Number.isFinite(ys[s][i])) {
        errors.push(new Float32OverflowError(value, state.columns[columnIndex]?.name ?? `Column ${columnIndex + 1}`))
      } else if (Number.isFinite(value) && !Object.is(value, ys[s][i])) {
        warnings.push(precisionWarning(value, ys[s][i], state.columns[columnIndex]?.name ?? `Column ${columnIndex + 1}`, 32))
      }
    }
  }
  throwOverflowErrors(errors)
  return { columns: { length, x, ys }, series: state.series, warnings }
}

/** Snap a rough interval to 1 / 2 / 5 x 10^n. */
function niceStep(rough) {
  if (!Number.isFinite(rough) || rough <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(rough))
  const frac = rough / pow
  const base = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10
  return base * pow
}

function range(from, to, step, columnName) {
  const describeRange = () => `${from} to ${to}`
  const count = finiteCalculation((to - from) / step, columnName, describeRange, 'axis range')
  const out = []
  for (let i = 0; i <= count + 1e-6; i++) out.push(Number(finiteCalculation(from + i * step, columnName, describeRange, 'axis ticks').toFixed(10)))
  return out
}

/**
 * Domains + tick values for both axes.
 * X: data range widened to a nice step (1..12 -> 0,2,...,12).
 * Y: 0..niceMax (35 -> 40, ticks every 10); extends below 0 for negative data.
 * Returns null when there is nothing to plot.
 */
export function computeScales(columns, { xColumnName = 'X', yColumnName = 'Y' } = {}) {
  if (columns.length === 0 || columns.ys.length === 0) return null
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (let i = 0; i < columns.length; i++) {
    xMin = Math.min(xMin, columns.x[i])
    xMax = Math.max(xMax, columns.x[i])
    for (const y of columns.ys) {
      const v = y[i]
      if (!Number.isFinite(v)) continue
      yMin = Math.min(yMin, v)
      yMax = Math.max(yMax, v)
    }
  }
  if (!Number.isFinite(yMin)) yMin = yMax = 0

  let x
  if (xMin === xMax) {
    x = { domain: [xMin - 1, xMax + 1], ticks: [xMin] }
  } else {
    const step = niceStep(finiteCalculation(xMax - xMin, xColumnName, () => `${xMin} to ${xMax}`, 'axis range') / 6)
    const lo = finiteCalculation(Math.floor(xMin / step + 1e-9) * step, xColumnName, xMin, 'axis bound')
    const hi = finiteCalculation(Math.ceil(xMax / step - 1e-9) * step, xColumnName, xMax, 'axis bound')
    x = { domain: [lo, hi], ticks: range(lo, hi, step, xColumnName) }
  }

  const ySpan = finiteCalculation(Math.max(yMax, 0) - Math.min(yMin, 0), yColumnName, () => `${yMin} to ${yMax}`, 'axis range')
  const yStep = niceStep((ySpan || 1) / 4)
  const yTop = finiteCalculation(Math.max(Math.ceil(Math.max(yMax, 0) / yStep - 1e-9) * yStep, yStep), yColumnName, yMax, 'axis bound')
  const yBottom = yMin < 0 ? finiteCalculation(-Math.ceil(-yMin / yStep - 1e-9) * yStep, yColumnName, yMin, 'axis bound') : 0
  const y = { domain: [yBottom, yTop], ticks: range(yBottom, yTop, yStep, yColumnName) }

  return { x, y }
}

/** Linear map from a [d0, d1] domain to a [r0, r1] pixel range. */
export function linear([d0, d1], [r0, r1], columnName = 'axis') {
  const span = finiteCalculation(d1 - d0, columnName, () => `${d0} to ${d1}`, 'axis range') || 1
  return (v) => finiteCalculation(r0 + ((v - d0) / span) * (r1 - r0), columnName, v, 'chart position')
}
