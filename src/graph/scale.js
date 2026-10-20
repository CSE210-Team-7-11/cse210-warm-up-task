import { collectOverflowErrors, finiteCalculation } from '../numericErrors.js'

export const WIDTH = 500
export const HEIGHT = 300
export const MARGIN = { top: 40, right: 5, bottom: 35, left: 45 }
export const PADDING = 5
export const TEXT_SIZE = 10
export const TITLE_TEXT_SIZE = 15
export const TICK_SIZE = 5

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
export function scale(domainMin, domainMax, rangeMin, rangeMax, columnName = 'axis') {
  const span = finiteCalculation(domainMax - domainMin, columnName, () => `${domainMin} to ${domainMax}`, 'axis range')
  return (value) => {
    // All values equal: put everything in the middle instead of dividing by zero.
    if (domainMax === domainMin) return (rangeMin + rangeMax) / 2
    const t = finiteCalculation(value - domainMin, columnName, value, 'chart position') / span
    return finiteCalculation(rangeMin + t * (rangeMax - rangeMin), columnName, value, 'chart position')
  }
}

// Returns `count + 1` evenly spaced values from min to max.
export function ticks(min, max, count = 5, columnName = 'axis') {
  const describeRange = () => `${min} to ${max}`
  const span = finiteCalculation(max - min, columnName, describeRange, 'axis range')
  return Array.from({ length: count + 1 }, (_, i) => finiteCalculation(min + span * (i / count), columnName, describeRange, 'axis ticks'))
}

export function gridlines(min, max, count = 5, columnName = 'axis') {
  return ticks(min, max, count, columnName).slice(1, -1)
}

export function bounds(columns) {
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  let count = 0
  for (let i = 0; i < columns.length; i++) {
    let shown = false
    for (const ys of columns.ys) {
      const y = ys[i]
      if (!Number.isFinite(y)) continue
      shown = true
      count++
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
    }
    if (!shown) continue
    if (columns.x[i] < xMin) xMin = columns.x[i]
    if (columns.x[i] > xMax) xMax = columns.x[i]
  }
  return { xMin, xMax, yMin, yMax, count }
}

// least squares fit, the line is y = slope * x + startHeight
export function trendLine(x, y, length, xColumnName = 'X', yColumnName = 'Y') {
  let count = 0
  let totalX = 0
  let totalY = 0
  let firstX = Infinity
  let lastX = -Infinity
  for (let i = 0; i < length; i++) {
    if (!Number.isFinite(y[i])) continue
    count++
    totalX = finiteCalculation(totalX + x[i], xColumnName, x[i], 'trend line')
    totalY = finiteCalculation(totalY + y[i], yColumnName, y[i], 'trend line')
    if (x[i] < firstX) firstX = x[i]
    if (x[i] > lastX) lastX = x[i]
  }
  if (count < 2) return null
  const averageX = totalX / count
  const averageY = totalY / count

  let top = 0
  let bottom = 0
  for (let i = 0; i < length; i++) {
    if (!Number.isFinite(y[i])) continue
    top = finiteCalculation(top + (x[i] - averageX) * (y[i] - averageY), yColumnName, y[i], 'trend line')
    bottom = finiteCalculation(bottom + (x[i] - averageX) * (x[i] - averageX), xColumnName, x[i], 'trend line')
  }
  // all points have the same x, cant fit a line (would divide by zero)
  if (bottom === 0) return null

  const slope = finiteCalculation(top / bottom, yColumnName, averageY, 'trend line')
  return { slope, startHeight: finiteCalculation(averageY - slope * averageX, yColumnName, averageY, 'trend line'), firstX, lastX }
}

export function invert(domainMin, domainMax, rangeMin, rangeMax, columnName = 'axis') {
  const span = finiteCalculation(domainMax - domainMin, columnName, () => `${domainMin} to ${domainMax}`, 'axis range')
  return (pixel) => {
    if (domainMax === domainMin) return domainMin
    if (rangeMax === rangeMin) return domainMin
    const t = (pixel - rangeMin) / (rangeMax - rangeMin)
    return finiteCalculation(domainMin + t * span, columnName, () => `${domainMin} to ${domainMax}`, 'axis value')
  }
}

export function findNearest(columns, layout, px, py, maxDistance, {
  radiusAt, maxRadius = maxDistance, hitTest, maxHitRadius = maxRadius,
  isAbove = (s, i, otherSeries, otherIndex) => s < otherSeries || (s === otherSeries && i > otherIndex),
} = {}) {
  if (!columns.length || !Number.isFinite(px) || !Number.isFinite(py) ||
    !Number.isFinite(maxDistance) || maxDistance < 0 ||
    !Number.isFinite(maxRadius) || maxRadius < 0 ||
    !Number.isFinite(maxHitRadius) || maxHitRadius < 0) return null

  const inverseX = layout.fromX(Math.max(layout.left, Math.min(px, layout.right)))
  const x = Math.max(layout.xMin, Math.min(inverseX, layout.xMax))
  let low = 0
  let high = columns.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (columns.x[middle] < x) low = middle + 1
    else high = middle
  }

  let nearest = null
  let hit = null
  let distance = Math.max(maxDistance, maxRadius)
  function check(index) {
    // Missing-only rows can lie outside the plotted domain. Do not project them.
    if (columns.x[index] < layout.xMin || columns.x[index] > layout.xMax) return false
    const dx = layout.toX(columns.x[index]) - px
    // Keep overlapping markers in range even after finding a closer centre.
    if (Math.abs(dx) > Math.max(distance, hitTest ? maxHitRadius : 0)) return false
    for (let seriesIndex = 0; seriesIndex < columns.ys.length; seriesIndex++) {
      const y = columns.ys[seriesIndex][index]
      if (!Number.isFinite(y)) continue
      const dy = layout.toY(y) - py
      if (hitTest?.(seriesIndex, index, dx, dy)) {
        if (!hit || isAbove(seriesIndex, index, hit.seriesIndex, hit.index)) hit = { seriesIndex, index }
        distance = 0
        continue
      }
      if (hit) continue
      const nextDistance = Math.hypot(dx, dy)
      const targetRadius = Math.max(maxDistance, radiusAt?.(seriesIndex, index) ?? 0)
      if (nextDistance > targetRadius) continue
      if (nextDistance < distance || (nextDistance === distance && (!nearest ||
        seriesIndex < nearest.seriesIndex || (seriesIndex === nearest.seriesIndex && index < nearest.index)))) {
        distance = nextDistance
        nearest = { seriesIndex, index }
      }
    }
    return true
  }

  for (let i = low; i < columns.length; i++) {
    if (!check(i)) break
  }
  for (let i = low - 1; i >= 0; i--) {
    if (!check(i)) break
  }
  return hit ?? nearest
}

export function computeLayout({ xMin, xMax, yMin, yMax, xColumnName = 'X', yColumnName = 'Y', extraHeight = 0 }) {
  const left = MARGIN.left
  const right = WIDTH - MARGIN.right
  const top = MARGIN.top + extraHeight
  const height = HEIGHT + extraHeight
  const bottom = height - MARGIN.bottom
  function axis(min, max, start, end, columnName) {
    const toPixel = scale(min, max, start, end, columnName)
    const fromPixel = invert(min, max, start, end, columnName)
    const axisTicks = ticks(min, max, 5, columnName)
    return { toPixel, fromPixel, ticks: axisTicks, gridlines: axisTicks.slice(1, -1) }
  }
  const [x, y] = collectOverflowErrors([
    () => axis(xMin, xMax, left, right, xColumnName),
    () => axis(yMin, yMax, bottom, top, yColumnName),
  ])

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    left,
    right,
    top,
    bottom,
    height,
    toX: x.toPixel,
    toY: y.toPixel,
    fromX: x.fromPixel,
    fromY: y.fromPixel,
    xTicks: x.ticks,
    yTicks: y.ticks,
    xGridlines: x.gridlines,
    yGridlines: y.gridlines,
  }
}
