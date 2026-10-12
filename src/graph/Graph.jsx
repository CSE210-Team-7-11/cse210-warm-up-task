import { useId, useState } from 'react'
import { scale, ticks, gridlines, trendLine } from './scale.js'
import Legend from './Legend.jsx'
import Marker from './Marker.jsx'
import Tooltip from './Tooltip.jsx'
import './Graph.css'

const DEFAULT_LABELS = {
  title: 'Your Title',
  subtitle: 'Your Subtitle',
  x_axis_label: 'Your X Axis Label',
  y_axis_label: 'Your Y Axis Label',
}

const WIDTH = 500
const HEIGHT = 300
const MARGIN = { top: 40, right: 5, bottom: 35, left: 45 }
const PADDING = 5
const TEXT_SIZE = 10
const TITLE_TEXT_SIZE = 15
const TICK_SIZE = 5
const MIN_RADIUS = 3
const MAX_RADIUS = 100
const MIN_HOVER_TARGET_RADIUS = 10
const HOVER_EXTRA_RADIUS = 1.5

const round = (v) => Math.round(v * 10) / 10

// Draws `points` ([{ x, y }, ...]) as a scatter or line plot.
// for more than one series pass series = [{ name, color, marker, points }]
export default function Graph({ points, series, type = 'scatter', labels = {}, showTrendLine = false }) {
  // the hovered point, as { seriesNumber, pointNumber }
  const [hovered, setHovered] = useState(null)

  // react puts colons in its ids and those break url(#...)
  const plotAreaId = 'plot-area-' + useId().replaceAll(':', '')

  const { title, subtitle, x_axis_label, y_axis_label } = { ...DEFAULT_LABELS, ...labels }

  // a plain list of points counts as one series
  let allSeries = series
  if (!allSeries) {
    allSeries = [{ name: labels.legend, points }]
  }

  // line plot only draws the first series for now
  let shownSeries = allSeries
  if (type === 'line') {
    shownSeries = [{ name: allSeries[0].name, points: allSeries[0].points }]
  }

  const shownPoints = []
  for (const oneSeries of shownSeries) {
    shownPoints.push(...oneSeries.points)
  }

  const xs = shownPoints.map((p) => p.x)
  const ys = shownPoints.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)

  const sizes = shownPoints.map((p) => p.z).filter(Number.isFinite)
  const sizeMin = Math.min(...sizes)
  const sizeMax = Math.max(...sizes)

  const toRadius = (size) => {
    if (!Number.isFinite(size) || size <= 0) return MIN_RADIUS
    const r = MIN_RADIUS * Math.sqrt(size / sizeMin)
    return Math.min(MAX_RADIUS, r)
  }

  const left = MARGIN.left
  const right = WIDTH - MARGIN.right
  const top = MARGIN.top
  const bottom = HEIGHT - MARGIN.bottom

  const toX = scale(xMin, xMax, left, right)
  // SVG's y-axis points down, so larger values map to smaller pixel positions.
  const toY = scale(yMin, yMax, bottom, top)

  const sorted = [...shownSeries[0].points].sort((a, b) => a.x - b.x)
  const linePath = sorted
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.x)},${toY(p.y)}`)
    .join(' ')

  // only show the series name when theres more than one
  let hoveredPoint = null
  let hoveredName
  if (hovered && shownSeries[hovered.seriesNumber]) {
    const hoveredSeries = shownSeries[hovered.seriesNumber]
    hoveredPoint = hoveredSeries.points[hovered.pointNumber]
    if (shownSeries.length > 1) {
      hoveredName = hoveredSeries.name
    }
  }

  return (
    <svg
      className="graph"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${type} plot of ${shownPoints.length} points`}
    >
      {/* HEADER */}
      <text
        className="title"
        x={0}
        y={TITLE_TEXT_SIZE}
        textAnchor="left"
      >
        {title}
      </text>
      <text
        className="subtitle"
        x={0}
        y={TITLE_TEXT_SIZE + TEXT_SIZE + PADDING}
        textAnchor="left"
      >
        {subtitle}
      </text>

      {/* LEGEND */}
      <Legend sizes={sizes} series={shownSeries} toRadius={toRadius} right={right} />

      {/* AXES */}
      <line className="axis" x1={left} y1={bottom} x2={right} y2={bottom} />
      <line className="axis" x1={left} y1={top} x2={left} y2={bottom} />

      {/* GRIDLINES */}
      {gridlines(xMin, xMax).map((v, i) => (
        <g key={`x${i}`}>
          <line className="gridline" x1={toX(v)} y1={top} x2={toX(v)} y2={bottom + TICK_SIZE} />
        </g>
      ))}
      {gridlines(yMin, yMax).map((v, i) => (
        <g key={`y${i}`}>
          <line className="gridline" x1={left - TICK_SIZE} y1={toY(v)} x2={right} y2={toY(v)} />
        </g>
      ))}

      {/* TICKS */}
      {ticks(xMin, xMax).map((v, i) => (
        <g key={`x${i}`}>
          <line className="ticks" x1={toX(v)} y1={bottom} x2={toX(v)} y2={bottom + TICK_SIZE} />
          <text className="label" x={toX(v)} y={bottom + TEXT_SIZE + PADDING + TICK_SIZE} textAnchor="middle">
            {round(v)}
          </text>
        </g>
      ))}
      {ticks(yMin, yMax).map((v, i) => (
        <g key={`y${i}`}>
          <line className="ticks" x1={left - TICK_SIZE} y1={toY(v)} x2={left} y2={toY(v)} />
          <text className="label" x={left - TICK_SIZE - PADDING } y={toY(v) + 4} textAnchor="end">
            {round(v)}
          </text>
        </g>
      ))}

      {/* AXES LABELS */}
      <text
        className="label"
        x={(left + right) / 2}
        y={HEIGHT}
        textAnchor="middle"
      >
        {x_axis_label}
      </text>
      <text
        className="label"
        transform={`translate(${TEXT_SIZE}, ${(top + bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        {y_axis_label}
      </text>

      {/* TREND LINES, clipped so they dont poke out of the plot */}
      <defs>
        <clipPath id={plotAreaId}>
          <rect x={left} y={top} width={right - left} height={bottom - top} />
        </clipPath>
      </defs>
      {showTrendLine &&
        type === 'scatter' &&
        shownSeries.map((oneSeries, seriesNumber) => {
          const trend = trendLine(oneSeries.points)
          if (!trend) return null
          const firstX = Math.min(...oneSeries.points.map((point) => point.x))
          const lastX = Math.max(...oneSeries.points.map((point) => point.x))
          return (
            <line
              key={seriesNumber}
              className="trend"
              clipPath={`url(#${plotAreaId})`}
              style={{ stroke: oneSeries.color }}
              x1={toX(firstX)}
              y1={toY(trend.slope * firstX + trend.startHeight)}
              x2={toX(lastX)}
              y2={toY(trend.slope * lastX + trend.startHeight)}
            />
          )
        })}

      {/* POINTS */}
      {type === 'line' ? (
        <path className="line" d={linePath} />
      ) : (
        shownSeries.map((oneSeries, seriesNumber) =>
          oneSeries.points.map((point, pointNumber) => {
            const isHovered =
              hovered !== null &&
              hovered.seriesNumber === seriesNumber &&
              hovered.pointNumber === pointNumber

            let radius = toRadius(point.z)
            if (isHovered) {
              radius += HOVER_EXTRA_RADIUS
            }

            return (
              <Marker
                key={`${seriesNumber}-${pointNumber}`}
                shape={oneSeries.marker}
                color={oneSeries.color}
                cx={toX(point.x)}
                cy={toY(point.y)}
                r={radius}
              />
            )
          })
        )
      )}

      {/* HOVER TARGETS + TOOLTIP */}
      {shownSeries.map((oneSeries, seriesNumber) =>
        oneSeries.points.map((point, pointNumber) => (
          <circle
            key={`${seriesNumber}-${pointNumber}`}
            className="hit"
            cx={toX(point.x)}
            cy={toY(point.y)}
            r={Math.max(toRadius(point.z), MIN_HOVER_TARGET_RADIUS)}
            onMouseEnter={() => setHovered({ seriesNumber, pointNumber })}
            onMouseLeave={() => setHovered(null)}
          />
        ))
      )}
      <Tooltip
        point={hoveredPoint}
        name={hoveredName}
        type={type}
        toX={toX}
        toY={toY}
        toRadius={toRadius}
        bounds={{ left, right, top }}
      />

    </svg>
  )
}
