import { el } from './svg.js'
import { lineMarker } from './Marker.js'
import { lineSegments } from './lineSegments.js'

export default function lineGraph({ series, xPos, yPos, showPoints, clipPathId, gradientId, top, bottom }) {
  const markers = new Map()
  const paths = series.map((oneSeries) => {
    const segments = lineSegments(oneSeries.points)

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

  const children = []
  // Fill only series 1, behind all line marks and clipped to the plot.
  if (series[0]) {
    children.push(
      el('defs', {}, [
        el('linearGradient', { id: gradientId, gradientUnits: 'userSpaceOnUse', x1: 0, y1: top, x2: 0, y2: bottom }, [
          el('stop', { offset: '0%', 'stop-color': series[0].color || '#256b47', 'stop-opacity': 0.14 }),
          el('stop', { offset: '100%', 'stop-color': series[0].color || '#256b47', 'stop-opacity': 0 }),
        ]),
      ]),
      el('path', { class: 'line-area', d: paths[0].area, fill: `url(#${gradientId})`, 'clip-path': `url(#${clipPathId})` }),
    )
  }

  // Reverse drawing order keeps series 1 on top.
  for (let seriesNumber = series.length - 1; seriesNumber >= 0; seriesNumber--) {
    const oneSeries = series[seriesNumber]
    const group = el('g', {}, [
      el('path', { class: 'line', d: paths[seriesNumber].line, style: { stroke: oneSeries.color, strokeDasharray: oneSeries.dash } }),
    ])
    if (showPoints) {
      oneSeries.points.forEach((point, pointNumber) => {
        if (!Number.isFinite(point.y)) return
        const make = (isHovered) => lineMarker({
          shape: oneSeries.marker,
          cx: xPos(point.x),
          cy: yPos(point.y),
          size: isHovered ? 10 : 7,
          fill: oneSeries.color || '#256b47',
          stroke: '#fff',
          strokeWidth: 1.5,
        })
        const element = make(false)
        group.append(element)
        markers.set(`${seriesNumber}-${pointNumber}`, { element, make })
      })
    }
    children.push(group)
  }

  return { group: el('g', { class: 'line-graph' }, children), markers }
}
