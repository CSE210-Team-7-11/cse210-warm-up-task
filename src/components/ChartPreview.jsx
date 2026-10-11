import { useId, useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChartIcon } from './ui/Icons.jsx'
import './ChartPreview.css'

const CHART_HEIGHT = 300

// Design tokens the SVG needs as literal colors. SVG presentation attributes
// cannot resolve var(), and the serialized export must stand on its own, so
// the values are read from :root at runtime (fallbacks mirror index.css).
const TOKEN_FALLBACKS = {
  borderSoft: ['--border-soft', '#eff2ec'],
  textMuted: ['--text-muted', '#8a968c'],
  textFaint: ['--text-faint', '#a8afaa'],
  bgSurface: ['--bg-surface', '#ffffff'],
}

function readTokens() {
  const css =
    typeof window !== 'undefined' && typeof getComputedStyle === 'function'
      ? getComputedStyle(document.documentElement)
      : null
  const out = {}
  for (const [key, [name, fallback]] of Object.entries(TOKEN_FALLBACKS)) {
    const v = css ? css.getPropertyValue(name).trim() : ''
    out[key] = v || fallback
  }
  return out
}

/** Parse a cell into a finite number, or NaN. Empty cells are not zero. */
function num(v) {
  if (v === '' || v === null || v === undefined) return NaN
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : NaN
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
  for (let i = 0; from + i * step <= to + eps; i++) {
    out.push(Number((from + i * step).toFixed(10)))
  }
  return out
}

/** X ticks on a nice step across [min, max] (0..14 -> 0,2,4,...,14). */
function xScale(min, max) {
  if (min === max) return { domain: [min - 1, max + 1], ticks: [min] }
  const step = niceStep((max - min) / 6)
  const start = Math.ceil(min / step - 1e-9) * step
  return { domain: [min, max], ticks: range(start, max, step) }
}

/** Y domain [0, niceMax] (35 -> 40; 40 -> 40) with ticks every nice step. */
function yScale(minVal, maxVal) {
  const top = Math.max(maxVal, 0)
  const step = niceStep((top || 1) / 4)
  let niceMax = Math.ceil(top / step - 1e-9) * step
  if (niceMax <= 0) niceMax = step
  const niceMin = minVal < 0 ? -Math.ceil(-minVal / step - 1e-9) * step : 0
  return { domain: [niceMin, niceMax], ticks: range(niceMin, niceMax, step) }
}

function ChartTooltip({ active, payload, xName, seriesById }) {
  if (!active || !payload || payload.length === 0) return null
  const x = payload[0]?.payload?.x
  const seen = new Set()
  return (
    <div className="chart-preview-tooltip">
      <div className="chart-preview-tooltip-title">
        {xName} {x}
      </div>
      {payload.map((entry) => {
        const series = seriesById[entry.dataKey]
        if (!series || seen.has(entry.dataKey)) return null
        seen.add(entry.dataKey)
        return (
          <div className="chart-preview-tooltip-row" key={entry.dataKey}>
            <span className="chart-preview-tooltip-dot" style={{ background: series.color }} />
            <span className="chart-preview-tooltip-name">{series.name}</span>
            <span className="chart-preview-tooltip-value">
              {entry.value === null || entry.value === undefined ? '—' : entry.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function ChartPreview({ state, chartRef }) {
  const t = useMemo(() => readTokens(), [])
  const gradientId = `chart-preview-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  const isScatter = state.chartType === 'scatter'

  const visibleSeries = useMemo(
    () =>
      state.yMode === 'both'
        ? state.series
        : state.series.filter((s) => s.id === state.yMode),
    [state.series, state.yMode],
  )

  const seriesById = useMemo(
    () => Object.fromEntries(state.series.map((s) => [s.id, s])),
    [state.series],
  )

  const data = useMemo(() => {
    const points = []
    for (const row of state.rows) {
      const x = num(row[state.xColumn])
      if (!Number.isFinite(x)) continue
      const point = { x }
      for (const s of state.series) {
        const v = num(row[s.columnIndex])
        point[s.id] = Number.isFinite(v) ? v : null
      }
      points.push(point)
    }
    return points.sort((a, b) => a.x - b.x)
  }, [state.rows, state.xColumn, state.series])

  const scales = useMemo(() => {
    if (data.length === 0) return null
    let xMin = Infinity
    let xMax = -Infinity
    let yMin = Infinity
    let yMax = -Infinity
    for (const p of data) {
      xMin = Math.min(xMin, p.x)
      xMax = Math.max(xMax, p.x)
      for (const s of visibleSeries) {
        const v = p[s.id]
        if (v === null) continue
        yMin = Math.min(yMin, v)
        yMax = Math.max(yMax, v)
      }
    }
    if (!Number.isFinite(yMin)) {
      yMin = 0
      yMax = 0
    }
    return { x: xScale(xMin, xMax), y: yScale(yMin, yMax) }
  }, [data, visibleSeries])

  const fillSeries = !isScatter && visibleSeries.includes(state.series[0]) ? state.series[0] : null
  const xName = state.columns[state.xColumn]?.name ?? 'X'
  const pointCount = data.length * visibleSeries.length

  const renderActiveDot = (color) => (props) => {
    const { cx, cy } = props
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return <g />
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.14} />
        <circle cx={cx} cy={cy} r={5} fill={color} stroke={t.bgSurface} strokeWidth={2} />
      </g>
    )
  }

  return (
    <section className="panel chart-preview" aria-label="Graph preview">
      <header className="chart-preview-header">
        <span className="chart-preview-header-icon">
          <BarChartIcon size={14} />
        </span>
        <span>Graph preview</span>
      </header>

      <div className="chart-preview-body">
        <div className="chart-preview-canvas" ref={chartRef}>
          <h2 className="chart-preview-title" data-export="text">
            {state.title}
          </h2>
          {state.showSubtitle && state.subtitle ? (
            <p className="chart-preview-subtitle" data-export="text">
              {state.subtitle}
            </p>
          ) : null}

          <div className="chart-preview-chart" style={{ height: CHART_HEIGHT }}>
            {!scales || visibleSeries.length === 0 ? (
              <div className="chart-preview-empty">
                {visibleSeries.length === 0
                  ? 'Pick a data series to plot.'
                  : 'Add a few valid rows and your graph will show up here.'}
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={CHART_HEIGHT}
                initialDimension={{ width: 600, height: CHART_HEIGHT }}
              >
                <ComposedChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    {fillSeries ? (
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={fillSeries.color} stopOpacity={0.14} />
                        <stop offset="100%" stopColor={fillSeries.color} stopOpacity={0} />
                      </linearGradient>
                    ) : null}
                  </defs>

                  {state.gridlines ? (
                    <CartesianGrid stroke={t.borderSoft} strokeWidth={1} horizontal vertical />
                  ) : null}

                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={scales.x.domain}
                    ticks={scales.x.ticks}
                    tickLine={false}
                    axisLine={{ stroke: t.borderSoft, strokeWidth: 1 }}
                    tick={{ fontSize: 11, fill: t.textFaint }}
                    tickMargin={4}
                    height={50}
                    label={{
                      value: state.xLabel,
                      position: 'insideBottom',
                      offset: 0,
                      fontSize: 11,
                      fill: t.textMuted,
                    }}
                  />
                  <YAxis
                    type="number"
                    domain={scales.y.domain}
                    ticks={scales.y.ticks}
                    width={52}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: t.textFaint }}
                    label={{
                      value: state.yLabel,
                      angle: -90,
                      position: 'insideLeft',
                      offset: 8,
                      fontSize: 11,
                      fill: t.textMuted,
                      style: { textAnchor: 'middle' },
                    }}
                  />

                  <Tooltip
                    cursor={false}
                    isAnimationActive={false}
                    wrapperStyle={{ outline: 'none' }}
                    content={<ChartTooltip xName={xName} seriesById={seriesById} />}
                  />

                  {fillSeries ? (
                    <Area
                      dataKey={fillSeries.id}
                      type="monotone"
                      fill={`url(#${gradientId})`}
                      fillOpacity={1}
                      stroke="none"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                      tooltipType="none"
                      legendType="none"
                      connectNulls
                    />
                  ) : null}

                  {visibleSeries.map((s) => (
                    <Line
                      key={s.id}
                      dataKey={s.id}
                      name={s.name}
                      type="monotone"
                      stroke={isScatter ? 'none' : s.color}
                      strokeWidth={s.width}
                      dot={
                        isScatter || state.showPoints
                          ? { r: isScatter ? 3.5 : 3, fill: s.color, strokeWidth: 0 }
                          : false
                      }
                      activeDot={renderActiveDot(s.color)}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {state.legend && visibleSeries.length > 0 ? (
            <ul className="chart-preview-legend" aria-label="Legend">
              {visibleSeries.map((s) => (
                <li key={s.id} className="chart-preview-legend-item">
                  <span
                    className={`chart-preview-legend-swatch${isScatter ? ' is-dot' : ''}`}
                    data-export="swatch"
                    style={{
                      background: s.color,
                      height: isScatter ? 8 : Math.max(2, s.width),
                    }}
                  />
                  <span className="chart-preview-legend-label" data-export="text">
                    {s.legendLabel || s.name}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <footer className="chart-preview-footer">
        <span>
          {visibleSeries.length} series · {pointCount} data points
        </span>
        <span>Hover over a point to pull up tooltips!</span>
      </footer>
    </section>
  )
}
