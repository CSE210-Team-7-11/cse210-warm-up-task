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

// least squares fit, the line is y = slope * x + startHeight
export function trendLine(points, xColumnName = 'X', yColumnName = 'Y') {
  if (points.length < 2) return null

  let totalX = 0
  let totalY = 0
  for (const point of points) {
    totalX = finiteCalculation(totalX + point.x, xColumnName, point.x, 'trend line')
    totalY = finiteCalculation(totalY + point.y, yColumnName, point.y, 'trend line')
  }
  const averageX = totalX / points.length
  const averageY = totalY / points.length

  let top = 0
  let bottom = 0
  for (const point of points) {
    top = finiteCalculation(top + (point.x - averageX) * (point.y - averageY), yColumnName, point.y, 'trend line')
    bottom = finiteCalculation(bottom + (point.x - averageX) * (point.x - averageX), xColumnName, point.x, 'trend line')
  }
  // all points have the same x, cant fit a line (would divide by zero)
  if (bottom === 0) return null

  const slope = finiteCalculation(top / bottom, yColumnName, averageY, 'trend line')
  return { slope, startHeight: finiteCalculation(averageY - slope * averageX, yColumnName, averageY, 'trend line') }
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

export function findNearest(columns, layout, px, py, maxDistance, { radiusAt, maxRadius = maxDistance } = {}) {
  if (!columns.length || !Number.isFinite(px) || !Number.isFinite(py) ||
    !Number.isFinite(maxDistance) || maxDistance < 0 ||
    !Number.isFinite(maxRadius) || maxRadius < 0) return null

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
  let distance = Math.max(maxDistance, maxRadius)
  function check(index) {
    // Missing-only rows can lie outside the plotted domain. Do not project them.
    if (columns.x[index] < layout.xMin || columns.x[index] > layout.xMax) return false
    const dx = layout.toX(columns.x[index]) - px
    if (Math.abs(dx) > distance) return false
    for (let seriesIndex = 0; seriesIndex < columns.ys.length; seriesIndex++) {
      const y = columns.ys[seriesIndex][index]
      if (!Number.isFinite(y)) continue
      const nextDistance = Math.hypot(dx, layout.toY(y) - py)
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
  return nearest
}

export function computeLayout({ xMin, xMax, yMin, yMax, xColumnName = 'X', yColumnName = 'Y' }) {
  const left = MARGIN.left
  const right = WIDTH - MARGIN.right
  const top = MARGIN.top
  const bottom = HEIGHT - MARGIN.bottom
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
