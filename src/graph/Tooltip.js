import { el } from './svg.js'

const BOX_PADDING = 5
const BOX_TEXT_SIZE = 10
const APPROX_CHAR_WIDTH = 5
const HOVER_MARKER_RADIUS = 3

export default function tooltip({ point, name, toX, toY, toRadius, bounds, showHoverMarker = false }) {
  if (!point) return null

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
