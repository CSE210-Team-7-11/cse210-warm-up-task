import { el } from './svg.js'
import { scale, ticks, gridlines, trendLine, minMax } from './scale.js'
import legend from './Legend.js'
import { marker } from './Marker.js'
import lineGraph from './LineGraph.js'
import tooltip from './Tooltip.js'
import { withSeriesColors } from './colors.js'
import './Graph.css'

const DEFAULT_LABELS = {
  title: 'Your Title',
  subtitle: 'Your Subtitle',
  x_axis_label: 'Your X Axis Label',
  y_axis_label: 'Your Y Axis Label',
}

const WIDTH = 500
const HEIGHT = 300
const MARGIN = { top: 40, right: 5, bottom: 35, left: 45 }
const PADDING = 5
const TEXT_SIZE = 10
const TITLE_TEXT_SIZE = 15
const TICK_SIZE = 5
const MIN_RADIUS = 3
const MAX_RADIUS = 100
const MIN_HOVER_TARGET_RADIUS = 10
const HOVER_EXTRA_RADIUS = 1.5

const round = (v) => Math.round(v * 10) / 10

let nextChartId = 0

// Draws `points` ([{ x, y }, ...]) as a scatter or line plot.
// for more than one series pass series = [{ name, color, dash, marker, points }]
// Returns { update(options), destroy() }.
export function createChart(container, options) {
  const chartId = nextChartId++
  const plotAreaId = `plot-area-${chartId}`
  const gradientId = `line-fill-${chartId}`

  const svg = el('svg', { class: 'graph', viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img' })
  container.append(svg)

  let view = null
  // the hovered point, as { seriesNumber, pointNumber }
  let hovered = null

  function update({ points, series, type = 'scatter', labels = {}, showTrendLine = false, showPoints = true, pointSize = 7, colors = {} }) {
    hovered = null

    const { title, subtitle, x_axis_label, y_axis_label } = { ...DEFAULT_LABELS, ...labels }

    // a plain list of points counts as one series
    let allSeries = series
    if (!allSeries) {
      allSeries = [{ name: labels.legend, points }]
    }

    const shownSeries = withSeriesColors(allSeries)

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

    const sizes = shownPoints.map((p) => p.z).filter(Number.isFinite)
    const { min: sizeMin } = minMax(sizes)

    const toRadius = (size) => {
      if (!Number.isFinite(size) || size <= 0) return MIN_RADIUS
      const r = MIN_RADIUS * Math.sqrt(size / sizeMin)
      return Math.min(MAX_RADIUS, r)
    }

    const left = MARGIN.left
    const right = WIDTH - MARGIN.right
    const top = MARGIN.top
    const bottom = HEIGHT - MARGIN.bottom

    // Overlapping white outlines can hide every series on dense plots.
    svg.classList.toggle('dense', shownPoints.length > right - left)

    const toX = scale(xMin, xMax, left, right)
    // SVG's y-axis points down, so larger values map to smaller pixel positions.
    const toY = scale(yMin, yMax, bottom, top)

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
      ...gridlines(xMin, xMax).map((v) =>
        el('g', {}, [el('line', { class: 'gridline', x1: toX(v), y1: top, x2: toX(v), y2: bottom + TICK_SIZE })])
      ),
      ...gridlines(yMin, yMax).map((v) =>
        el('g', {}, [el('line', { class: 'gridline', x1: left - TICK_SIZE, y1: toY(v), x2: right, y2: toY(v) })])
      ),

      // TICKS
      ...ticks(xMin, xMax).map((v) =>
        el('g', {}, [
          el('line', { class: 'ticks', x1: toX(v), y1: bottom, x2: toX(v), y2: bottom + TICK_SIZE }),
          el('text', { class: 'label', x: toX(v), y: bottom + TEXT_SIZE + PADDING + TICK_SIZE, 'text-anchor': 'middle', text: round(v) }),
        ])
      ),
      ...ticks(yMin, yMax).map((v) =>
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

    if (showTrendLine && type === 'scatter') {
      for (const oneSeries of shownSeries) {
        const trend = trendLine(oneSeries.points)
        if (!trend) continue
        const { min: firstX, max: lastX } = minMax(oneSeries.points.map((point) => point.x))
        children.push(el('line', {
          class: 'trend',
          'clip-path': `url(#${plotAreaId})`,
          style: { stroke: oneSeries.color },
          x1: toX(firstX),
          y1: toY(trend.slope * firstX + trend.startHeight),
          x2: toX(lastX),
          y2: toY(trend.slope * lastX + trend.startHeight),
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

    // HOVER TARGETS + TOOLTIP
    shownSeries.forEach((oneSeries, seriesNumber) => {
      oneSeries.points.forEach((point, pointNumber) => {
        if (!Number.isFinite(point.y)) return
        const target = el('circle', {
          class: 'hit',
          cx: toX(point.x),
          cy: toY(point.y),
          r: Math.max(toRadius(point.z), MIN_HOVER_TARGET_RADIUS),
        })
        target.addEventListener('mouseenter', () => setHovered({ seriesNumber, pointNumber }))
        target.addEventListener('mouseleave', () => setHovered(null))
        children.push(target)
      })
    })
    const tooltipLayer = el('g')
    children.push(tooltipLayer)

    // spreading every element into one call overflows the call stack on large data
    const fragment = document.createDocumentFragment()
    for (const child of children) {
      fragment.append(child)
    }
    svg.replaceChildren(fragment)
    view = { shownSeries, type, x_axis_label, toX, toY, toRadius, bounds: { left, right, top, bottom }, markers, tooltipLayer, colors }
  }

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
    svg.remove()
    view = null
  }

  if (options) {
    update(options)
  }

  return { update, destroy }
}
