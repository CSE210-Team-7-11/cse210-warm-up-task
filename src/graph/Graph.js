import { WIDTH, bounds, computeLayout, findNearest, trendLine } from './scale.js'
import { drawFrame, drawLegend, drawLines, drawMarker, drawTooltip, drawTrendLines, measureLegend } from './canvas.js'
import { prepareSeries } from './series.js'
import { containsMarker } from './markerHit.js'
import { collectOverflowErrors, finiteCalculation } from '../numericErrors.js'
import './Graph.css'

const DEFAULT_LABELS = {
  title: 'Your Title',
  subtitle: 'Your Subtitle',
  x_axis_label: 'Your X Axis Label',
  y_axis_label: 'Your Y Axis Label',
}


const HOVER_DISTANCE = 10
const HOVER_EXTRA_SIZE = 3
const TOOLTIP_GAP = 9

/**
 * 
 * @typedef {Object} ChartColumns
 * @property {number} length
 * @property {Float32Array | Float64Array} x
 * @property {(Float32Array | Float64Array)[]} ys
 * 
 * @typedef {Object} ChartOptions
 * @property {ChartColumns} columns
 * @property {{ name: string, color: string, marker: string, dash: string }[]} series
 * @property {'line' | 'scatter'} [type='scatter']
 * @property {string} [xColumnName]
 * @property {{ title?: string, subtitle?: string, x_axis_label?: string, y_axis_label?: string }} [labels]
 * @property {boolean} [showTrendLine=false]
 * @property {boolean} [showPoints=true]
 * @property {number} [pointSize=7]
 * 
 * Creates the chart in a canvas element appended to the specified container with the 
 * specified options.
 *
 * @param {HTMLElement} container The chart will be rendered inside a canvas element appended to this container.
 * @param {ChartOptions} options Initial chart data and settings.
 * @returns { update(options): function, destroy(): function } An object with methods to update the chart with new options and to destroy the chart instance.
 */
export function createChart(container, options) {
  const canvas = document.createElement('canvas')
  canvas.className = 'graph'
  canvas.setAttribute('role', 'img')
  const ctx = canvas.getContext('2d')
  const saved = document.createElement('canvas')

  const resizeObserver = new ResizeObserver(() => {
    if (view) drawCanvas()
  })
  resizeObserver.observe(container)

  let view = null
  // the hovered point, as { seriesIndex, index }
  let hovered = null

  function update({ series, columns, xColumnName, type = 'scatter', labels = {}, showTrendLine = false, showPoints = true, pointSize = 7 }) {
    hovered = null

    const { title, subtitle, x_axis_label, y_axis_label } = { ...DEFAULT_LABELS, ...labels }

    const plotted = prepareSeries(series, columns, type)
    const shownSeries = plotted.series
    columns = plotted.columns
    const xName = xColumnName ?? x_axis_label
    const yName = shownSeries.map((oneSeries) => oneSeries.name || y_axis_label).join(', ')

    const { xMin, xMax, yMin, yMax, count: pointCount } = bounds(columns)
    // scatter charts always show their points
    const markerSize = type === 'scatter' || showPoints ? pointSize : 0
    const markerRadius = (s) => shownSeries[s].marker === 'none' ? 0 : markerSize / 2
    if (!canvas.isConnected) container.append(canvas)
    const legend = measureLegend(ctx, shownSeries, { title, subtitle })

    const [layout, trends] = collectOverflowErrors([
      () => ({ ...computeLayout({ xMin, xMax, yMin, yMax, xColumnName: xName, yColumnName: yName, extraHeight: legend.extraHeight }), legend }),
      () => showTrendLine && type === 'scatter' ? collectOverflowErrors(shownSeries.map((oneSeries, s) => () => {
        const seriesName = oneSeries.name || y_axis_label
        const trend = trendLine(columns.x, columns.ys[s], columns.length, xName, seriesName)
        if (!trend) return null
        const { firstX, lastX } = trend
        const [firstY, lastY] = collectOverflowErrors([
          () => finiteCalculation(trend.slope * firstX + trend.startHeight, seriesName, () => `${xName}=${firstX}`, 'trend line'),
          () => finiteCalculation(trend.slope * lastX + trend.startHeight, seriesName, () => `${xName}=${lastX}`, 'trend line'),
        ])
        return { color: oneSeries.color, firstX, lastX, firstY, lastY }
      })) : [],
    ])
    const { left, right, top, bottom, toX, toY } = layout
    // Overlapping white outlines can hide every series on dense plots.
    const dense = pointCount > right - left
    const maxHitRadius = markerSize / 2 + 0.5 + (dense ? 0 : 1.5)
    const hitTest = (s, i, dx, dy) => {
      if (view.markerRows && !(view.markerRows[s][i >> 3] & (1 << (i & 7)))) return false
      return containsMarker(shownSeries[s].marker, -dx, -dy, markerSize / 2, dense ? 0 : 0.75)
    }
    const isAbove = (s, i, otherSeries, otherIndex) => s < otherSeries || (s === otherSeries && i > otherIndex)
    canvas.setAttribute('aria-label', `${type} plot of ${pointCount} points`)

    view = { columns, layout, markerRadius, maxRadius: markerSize / 2, hitTest: markerSize ? hitTest : undefined, maxHitRadius, isAbove,
      shownSeries, type, x_axis_label, toX, toY, bounds: { left, right, top, bottom }, trends: trends.filter(Boolean),
      labels: { title, subtitle, x_axis_label, y_axis_label }, markerSize, dense }
    drawCanvas()
    return { warnings: legend.warnings }
  }

  function drawCanvas() {
    const cssWidth = container.clientWidth
    if (!cssWidth) return
    const ratio = window.devicePixelRatio || 1
    const width = Math.round(cssWidth * ratio)
    const height = Math.round(cssWidth * view.layout.height / WIDTH * ratio)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = saved.width = width
      canvas.height = saved.height = height
    }
    ctx.setTransform(width / WIDTH, 0, 0, height / view.layout.height, 0, 0)
    ctx.clearRect(0, 0, WIDTH, view.layout.height)
    const { columns, layout, shownSeries, labels, type, trends, markerSize, dense } = view
    drawFrame(ctx, layout, labels)
    drawLegend(ctx, shownSeries, layout)
    drawTrendLines(ctx, trends, layout)
    view.markerRows = drawLines(ctx, columns, shownSeries, layout, { showLines: type === 'line', showPoints: markerSize > 0, pointSize: markerSize, dense })
    const savedCtx = saved.getContext('2d')
    savedCtx.clearRect(0, 0, width, height)
    savedCtx.drawImage(canvas, 0, 0)
    drawHover()
  }

  function drawHover() {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(saved, 0, 0)
    ctx.restore()
    if (!hovered) return
    const { columns, shownSeries, markerSize, dense, x_axis_label, toX, toY, bounds } = view
    const hoveredSeries = shownSeries[hovered.seriesIndex]
    const point = { x: columns.x[hovered.index], y: columns.ys[hovered.seriesIndex][hovered.index] }
    if (markerSize) {
      drawMarker(ctx, hoveredSeries.marker, toX(point.x), toY(point.y), markerSize + HOVER_EXTRA_SIZE, hoveredSeries.color, { outline: !dense })
    }
    drawTooltip(ctx, {
      point,
      name: hoveredSeries.name,
      color: hoveredSeries.color,
      marker: hoveredSeries.marker,
      xLabel: x_axis_label,
      toX,
      toY,
      gap: TOOLTIP_GAP,
      bounds,
    })
  }

  function pointerMove(event) {
    if (!view) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const px = (event.clientX - rect.left) * WIDTH / rect.width
    const py = (event.clientY - rect.top) * view.layout.height / rect.height
    const nearest = findNearest(view.columns, view.layout, px, py, HOVER_DISTANCE, {
      radiusAt: view.markerRadius, maxRadius: view.maxRadius,
      hitTest: view.hitTest, maxHitRadius: view.maxHitRadius, isAbove: view.isAbove,
    })
    setHovered(nearest)
  }

  function pointerLeave() {
    setHovered(null)
  }

  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerleave', pointerLeave)

  function setHovered(next) {
    const sameAsBefore = next && hovered &&
      next.seriesIndex === hovered.seriesIndex && next.index === hovered.index
    if (sameAsBefore || next === hovered) return
    hovered = next
    drawHover()
  }

  function destroy() {
    canvas.removeEventListener('pointermove', pointerMove)
    canvas.removeEventListener('pointerleave', pointerLeave)
    canvas.remove()
    resizeObserver.disconnect()
    hovered = null
    view = null
  }

  if (options) {
    update(options)
  }

  return { update, destroy }
}
