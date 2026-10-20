import { el } from './svg.js'
import { WIDTH, HEIGHT, PADDING, TEXT_SIZE, TITLE_TEXT_SIZE, TICK_SIZE, computeLayout, findNearest, trendLine, minMax } from './scale.js'
import legend from './Legend.js'
import { marker } from './Marker.js'
import lineGraph from './LineGraph.js'
import tooltip from './Tooltip.js'
import { withSeriesColors } from './colors.js'
import { collectOverflowErrors, finiteCalculation } from '../numericErrors.js'
import './Graph.css'

const DEFAULT_LABELS = {
  title: 'Your Title',
  subtitle: 'Your Subtitle',
  x_axis_label: 'Your X Axis Label',
  y_axis_label: 'Your Y Axis Label',
}


const MIN_RADIUS = 3
const MAX_RADIUS = 100
const HOVER_DISTANCE = 10
const HOVER_EXTRA_RADIUS = 1.5

const round = (v) => Math.abs(v) >= 1e21 ? v : Math.round(v * 10) / 10

let nextChartId = 0

// Draws `points` ([{ x, y }, ...]) as a scatter or line plot.
// for more than one series pass series = [{ name, color, dash, marker, points }]
// Returns { update(options), destroy() }.
export function createChart(container, options) {
  const chartId = nextChartId++
  const plotAreaId = `plot-area-${chartId}`
  const gradientId = `line-fill-${chartId}`

  const svg = el('svg', { class: 'graph', viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img' })
  const sizeWarning = document.createElement('p')
  sizeWarning.className = 'graph-size-warning'
  sizeWarning.setAttribute('role', 'status')
  sizeWarning.hidden = true
  container.append(sizeWarning, svg)

  let view = null
  // the hovered point, as { seriesNumber, pointNumber }
  let hovered = null

  function update({ points, series, columns, xColumnName, type = 'scatter', labels = {}, showTrendLine = false, showPoints = true, pointSize = 7, colors = {} }) {
    hovered = null

    const { title, subtitle, x_axis_label, y_axis_label } = { ...DEFAULT_LABELS, ...labels }

    // a plain list of points counts as one series
    let allSeries = series
    if (!allSeries) {
      allSeries = [{ name: labels.legend, points }]
    }

    const shownSeries = withSeriesColors(allSeries)
    // TODO: Remove point-object fallback on Canvas migration.
    let hoverPoints
    if (!columns) {
      hoverPoints = []
      shownSeries.forEach((oneSeries, seriesNumber) => {
        oneSeries.points.forEach((point, pointNumber) => {
          if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
            hoverPoints.push({ ...point, seriesNumber, pointNumber })
          }
        })
      })
      hoverPoints.sort((a, b) => a.x - b.x)
      columns = { length: hoverPoints.length, x: hoverPoints.map((point) => point.x), ys: [hoverPoints.map((point) => point.y)] }
    }
    const xName = xColumnName ?? x_axis_label
    const yName = shownSeries.map((oneSeries) => oneSeries.name || y_axis_label).join(', ')

    const shownPoints = []
    for (const oneSeries of shownSeries) {
      for (const point of oneSeries.points) {
        if (Number.isFinite(point.y)) shownPoints.push(point)
      }
    }

    const xs = shownPoints.map((p) => p.x)
    const ys = shownPoints.map((p) => p.y)
    const { min: xMin, max: xMax } = minMax(xs)
    const { min: yMin, max: yMax } = minMax(ys)

    const sizes = shownPoints.map((p) => p.z).filter((size) => Number.isFinite(size) && size > 0)
    const { min: sizeMin } = minMax(sizes)

    const requestedRadius = (size) => {
      if (!Number.isFinite(size) || size <= 0) return MIN_RADIUS
      return MIN_RADIUS * (Math.sqrt(size) / Math.sqrt(sizeMin))
    }
    const toRadius = (size) => Math.min(MAX_RADIUS, requestedRadius(size))
    const oversizedCount = type === 'scatter' ? sizes.filter((size) => requestedRadius(size) > MAX_RADIUS).length : 0
    const nonpositiveCount = type === 'scatter' ? shownPoints.filter((point) => Number.isFinite(point.z) && point.z <= 0).length : 0
    const nonfiniteCount = type === 'scatter' ? shownPoints.filter((point) => typeof point.z === 'number' && !Number.isFinite(point.z)).length : 0
    const sizeWarnings = []
    if (nonpositiveCount) sizeWarnings.push(`${nonpositiveCount} ${nonpositiveCount === 1 ? 'bubble has a zero or negative size' : 'bubbles have zero or negative sizes'}, clamped to minimum size`)
    if (nonfiniteCount) sizeWarnings.push(`${nonfiniteCount} ${nonfiniteCount === 1 ? 'bubble has a NaN or infinite size' : 'bubbles have NaN or infinite sizes'}, clamped to minimum size`)
    if (oversizedCount) sizeWarnings.push(`${oversizedCount} ${oversizedCount === 1 ? 'bubble exceeds' : 'bubbles exceed'} the maximum display size, clamped to maximum size`)
    const markerRadius = (seriesIndex, index) => {
      const point = hoverPoints?.[index] ?? shownSeries[seriesIndex].points[index]
      return type === 'line' ? (showPoints ? pointSize / 2 : 0) : toRadius(point.z)
    }
    const maxRadius = type === 'line' ? (showPoints ? pointSize / 2 : 0) : toRadius(minMax(sizes).max)

    const [layout, trends] = collectOverflowErrors([
      () => computeLayout({ xMin, xMax, yMin, yMax, xColumnName: xName, yColumnName: yName }),
      () => showTrendLine && type === 'scatter' ? collectOverflowErrors(shownSeries.map((oneSeries) => () => {
        const seriesName = oneSeries.name || y_axis_label
        const finitePoints = oneSeries.points.filter((point) => Number.isFinite(point.y))
        const trend = trendLine(finitePoints, xName, seriesName)
        if (!trend) return null
        const { min: firstX, max: lastX } = minMax(finitePoints.map((point) => point.x))
        const [firstY, lastY] = collectOverflowErrors([
          () => finiteCalculation(trend.slope * firstX + trend.startHeight, seriesName, () => `${xName}=${firstX}`, 'trend line'),
          () => finiteCalculation(trend.slope * lastX + trend.startHeight, seriesName, () => `${xName}=${lastX}`, 'trend line'),
        ])
        return { oneSeries, firstX, lastX, firstY, lastY }
      })) : [],
    ])
    const { left, right, top, bottom, toX, toY, xTicks, yTicks, xGridlines, yGridlines } = layout

    // Overlapping white outlines can hide every series on dense plots.
    svg.classList.toggle('dense', shownPoints.length > right - left)

    svg.setAttribute('aria-label', `${type} plot of ${shownPoints.length} points`)

    const children = [
      // HEADER
      el('text', { class: 'title', x: 0, y: TITLE_TEXT_SIZE, 'text-anchor': 'left', text: title }),
      el('text', { class: 'subtitle', x: 0, y: TITLE_TEXT_SIZE + TEXT_SIZE + PADDING, 'text-anchor': 'left', text: subtitle }),

      // LEGEND
      legend({ sizes, series: shownSeries, toRadius, right }),

      // AXES
      el('line', { class: 'axis', x1: left, y1: bottom, x2: right, y2: bottom }),
      el('line', { class: 'axis', x1: left, y1: top, x2: left, y2: bottom }),

      // GRIDLINES
      ...xGridlines.map((v) =>
        el('g', {}, [el('line', { class: 'gridline', x1: toX(v), y1: top, x2: toX(v), y2: bottom + TICK_SIZE })])
      ),
      ...yGridlines.map((v) =>
        el('g', {}, [el('line', { class: 'gridline', x1: left - TICK_SIZE, y1: toY(v), x2: right, y2: toY(v) })])
      ),

      // TICKS
      ...xTicks.map((v) =>
        el('g', {}, [
          el('line', { class: 'ticks', x1: toX(v), y1: bottom, x2: toX(v), y2: bottom + TICK_SIZE }),
          el('text', { class: 'label', x: toX(v), y: bottom + TEXT_SIZE + PADDING + TICK_SIZE, 'text-anchor': 'middle', text: round(v) }),
        ])
      ),
      ...yTicks.map((v) =>
        el('g', {}, [
          el('line', { class: 'ticks', x1: left - TICK_SIZE, y1: toY(v), x2: left, y2: toY(v) }),
          el('text', { class: 'label', x: left - TICK_SIZE - PADDING, y: toY(v) + 4, 'text-anchor': 'end', text: round(v) }),
        ])
      ),

      // AXES LABELS
      el('text', { class: 'label', x: (left + right) / 2, y: HEIGHT, 'text-anchor': 'middle', text: x_axis_label }),
      el('text', {
        class: 'label',
        transform: `translate(${TEXT_SIZE}, ${(top + bottom) / 2}) rotate(-90)`,
        'text-anchor': 'middle',
        text: y_axis_label,
      }),

      // TREND LINES, clipped so they dont poke out of the plot
      el('defs', {}, [
        el('clipPath', { id: plotAreaId }, [
          el('rect', { x: left, y: top, width: right - left, height: bottom - top }),
        ]),
      ]),
    ]

    for (const trend of trends) {
      if (trend) {
        const { oneSeries, firstX, lastX, firstY, lastY } = trend
        children.push(el('line', {
          class: 'trend',
          'clip-path': `url(#${plotAreaId})`,
          style: { stroke: oneSeries.color },
          x1: toX(firstX),
          y1: toY(firstY),
          x2: toX(lastX),
          y2: toY(lastY),
        }))
      }
    }

    // POINTS
    // hovering only redraws the markers that changed
    let markers
    if (type === 'line') {
      const drawn = lineGraph({
        series: shownSeries,
        xPos: toX,
        yPos: toY,
        showPoints,
        pointSize,
        clipPathId: plotAreaId,
        gradientId,
        top,
        bottom,
      })
      markers = drawn.markers
      children.push(drawn.group)
    } else {
      markers = new Map()
      shownSeries.forEach((oneSeries, seriesNumber) => {
        oneSeries.points.forEach((point, pointNumber) => {
          if (!Number.isFinite(point.y)) return
          const make = (isHovered) => {
            let radius = toRadius(point.z)
            if (isHovered) {
              radius += HOVER_EXTRA_RADIUS
            }
            return marker({ shape: oneSeries.marker, color: oneSeries.color, cx: toX(point.x), cy: toY(point.y), r: radius })
          }
          const element = make(false)
          markers.set(`${seriesNumber}-${pointNumber}`, { element, make })
          children.push(element)
        })
      })
    }

    // TOOLTIP
    const tooltipLayer = el('g')
    children.push(tooltipLayer)

    // spreading every element into one call overflows the call stack on large data
    const fragment = document.createDocumentFragment()
    for (const child of children) {
      fragment.append(child)
    }
    svg.replaceChildren(fragment)
    sizeWarning.hidden = sizeWarnings.length === 0
    sizeWarning.textContent = sizeWarnings.join(' ')
    view = { columns, layout, hoverPoints, markerRadius, maxRadius, shownSeries, type, x_axis_label, toX, toY, toRadius, bounds: { left, right, top, bottom }, markers, tooltipLayer, colors }
  }

  function pointerMove(event) {
    if (!view) return
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const px = (event.clientX - rect.left) * WIDTH / rect.width
    const py = (event.clientY - rect.top) * HEIGHT / rect.height
    const nearest = findNearest(view.columns, view.layout, px, py, HOVER_DISTANCE, {
      radiusAt: view.markerRadius, maxRadius: view.maxRadius,
    })
    if (!nearest) return setHovered(null)
    const { seriesNumber, pointNumber } = view.hoverPoints?.[nearest.index] ?? {
      seriesNumber: nearest.seriesIndex, pointNumber: nearest.index,
    }
    setHovered({ seriesNumber, pointNumber })
  }

  function pointerLeave() {
    setHovered(null)
  }

  svg.addEventListener('pointermove', pointerMove)
  svg.addEventListener('pointerleave', pointerLeave)

  function setHovered(next) {
    const sameAsBefore = next && hovered &&
      next.seriesNumber === hovered.seriesNumber && next.pointNumber === hovered.pointNumber
    if (sameAsBefore || next === hovered) return

    redrawMarker(hovered, false)
    hovered = next
    redrawMarker(hovered, true)
    drawTooltip()
  }

  function redrawMarker(point, isHovered) {
    if (!point) return
    const drawn = view.markers.get(`${point.seriesNumber}-${point.pointNumber}`)
    if (!drawn) return
    const element = drawn.make(isHovered)
    drawn.element.replaceWith(element)
    drawn.element = element
  }

  function drawTooltip() {
    const { shownSeries, type, x_axis_label, toX, toY, toRadius, bounds, tooltipLayer, colors } = view

    // only show the series name when theres more than one
    let hoveredPoint = null
    let hoveredName
    let hoveredStyle
    if (hovered && shownSeries[hovered.seriesNumber]) {
      const hoveredSeries = shownSeries[hovered.seriesNumber]
      hoveredPoint = hoveredSeries.points[hovered.pointNumber]
      hoveredStyle = hoveredSeries
      if (shownSeries.length > 1) {
        hoveredName = hoveredSeries.name
      }
    }

    const box = tooltip({
      point: hoveredPoint,
      name: type === 'line' ? hoveredStyle?.name : hoveredName,
      color: hoveredStyle?.color,
      marker: hoveredStyle?.marker,
      xLabel: x_axis_label,
      type,
      showHoverMarker: false,
      toX,
      toY,
      toRadius,
      bounds,
      colors,
    })
    tooltipLayer.replaceChildren(...(box ? [box] : []))
  }

  function destroy() {
    svg.removeEventListener('pointermove', pointerMove)
    svg.removeEventListener('pointerleave', pointerLeave)
    svg.remove()
    sizeWarning.remove()
    hovered = null
    view = null
  }

  if (options) {
    update(options)
  }

  return { update, destroy }
}
