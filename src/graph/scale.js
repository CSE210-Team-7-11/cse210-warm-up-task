export function minMax(values) {
  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  return { min, max }
}

// Returns a function that maps a value in [domainMin, domainMax]
// to a pixel position in [rangeMin, rangeMax].
export function scale(domainMin, domainMax, rangeMin, rangeMax) {
  return (value) => {
    // All values equal: put everything in the middle instead of dividing by zero.
    if (domainMax === domainMin) return (rangeMin + rangeMax) / 2
    const t = (value - domainMin) / (domainMax - domainMin)
    return rangeMin + t * (rangeMax - rangeMin)
  }
}

// Returns `count + 1` evenly spaced values from min to max.
export function ticks(min, max, count = 5) {
  return Array.from({ length: count + 1 }, (_, i) => min + ((max - min) * i) / count)
}

export function gridlines(min, max, count = 5) {
  return ticks(min, max, count).slice(1, -1)
}

// least squares fit, the line is y = slope * x + startHeight
export function trendLine(points) {
  if (points.length < 2) return null

  let totalX = 0
  let totalY = 0
  for (const point of points) {
    totalX += point.x
    totalY += point.y
  }
  const averageX = totalX / points.length
  const averageY = totalY / points.length

  let top = 0
  let bottom = 0
  for (const point of points) {
    top += (point.x - averageX) * (point.y - averageY)
    bottom += (point.x - averageX) * (point.x - averageX)
  }
  // all points have the same x, cant fit a line (would divide by zero)
  if (bottom === 0) return null

  const slope = top / bottom
  return { slope, startHeight: averageY - slope * averageX }
}
