import { CHART_THEME as T, MARGIN, linear } from './chartUtils.js'

/**
 * Shared SVG frame for every chart type: gridlines (always on), tick labels, axis titles.
 * The chart-specific marks are drawn by `children`, a render function that
 * receives plot-space helpers:
 *
 *   children({ xPos, yPos, plotWidth, plotHeight })
 *     xPos(dataX) -> px   yPos(dataY) -> px   (already inside the plot area)
 *
 */
export default function ChartFrame({ width, height, scales, xLabel, yLabel, children }) {
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const xPos = linear(scales.x.domain, [0, plotWidth])
  const yPos = linear(scales.y.domain, [plotHeight, 0])

  const text = { fontSize: T.fontSize, fill: T.tick }

  return (
    <svg
      className="chart-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Graph preview"
    >
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {/* Gridlines */}
        <g stroke={T.grid} strokeWidth={1}>
          {scales.y.ticks.map((t) => (
            <line key={`gy${t}`} x1={0} x2={plotWidth} y1={yPos(t)} y2={yPos(t)} />
          ))}
          {scales.x.ticks.map((t) => (
            <line key={`gx${t}`} x1={xPos(t)} x2={xPos(t)} y1={0} y2={plotHeight} />
          ))}
        </g>

        {/* X axis line + tick labels */}
        <line x1={0} x2={plotWidth} y1={plotHeight} y2={plotHeight} stroke={T.grid} />
        {scales.x.ticks.map((t) => (
          <text key={`tx${t}`} x={xPos(t)} y={plotHeight + 16} textAnchor="middle" {...text}>
            {t}
          </text>
        ))}

        {/* Y tick labels */}
        {scales.y.ticks.map((t) => (
          <text key={`ty${t}`} x={-10} y={yPos(t)} textAnchor="end" dominantBaseline="central" {...text}>
            {t}
          </text>
        ))}

        {/* Chart-specific marks (LineGraph / ScatterPlot) */}
        {children({ xPos, yPos, plotWidth, plotHeight })}
      </g>

      {/* Axis titles */}
      <text
        x={MARGIN.left + plotWidth / 2}
        y={height - 6}
        textAnchor="middle"
        fontSize={T.fontSize}
        fill={T.label}
      >
        {xLabel}
      </text>
      <text
        transform={`translate(14,${MARGIN.top + plotHeight / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={T.fontSize}
        fill={T.label}
      >
        {yLabel}
      </text>
    </svg>
  )
}

/** Dashed box with a message, drawn inside the plot area. Used by the TODO stubs. */
export function PlotPlaceholder({ plotWidth, plotHeight, label, hint }) {
  return (
    <g>
      <rect
        x={0.5}
        y={0.5}
        width={plotWidth - 1}
        height={plotHeight - 1}
        fill="none"
        stroke={T.label}
        strokeDasharray="4 4"
        rx={6}
      />
      <text
        x={plotWidth / 2}
        y={plotHeight / 2 - 8}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fill={T.label}
      >
        {label}
      </text>
      <text x={plotWidth / 2} y={plotHeight / 2 + 12} textAnchor="middle" fontSize={11} fill={T.tick}>
        {hint}
      </text>
    </g>
  )
}
