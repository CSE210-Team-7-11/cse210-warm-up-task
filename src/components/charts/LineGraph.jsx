import { useId } from 'react'
import Marker from './Marker.jsx'

// Line marks for Anna's graph library. Null values break a line into segments.
export default function LineGraph({ series, xPos, yPos, showPoints, hovered, clipPathId, top, bottom }) {
  const gradientId = 'line-fill-' + useId().replaceAll(':', '')
  const paths = series.map((oneSeries) => {
    const segments = []
    let segment = []
    const sorted = [...oneSeries.points].sort((a, b) => a.x - b.x)
    for (const point of sorted) {
      if (!Number.isFinite(point.y)) {
        if (segment.length) segments.push(segment)
        segment = []
      } else {
        segment.push(point)
      }
    }
    if (segment.length) segments.push(segment)

    const line = segments.map((points) => points
      .map((point, i) => `${i === 0 ? 'M' : 'L'}${xPos(point.x)},${yPos(point.y)}`)
      .join(' ')).join(' ')
    const area = segments.map((points) => {
      const first = points[0]
      const last = points[points.length - 1]
      const edge = points.map((point) => `L${xPos(point.x)},${yPos(point.y)}`).join(' ')
      return `M${xPos(first.x)},${yPos(0)} ${edge} L${xPos(last.x)},${yPos(0)} Z`
    }).join(' ')
    return { line, area }
  })

  return (
    <g className="line-graph">
      {/* Fill only series 1, behind all line marks and clipped to the plot. */}
      {series[0] && (
        <>
          <defs>
            <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1={top} x2="0" y2={bottom}>
              <stop offset="0%" stopColor={series[0].color || '#256b47'} stopOpacity={0.14} />
              <stop offset="100%" stopColor={series[0].color || '#256b47'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path className="line-area" d={paths[0].area} fill={`url(#${gradientId})`} clipPath={`url(#${clipPathId})`} />
        </>
      )}
      {/* Reverse drawing order keeps series 1 on top. */}
      {series.map((oneSeries, seriesNumber) => ({ oneSeries, seriesNumber })).reverse()
        .map(({ oneSeries, seriesNumber }) => (
          <g key={seriesNumber}>
            <path
              className="line"
              d={paths[seriesNumber].line}
              style={{ stroke: oneSeries.color, strokeDasharray: oneSeries.dash }}
            />
            {showPoints && oneSeries.points.map((point, pointNumber) => {
              if (!Number.isFinite(point.y)) return null
              const isHovered = hovered?.seriesNumber === seriesNumber && hovered?.pointNumber === pointNumber
              return (
                <Marker
                  key={pointNumber}
                  shape={oneSeries.marker}
                  cx={xPos(point.x)}
                  cy={yPos(point.y)}
                  size={isHovered ? 10 : 7}
                  fill={oneSeries.color || '#256b47'}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              )
            })}
          </g>
        ))}
    </g>
  )
}
