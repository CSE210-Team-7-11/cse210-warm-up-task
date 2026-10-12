// Plain-JS helpers shared by every chart type. No charting library: we draw
// SVG ourselves, so all the math (data shaping, scales, ticks) lives here.

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

/** Parse a table cell into a finite number, or NaN. Empty cells are not zero. */
export function num(v) {
  if (v === '' || v === null || v === undefined) return NaN
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Turn the editor state into chart-ready data. Column 0 is always X.
 * Returns:
 *   data    [{ x, s1: number|null, s2: number|null, ... }] sorted by x
 *   series  the series to draw (from state.series)
 */
export function buildChartData(state) {
  const data = []
  for (const row of state.rows) {
    const x = num(row[0])
    if (!Number.isFinite(x)) continue
    const point = { x }
    for (const s of state.series) {
      const v = num(row[s.columnIndex])
      point[s.id] = Number.isFinite(v) ? v : null
    }
    data.push(point)
  }
  data.sort((a, b) => a.x - b.x)
  return { data, series: state.series }
}

/** Snap a rough interval to 1 / 2 / 5 x 10^n. */
function niceStep(rough) {
  if (!Number.isFinite(rough) || rough <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(rough))
  const frac = rough / pow
  const base = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10
  return base * pow
}

function range(from, to, step) {
  const out = []
  const eps = step * 1e-6
  for (let i = 0; from + i * step <= to + eps; i++) out.push(Number((from + i * step).toFixed(10)))
  return out
}

/**
 * Domains + tick values for both axes.
 * X: data range widened to a nice step (1..12 -> 0,2,...,12).
 * Y: 0..niceMax (35 -> 40, ticks every 10); extends below 0 for negative data.
 * Returns null when there is nothing to plot.
 */
export function computeScales(data, series) {
  if (data.length === 0 || series.length === 0) return null
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (const p of data) {
    xMin = Math.min(xMin, p.x)
    xMax = Math.max(xMax, p.x)
    for (const s of series) {
      const v = p[s.id]
      if (v === null) continue
      yMin = Math.min(yMin, v)
      yMax = Math.max(yMax, v)
    }
  }
  if (!Number.isFinite(yMin)) yMin = yMax = 0

  let x
  if (xMin === xMax) {
    x = { domain: [xMin - 1, xMax + 1], ticks: [xMin] }
  } else {
    const step = niceStep((xMax - xMin) / 6)
    const lo = Math.floor(xMin / step + 1e-9) * step
    const hi = Math.ceil(xMax / step - 1e-9) * step
    x = { domain: [lo, hi], ticks: range(lo, hi, step) }
  }

  const yStep = niceStep((Math.max(yMax, 0) || 1) / 4)
  const yTop = Math.max(Math.ceil(Math.max(yMax, 0) / yStep - 1e-9) * yStep, yStep)
  const yBottom = yMin < 0 ? -Math.ceil(-yMin / yStep - 1e-9) * yStep : 0
  const y = { domain: [yBottom, yTop], ticks: range(yBottom, yTop, yStep) }

  return { x, y }
}

/** Linear map from a [d0, d1] domain to a [r0, r1] pixel range. */
export function linear([d0, d1], [r0, r1]) {
  const span = d1 - d0 || 1
  return (v) => r0 + ((v - d0) / span) * (r1 - r0)
}
