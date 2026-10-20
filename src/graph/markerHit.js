export function containsMarker(shape, dx, dy, radius, canvas = false, outline = 0) {
  if (!(radius > 0)) return false
  if (shape === 'square') {
    if (!canvas) return Math.abs(dx) <= radius + outline && Math.abs(dy) <= radius + outline
    const corner = canvas ? Math.min(1, radius) : 0
    const x = Math.max(0, Math.abs(dx) - radius + corner)
    const y = Math.max(0, Math.abs(dy) - radius + corner)
    return Math.hypot(x, y) <= corner + outline && Math.abs(dx) <= radius + outline && Math.abs(dy) <= radius + outline
  }
  if (shape === 'triangle') {
    const top = canvas ? -radius * 1.1 - 0.5 : -radius
    const bottom = canvas ? radius * 1.1 : radius
    const halfWidth = canvas ? radius + 0.5 : radius
    const slope = halfWidth / (bottom - top)
    return dy <= bottom + outline && Math.abs(dx) <= slope * (dy - top) + outline * Math.hypot(1, slope)
  }
  return Math.hypot(dx, dy) <= radius + outline
}
