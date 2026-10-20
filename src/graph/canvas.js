import { WIDTH, HEIGHT, MARGIN, PADDING, TEXT_SIZE, TITLE_TEXT_SIZE, TICK_SIZE } from './scale.js'
import { legendEntries, LABEL_BASELINE_OFFSET, LABEL_PADDING } from './Legend.js'
import { DEFAULT_COLOR, THEME } from './theme.js'

const MARKER_BATCH = 256
const LINE_BATCH = 64

export function formatTicks(ticks) {
  const distinctValues = new Set(ticks).size
  for (let precision = 3; precision <= 17; precision++) {
    const labels = ticks.map((value) => {
      if (value === 0) return '0'
      if (Math.abs(value) < 0.001 || Math.abs(value) >= 1e6) {
        const [mantissa, exponent] = value.toExponential(precision - 1).split('e')
        return `${Number(mantissa)}e${exponent}`
      }
      return String(Number(value.toPrecision(precision)))
    })
    if (new Set(labels).size === distinctValues || precision === 17) return labels
  }
}

function setFont(ctx, size, weight = 400) {
  const family = ctx.canvas?.isConnected ? getComputedStyle(ctx.canvas).fontFamily : 'sans-serif'
  ctx.font = `${weight} ${size}px ${family}`
}

function text(ctx, value, x, y, { size, weight, color, align = 'left' } = THEME.label) {
  setFont(ctx, size, weight)
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(String(value), x, y)
}

function line(ctx, x1, y1, x2, y2, color) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.stroke()
}

export function drawFrame(ctx, layout, { title, subtitle, x_axis_label, y_axis_label }) {
  const { left, right, top, bottom, toX, toY, xTicks, yTicks, xGridlines, yGridlines } = layout
  const xLabels = formatTicks(xTicks)
  const yLabels = formatTicks(yTicks)
  ctx.save()
  if ('letterSpacing' in ctx) ctx.letterSpacing = '-0.16px'
  text(ctx, title, 0, TITLE_TEXT_SIZE, THEME.title)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  text(ctx, subtitle, 0, TITLE_TEXT_SIZE + TEXT_SIZE + PADDING, THEME.subtitle)

  line(ctx, left, bottom, right, bottom, THEME.axis)
  line(ctx, left, top, left, bottom, THEME.axis)
  for (const v of xGridlines) line(ctx, toX(v), top, toX(v), bottom + TICK_SIZE, THEME.gridline)
  for (const v of yGridlines) line(ctx, left - TICK_SIZE, toY(v), right, toY(v), THEME.gridline)
  for (const [i, v] of xTicks.entries()) {
    line(ctx, toX(v), bottom, toX(v), bottom + TICK_SIZE, THEME.axis)
    text(ctx, xLabels[i], toX(v), bottom + TEXT_SIZE + PADDING + TICK_SIZE, { ...THEME.label, align: 'center' })
  }
  for (const [i, v] of yTicks.entries()) {
    line(ctx, left - TICK_SIZE, toY(v), left, toY(v), THEME.axis)
    text(ctx, yLabels[i], left - TICK_SIZE - PADDING, toY(v) + 4, { ...THEME.label, align: 'right' })
  }

  text(ctx, x_axis_label, (left + right) / 2, layout.height ?? HEIGHT, { ...THEME.label, align: 'center' })
  ctx.translate(TEXT_SIZE, (top + bottom) / 2)
  ctx.rotate(-Math.PI / 2)
  text(ctx, y_axis_label, 0, 0, { ...THEME.label, align: 'center' })
  ctx.restore()
}

export function measureLegend(ctx, series, labels = {}) {
  setFont(ctx, THEME.title.size, THEME.title.weight)
  const titleWidth = ctx.measureText(labels.title || '').width
  setFont(ctx, THEME.subtitle.size, THEME.subtitle.weight)
  const subtitleWidth = ctx.measureText(labels.subtitle || '').width
  setFont(ctx, THEME.label.size, THEME.label.weight)
  return legendEntries({ series, left: MARGIN.left, right: WIDTH - MARGIN.right,
    headerRight: Math.max(MARGIN.left, Math.max(titleWidth, subtitleWidth) + 10),
    measureText: label => ctx.measureText(label).width })
}

export function drawLegend(ctx, series, layout) {
  const legend = layout.legend ?? measureLegend(ctx, series)
  for (const { r, label, color, shape, x, y } of legend.entries) {
    drawDot(ctx, shape, x + r, y, r, color)
    text(ctx, label, x + 2 * r + LABEL_PADDING, y + LABEL_BASELINE_OFFSET)
  }
  return legend
}

export const dashPattern = (dash) => dash ? String(dash).trim().split(/[\s,]+/).map(Number) : []

function pixelMap(min, max, from, to) {
  if (min === max) return () => (from + to) / 2
  const span = max - min
  const range = to - from
  const perUnit = range / span
  // tiny ranges can make perUnit infinite, so divide before multiplying
  if (!Number.isFinite(perUnit)) return (value) => from + ((value - min) / span) * range
  return (value) => from + (value - min) * perUnit
}

// keep the first, min, max and last point in each pixel column
// +Infinity breaks the line, -Infinity skips a point
function strokeLine(ctx, columns, ys, toX, toY, scale) {
  let pixel = NaN
  let moving = true
  let first = -1
  let low, high, last
  let lines = 0
  let length = 0
  let lastX, lastY, previousX, previousY, previousLength
  function to(i, move) {
    const x = toX(columns.x[i])
    const y = toY(ys[i])
    if (move) {
      if (lines) stroke()
      length = 0
      ctx.lineDashOffset = 0
      ctx.moveTo(x, y)
    } else {
      if (lines === LINE_BATCH) {
        stroke()
        // start one segment back to keep the join, with the same dash position
        ctx.lineDashOffset = previousLength
        ctx.moveTo(previousX, previousY)
        ctx.lineTo(lastX, lastY)
      }
      previousX = lastX
      previousY = lastY
      previousLength = length
      length += Math.hypot(x - lastX, y - lastY)
      ctx.lineTo(x, y)
      lines++
    }
    lastX = x
    lastY = y
  }
  function stroke() {
    ctx.stroke()
    ctx.beginPath()
    lines = 0
  }
  function flush() {
    if (first < 0) return
    to(first, moving)
    moving = false
    for (const i of low < high ? [low, high] : [high, low]) {
      if (i !== first && i !== last) to(i)
    }
    if (last !== first) to(last)
    first = -1
  }
  ctx.beginPath()
  for (let i = 0; i < columns.length; i++) {
    const y = ys[i]
    if (y === -Infinity) continue
    if (!Number.isFinite(y)) {
      flush()
      moving = true
      continue
    }
    const nextPixel = Math.round(toX(columns.x[i]) * scale)
    if (first < 0 || nextPixel !== pixel) {
      flush()
      pixel = nextPixel
      first = low = high = last = i
    } else {
      if (y < ys[low]) low = i
      if (y > ys[high]) high = i
      last = i
    }
  }
  flush()
  if (lines) stroke()
}

export function drawLines(ctx, columns, series, layout, { showLines = true, showPoints = true, pointSize = 7, dense = false } = {}) {
  const toX = pixelMap(layout.xMin, layout.xMax, layout.left, layout.right)
  const toY = pixelMap(layout.yMin, layout.yMax, layout.bottom, layout.top)
  const scale = ctx.getTransform?.().a ?? 1
  const markerRows = showPoints && dense ? series.map(() => new Uint8Array(Math.ceil(columns.length / 8))) : null

  for (let seriesIndex = series.length - 1; seriesIndex >= 0; seriesIndex--) {
    const oneSeries = series[seriesIndex]
    const color = oneSeries.color || DEFAULT_COLOR
    const ys = columns.ys[seriesIndex]
    if (showLines) {
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineJoin = 'bevel'
      ctx.setLineDash(dashPattern(oneSeries.dash))
      strokeLine(ctx, columns, ys, toX, toY, scale)
      ctx.restore()
    }

    if (!showPoints) continue
    if (dense) {
      const width = Math.ceil(WIDTH * scale) + 1
      const drawn = new Uint8Array(width * (Math.ceil((layout.height ?? HEIGHT) * scale) + 1))
      ctx.fillStyle = color
      ctx.beginPath()
      let count = 0
      for (let i = 0; i < columns.length; i++) {
        if (!Number.isFinite(ys[i])) continue
        const x = toX(columns.x[i])
        const y = toY(ys[i])
        const pixel = Math.round(x * scale) + Math.round(y * scale) * width
        if (drawn[pixel]) continue
        drawn[pixel] = 1
        markerRows[seriesIndex][i >> 3] |= 1 << (i & 7)
        markerPath(ctx, oneSeries.marker, x, y, pointSize)
        // small batches are faster than one big path of overlapping markers
        if (++count % MARKER_BATCH === 0) {
          ctx.fill()
          ctx.beginPath()
        }
      }
      ctx.fill()
    } else {
      for (let i = 0; i < columns.length; i++) {
        if (Number.isFinite(ys[i])) drawMarker(ctx, oneSeries.marker, toX(columns.x[i]), toY(ys[i]), pointSize, color)
      }
    }
  }
  return markerRows
}

// trends are [{ color, firstX, firstY, lastX, lastY }]
export function drawTrendLines(ctx, trends, layout) {
  const { left, right, top, bottom, toX, toY } = layout
  ctx.save()
  try {
    ctx.beginPath()
    ctx.rect(left, top, right - left, bottom - top)
    ctx.clip()
    ctx.globalAlpha = 0.5
    ctx.setLineDash([4, 3])
    for (const { color, firstX, firstY, lastX, lastY } of trends) {
      line(ctx, toX(firstX), toY(firstY), toX(lastX), toY(lastY), color || DEFAULT_COLOR)
    }
  } finally {
    ctx.restore()
  }
}

function markerPath(ctx, shape, x, y, size) {
  const r = size / 2
  if (shape === 'square') {
    ctx.moveTo(x - r + 1, y - r)
    ctx.arcTo(x + r, y - r, x + r, y + r, 1)
    ctx.arcTo(x + r, y + r, x - r, y + r, 1)
    ctx.arcTo(x - r, y + r, x - r, y - r, 1)
    ctx.arcTo(x - r, y - r, x + r, y - r, 1)
    ctx.closePath()
  } else if (shape === 'triangle') {
    const h = size * 1.1
    ctx.moveTo(x, y - h / 2 - 0.5)
    ctx.lineTo(x + r + 0.5, y + h / 2)
    ctx.lineTo(x - r - 0.5, y + h / 2)
    ctx.closePath()
  } else {
    ctx.moveTo(x + r, y)
    ctx.arc(x, y, r, 0, 2 * Math.PI)
  }
}

export function drawMarker(ctx, shape, x, y, size, color, { outline = true } = {}) {
  ctx.beginPath()
  markerPath(ctx, shape, x, y, size)
  ctx.fillStyle = color || DEFAULT_COLOR
  ctx.fill()
  if (!outline) return
  ctx.strokeStyle = THEME.outline
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawDot(ctx, shape, x, y, r, color) {
  ctx.beginPath()
  if (shape === 'square') {
    ctx.rect(x - r, y - r, 2 * r, 2 * r)
  } else if (shape === 'triangle') {
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r, y + r)
    ctx.lineTo(x - r, y + r)
    ctx.closePath()
  } else {
    ctx.arc(x, y, r, 0, 2 * Math.PI)
  }
  ctx.fillStyle = color || DEFAULT_COLOR
  ctx.fill()
  ctx.strokeStyle = THEME.outline
  ctx.lineWidth = 1
  ctx.stroke()
}

export function drawTooltip(ctx, { point, name, color, marker, xLabel = 'X', toX, toY, gap, bounds }) {
  const { background, border, text: textColor, muted } = THEME.tooltip
  const padding = 7
  const charWidth = 4.5
  const markerSpace = 12
  const boxHeight = 34
  const maxWidth = bounds.right - bounds.left
  const value = String(point.y)
  const shorten = (label, available) => {
    const count = Math.max(1, Math.floor(available / charWidth))
    return label.length > count ? label.slice(0, count - 1) + '…' : label
  }
  const xName = shorten(xLabel, maxWidth - 2 * padding - (String(point.x).length + 2) * charWidth)
  const seriesName = shorten(name || 'Value', maxWidth - 2 * padding - markerSpace - (value.length + 2) * charWidth)
  const xText = `${xName}: ${point.x}`
  const seriesText = `${seriesName}: `
  const boxWidth = Math.min(maxWidth, Math.max(xText.length * charWidth, markerSpace + (seriesText + value).length * charWidth) + 2 * padding)
  const pointX = toX(point.x)
  const pointY = toY(point.y)
  const rightX = pointX + gap
  const preferredX = rightX + boxWidth <= bounds.right ? rightX : pointX - gap - boxWidth
  const boxX = Math.max(bounds.left, Math.min(preferredX, bounds.right - boxWidth))
  const aboveY = pointY - gap - boxHeight
  const preferredY = aboveY >= bounds.top ? aboveY : pointY + gap
  const boxY = Math.max(bounds.top, Math.min(preferredY, bounds.bottom - boxHeight))

  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 3)
  ctx.fillStyle = background
  ctx.fill()
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.stroke()
  text(ctx, xText, boxX + padding, boxY + 13, { size: 7.5, color: muted })
  drawDot(ctx, marker, boxX + padding + 3, boxY + 25, 3, color)
  text(ctx, seriesText, boxX + padding + markerSpace, boxY + 28, { size: THEME.label.size, color: textColor })
  const valueX = boxX + padding + markerSpace + ctx.measureText(seriesText).width
  text(ctx, value, valueX, boxY + 28, { size: THEME.label.size, weight: 600, color: textColor })
}
