// -Infinity skips a sample; +Infinity and legacy null values break the line.
export function lineSegments(points) {
  const segments = []
  let segment = []
  for (const point of [...points].sort((a, b) => a.x - b.x)) {
    if (point.y === -Infinity) continue
    if (!Number.isFinite(point.y)) {
      if (segment.length) segments.push(segment)
      segment = []
    } else {
      segment.push(point)
    }
  }
  if (segment.length) segments.push(segment)
  return segments
}
