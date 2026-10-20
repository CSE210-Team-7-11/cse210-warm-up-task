export function containsMarker(shape, dx, dy, radius, outline = 0) {
  if (!(radius > 0) || shape === 'none') return false
  if (shape === 'square') {
    const corner = Math.min(1, radius)
    const x = Math.max(0, Math.abs(dx) - radius + corner)
    const y = Math.max(0, Math.abs(dy) - radius + corner)
    return Math.hypot(x, y) <= corner + outline && Math.abs(dx) <= radius + outline && Math.abs(dy) <= radius + outline
  }
  if (shape === 'triangle') {
    const top = -radius * 1.1 - 0.5
    const bottom = radius * 1.1
    const halfWidth = radius + 0.5
    const slope = halfWidth / (bottom - top)
    return dy <= bottom + outline && Math.abs(dx) <= slope * (dy - top) + outline * Math.hypot(1, slope)
  }
  return Math.hypot(dx, dy) <= radius + outline
}
