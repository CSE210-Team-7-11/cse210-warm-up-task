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

