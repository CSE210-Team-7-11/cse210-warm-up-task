import { el } from './svg.js'

// circle, square or triangle so series dont rely on color alone
export function marker({ shape, cx, cy, r, color }) {
  const style = { fill: color }

  if (shape === 'square') {
    return el('rect', { class: 'point', style, x: cx - r, y: cy - r, width: 2 * r, height: 2 * r })
  }

  if (shape === 'triangle') {
    const corners = `${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`
    return el('polygon', { class: 'point', style, points: corners })
  }

  return el('circle', { class: 'point', style, cx, cy, r })
}

/**
 * Point marker shapes. Each series gets its own shape (see SERIES_STYLES in
 * state.js) so series stay distinguishable without relying on color.
 * Centered on (cx, cy); `size` is roughly the diameter in px.
 */
export function lineMarker({ shape = 'circle', cx, cy, size = 7, fill, stroke = 'none', strokeWidth = 0 }) {
  const r = size / 2
  const common = { fill, stroke, 'stroke-width': strokeWidth }
  if (shape === 'square') {
    return el('rect', { x: cx - r, y: cy - r, width: size, height: size, rx: 1, ...common })
  }
  if (shape === 'triangle') {
    const h = size * 1.1
    const points = `${cx},${cy - h / 2 - 0.5} ${cx + r + 0.5},${cy + h / 2} ${cx - r - 0.5},${cy + h / 2}`
    return el('polygon', { points, ...common })
  }
  return el('circle', { cx, cy, r, ...common })
}
