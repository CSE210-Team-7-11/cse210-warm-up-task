/**
 * Point marker shapes. Each series gets its own shape (see SERIES_STYLES in
 * state.js) so series stay distinguishable without relying on color.
 * Centered on (cx, cy); `size` is roughly the diameter in px.
 */
export default function Marker({ shape = 'circle', cx, cy, size = 7, fill, stroke = 'none', strokeWidth = 0 }) {
  if (shape === 'none') return null
  const r = size / 2
  const common = { fill, stroke, strokeWidth }
  if (shape === 'square') {
    return <rect x={cx - r} y={cy - r} width={size} height={size} rx={1} {...common} />
  }
  if (shape === 'triangle') {
    const h = size * 1.1
    const points = `${cx},${cy - h / 2 - 0.5} ${cx + r + 0.5},${cy + h / 2} ${cx - r - 0.5},${cy + h / 2}`
    return <polygon points={points} {...common} />
  }
  return <circle cx={cx} cy={cy} r={r} {...common} />
}
