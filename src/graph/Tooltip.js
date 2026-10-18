import { el } from './svg.js'
import { marker as markerShape } from './Marker.js'

const BOX_PADDING = 5
const BOX_TEXT_SIZE = 10
const APPROX_CHAR_WIDTH = 5
const HOVER_MARKER_RADIUS = 3

export default function tooltip({ point, name, type, toX, toY, toRadius, bounds, color, marker, xLabel = 'X', showHoverMarker = type === 'line' }) {
  if (!point) return null

  if (type === 'line') {
    const padding = 7
    const fontSize = 8
    const charWidth = 4.5
    const markerSpace = 12
    const boxHeight = 34
    const maxWidth = bounds.right - bounds.left
    const value = String(point.y)
    // Keep long uploaded column names inside the plot, without changing values.
    const shorten = (label, available) => {
      const count = Math.max(1, Math.floor(available / charWidth))
      return label.length > count ? label.slice(0, count - 1) + '…' : label
    }
    const xName = shorten(xLabel, maxWidth - 2 * padding - (String(point.x).length + 2) * charWidth)
    const seriesName = shorten(name || 'Value', maxWidth - 2 * padding - markerSpace - (value.length + 2) * charWidth)
    const xText = `${xName}: ${point.x}`
    const seriesText = `${seriesName}: ${value}`
    const boxWidth = Math.min(maxWidth, Math.max(xText.length * charWidth, markerSpace + seriesText.length * charWidth) + 2 * padding)
    const pointX = toX(point.x)
    const pointY = toY(point.y)
    const gap = toRadius(point.z) + 6
    const rightX = pointX + gap
    const preferredX = rightX + boxWidth <= bounds.right ? rightX : pointX - gap - boxWidth
    const boxX = Math.max(bounds.left, Math.min(preferredX, bounds.right - boxWidth))
    const aboveY = pointY - gap - boxHeight
    const preferredY = aboveY >= bounds.top ? aboveY : pointY + gap
    const boxY = Math.max(bounds.top, Math.min(preferredY, (bounds.bottom ?? Infinity) - boxHeight))

    return el('g', { class: 'tooltip' }, [
      el('rect', { x: boxX, y: boxY, width: boxWidth, height: boxHeight, rx: 3 }),
      el('text', { x: boxX + padding, y: boxY + 13, style: { fontSize: '7.5px', fill: 'var(--text-muted, #8a968c)' }, text: xText }),
      markerShape({ shape: marker, color, cx: boxX + padding + 3, cy: boxY + 25, r: 3 }),
      el('text', { x: boxX + padding + markerSpace, y: boxY + 28, style: { fontSize: `${fontSize}px` } }, [
        document.createTextNode(`${seriesName}: `),
        el('tspan', { 'font-weight': '600', text: value }),
      ]),
    ])
  }

  const values = [point.x, point.y, point.z].filter(Number.isFinite).join(', ')
  // say which series the point is from
  const text = name ? `${name}: ${values}` : values
  const boxWidth = text.length * APPROX_CHAR_WIDTH + 2 * BOX_PADDING
  const boxHeight = BOX_TEXT_SIZE + BOX_PADDING
  const pointX = toX(point.x)
  const pointY = toY(point.y)
  const pointRadius = toRadius(point.z)

  const clampedX = Math.min(Math.max(pointX - boxWidth / 2, bounds.left), bounds.right - boxWidth)
  const yAbovePoint = pointY - pointRadius - boxHeight - BOX_PADDING
  const yBelowPoint = pointY + pointRadius + BOX_PADDING
  const boxY = yAbovePoint < bounds.top ? yBelowPoint : yAbovePoint

  return el('g', { class: 'tooltip' }, [
    showHoverMarker && el('circle', { class: 'point', cx: pointX, cy: pointY, r: HOVER_MARKER_RADIUS }),
    el('rect', { x: clampedX, y: boxY, width: boxWidth, height: boxHeight, rx: 3 }),
    el('text', { x: clampedX + boxWidth / 2, y: boxY + boxHeight - BOX_PADDING + 1, 'text-anchor': 'middle', text }),
  ])
}
