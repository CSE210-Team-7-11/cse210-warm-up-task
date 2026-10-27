// @ts-check

/**
 * Canvas drawing primitives, dense-series reduction, and chart annotations.
 * Coordinates and sizes are logical chart units unless noted otherwise. Most
 * helpers change the context's drawing state, which the controller prepares per draw.
 * @module graph/canvas
 */
import { WIDTH, HEIGHT, MARGIN, PADDING, TEXT_SIZE, TITLE_TEXT_SIZE, TICK_SIZE } from './scale.js'
import { legendEntries, LABEL_BASELINE_OFFSET, LABEL_PADDING } from './Legend.js'
import { DEFAULT_COLOR, THEME } from './theme.js'

const MARKER_BATCH = 256
const LINE_BATCH = 64

/**
 * Format axis values as compact labels while keeping distinct values distinguishable.
 * Round away floating-point noise when fewer digits suffice, but retain enough
 * precision to separate nearby ticks. Nonzero magnitudes below 0.001 or at least
 * 1e6 use exponential notation.
 * @param {Array<number>} ticks Finite numeric tick values in display order.
 * @returns {Array<string>} Labels in the same order, with redundant zeros removed.
 * @example
 * formatTicks([1.0001, 1.0002]) // ['1.0001', '1.0002']
 */
export function formatTicks(ticks) {
	const distinctValues = new Set(ticks).size
	/* Try a shared precision for the axis, increasing it only when distinct ticks
	 * round to the same text. Compare distinct-value counts because a constant or
	 * extremely narrow domain can already contain duplicate numeric ticks. */
	for (let precision = 3; precision <= 17; precision++) {
		const labels = ticks.map((value) => {
			if (value === 0) {
				return '0'
			}
			if (Math.abs(value) < 0.001 || Math.abs(value) >= 1e6) {
				const [mantissa, exponent] = value.toExponential(precision - 1).split('e')
				return `${Number(mantissa)}e${exponent}`
			}
			return String(Number(value.toPrecision(precision)))
		})
		if (new Set(labels).size === distinctValues || precision === 17) {
			return labels
		}
	}
}

/**
 * Set the drawing font to the supplied size and weight with the canvas's CSS
 * family. Detached canvases use sans-serif.
 * @param {CanvasRenderingContext2D} ctx Target context.
 * @param {number} size Font size in logical chart units.
 * @param {number} [weight=400] CSS numeric font weight.
 */
function setFont(ctx, size, weight = 400) {
	const family = ctx.canvas?.isConnected ? getComputedStyle(ctx.canvas).fontFamily : 'sans-serif'
	ctx.font = `${weight} ${size}px ${family}`
}

/**
 * Draw text at an alphabetic baseline anchor using the supplied style.
 * @param {CanvasRenderingContext2D} ctx Target context.
 * @param {string|number} value Text or value converted with String.
 * @param {number} x Baseline anchor X.
 * @param {number} y Baseline Y.
 * @param {ChartTextStyle} [style] Text style, defaulting to THEME.label when omitted.
 */
function text(ctx, value, x, y, { size, weight, color, align = 'left' } = THEME.label) {
	setFont(ctx, size, weight)
	ctx.fillStyle = color
	ctx.textAlign = align
	ctx.textBaseline = 'alphabetic'
	ctx.fillText(String(value), x, y)
}

/**
 * Draw a one-unit-wide line segment using the current dash and opacity.
 * @param {CanvasRenderingContext2D} ctx Target context.
 * @param {number} x1 Start X.
 * @param {number} y1 Start Y.
 * @param {number} x2 End X.
 * @param {number} y2 End Y.
 * @param {string} color Stroke color.
 */
function line(ctx, x1, y1, x2, y2, color) {
	ctx.beginPath()
	ctx.moveTo(x1, y1)
	ctx.lineTo(x2, y2)
	ctx.strokeStyle = color
	ctx.lineWidth = 1
	ctx.stroke()
}

/**
 * Draw the title, subtitle, axes, tick labels, and gridlines. Axis labels appear
 * outside the plot bounds. An empty string omits a label.
 * @param {CanvasRenderingContext2D} ctx Context scaled to logical chart coordinates.
 * @param {ChartLayout} layout Domain, plot edges, ticks, and coordinate mappings.
 * @param {ChartLabels} labels Resolved text. Use empty strings to omit individual labels.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when an axis value projects to a non-finite drawing coordinate.
 */
export function drawFrame(ctx, layout, { title, subtitle, x_axis_label, y_axis_label }) {
	const { left, right, top, bottom, toX, toY, xTicks, yTicks, xGridlines, yGridlines } = layout
	const xLabels = formatTicks(xTicks)
	const yLabels = formatTicks(yTicks)
	ctx.save()
	if ('letterSpacing' in ctx) {
		ctx.letterSpacing = '-0.16px'
	}
	text(ctx, title, 0, TITLE_TEXT_SIZE, THEME.title)
	if ('letterSpacing' in ctx) {
		ctx.letterSpacing = '0px'
	}
	text(ctx, subtitle, 0, TITLE_TEXT_SIZE + TEXT_SIZE + PADDING, THEME.subtitle)

	line(ctx, left, bottom, right, bottom, THEME.axis)
	line(ctx, left, top, left, bottom, THEME.axis)
	for (const v of xGridlines) {
		line(ctx, toX(v), top, toX(v), bottom + TICK_SIZE, THEME.gridline)
	}
	for (const v of yGridlines) {
		line(ctx, left - TICK_SIZE, toY(v), right, toY(v), THEME.gridline)
	}
	for (const [i, v] of xTicks.entries()) {
		line(ctx, toX(v), bottom, toX(v), bottom + TICK_SIZE, THEME.axis)
		text(ctx, xLabels[i], toX(v), bottom + TEXT_SIZE + PADDING + TICK_SIZE, {
			...THEME.label,
			align: 'center',
		})
	}
	for (const [i, v] of yTicks.entries()) {
		line(ctx, left - TICK_SIZE, toY(v), left, toY(v), THEME.axis)
		text(ctx, yLabels[i], left - TICK_SIZE - PADDING, toY(v) + 4, {
			...THEME.label,
			align: 'right',
		})
	}

	text(ctx, x_axis_label, (left + right) / 2, layout.height ?? HEIGHT, {
		...THEME.label,
		align: 'center',
	})
	ctx.translate(TEXT_SIZE, (top + bottom) / 2)
	ctx.rotate(-Math.PI / 2)
	text(ctx, y_axis_label, 0, 0, { ...THEME.label, align: 'center' })
	ctx.restore()
}

/**
 * Calculate legend positions and required height, reserving room for the title
 * and subtitle. Pass the returned extraHeight to computeLayout when sizing the
 * chart. Measurements reflect the fonts available at call time.
 * @param {CanvasRenderingContext2D} ctx Context used to measure text.
 * @param {Array<SeriesStyle>} series Plotted series in legend order.
 * @param {Partial<ChartLabels>} [labels] Title/subtitle used to reserve header space.
 * @returns {LegendLayout} Positioned entries, required extra height, and omissions.
 */
export function measureLegend(ctx, series, labels = {}) {
	setFont(ctx, THEME.title.size, THEME.title.weight)
	const titleWidth = ctx.measureText(labels.title || '').width
	setFont(ctx, THEME.subtitle.size, THEME.subtitle.weight)
	const subtitleWidth = ctx.measureText(labels.subtitle || '').width
	setFont(ctx, THEME.label.size, THEME.label.weight)
	return legendEntries({
		series,
		left: MARGIN.left,
		right: WIDTH - MARGIN.right,
		headerRight: Math.max(MARGIN.left, Math.max(titleWidth, subtitleWidth) + 10),
		measureText: (label) => ctx.measureText(label).width,
	})
}

/**
 * Draw the chart's legend symbols and labels at the positions in layout.legend
 * when supplied, using a full-width standalone legend as the default.
 * @param {CanvasRenderingContext2D} ctx Context in logical chart coordinates.
 * @param {Array<SeriesStyle>} series Plotted series used by the measurement fallback.
 * @param {ChartLayout} layout Chart geometry with an optional premeasured legend.
 * @returns {LegendLayout} The legend that was drawn, including omission warnings.
 */
export function drawLegend(ctx, series, layout) {
	const legend = layout.legend ?? measureLegend(ctx, series)
	for (const { r, label, color, shape, x, y } of legend.entries) {
		drawDot(ctx, shape, x + r, y, r, color)
		text(ctx, label, x + 2 * r + LABEL_PADDING, y + LABEL_BASELINE_OFFSET)
	}
	return legend
}

/**
 * Convert the series dash string into lengths for Canvas setLineDash, accepting
 * whitespace or commas between lengths. Missing or empty input selects a solid
 * stroke. Callers must supply valid non-negative dash lengths because this parser
 * passes through negative values and can produce NaN from invalid tokens.
 * @function
 * @param {string} [dash] Space- or comma-separated dash lengths.
 * @returns {Array<number>} Parsed dash lengths, or [] for a solid stroke.
 */
export const dashPattern = (dash) =>
	dash
		? String(dash)
				.trim()
				.split(/[\s,]+/)
				.map(Number)
		: []

/**
 * Map a finite, validated data domain to drawing coordinates. A constant domain
 * maps to the range midpoint.
 * @param {number} min First data endpoint.
 * @param {number} max Last data endpoint.
 * @param {number} from Drawing coordinate for min.
 * @param {number} to Drawing coordinate for max.
 * @returns {CoordinateMap} Linear projection that maps a constant domain to the range midpoint.
 */
function pixelMap(min, max, from, to) {
	if (min === max) {
		return () => (from + to) / 2
	}
	const span = max - min
	const range = to - from
	const perUnit = range / span
	/* Tiny domains can make the precomputed ratio infinite even when each point's
	 * position is representable. Normalize before multiplying in that case. */
	if (!Number.isFinite(perUnit)) {
		return (value) => from + ((value - min) / span) * range
	}
	return (value) => from + (value - min) * perUnit
}

/**
 * Draw one series as connected line segments, preserving visible extrema when
 * observations share a backing-pixel column. A Y value of -Infinity connects
 * across a missing observation. Other non-finite Y values break the line.
 * @param {CanvasRenderingContext2D} ctx Context with the desired stroke style and dash.
 * @param {NumericColumns} columns Ascending X values and logical observation count.
 * @param {NumericColumn} ys One aligned Y column.
 * @param {CoordinateMap} toX Unchecked X projection.
 * @param {CoordinateMap} toY Unchecked Y projection.
 * @param {number} scale Backing pixels per logical unit on the X axis.
 */
function strokeLine(ctx, columns, ys, toX, toY, scale) {
	let pixel = NaN
	let moving = true
	let first = -1
	let low
	let high
	let last
	let lines = 0
	let length = 0
	let lastX
	let lastY
	let previousX
	let previousY
	let previousLength
	/**
	 * Append a point to the series path, optionally starting a disconnected segment.
	 * @param {number} i Row to project.
	 * @param {boolean} [move=false] Start a disconnected line and reset dash distance.
	 */
	function to(i, move) {
		const x = toX(columns.x[i])
		const y = toY(ys[i])
		if (move) {
			if (lines) {
				stroke()
			}
			length = 0
			ctx.lineDashOffset = 0
			ctx.moveTo(x, y)
		} else {
			if (lines === LINE_BATCH) {
				stroke()
				/* Repeat the preceding segment with its original dash phase so splitting
				 * large paths into batches preserves the join and dash continuity. */
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
	/** Stroke the current batch and start a new path, retaining dash distance.
	 */
	function stroke() {
		ctx.stroke()
		ctx.beginPath()
		lines = 0
	}
	/**
	 * Complete the current pixel-column group in the line path.
	 */
	function flush() {
		if (first < 0) {
			return
		}
		to(first, moving)
		moving = false
		/* Emit extrema in source order to preserve whether the peak came before or
		 * after the trough. Skip duplicates when an extremum is also an endpoint. */
		for (const i of low < high ? [low, high] : [high, low]) {
			if (i !== first && i !== last) {
				to(i)
			}
		}
		if (last !== first) {
			to(last)
		}
		first = -1
	}
	ctx.beginPath()
	/* Keep first/min/max/last per backing-pixel X column. Endpoints preserve the
	 * joins between columns, while extrema retain spikes lost by simple sampling. */
	for (let i = 0; i < columns.length; i++) {
		const y = ys[i]
		if (y === -Infinity) {
			continue
		}
		if (!Number.isFinite(y)) {
			flush()
			moving = true
			continue
		}
		const nextPixel = Math.round(toX(columns.x[i]) * scale)
		if (first < 0 || nextPixel !== pixel) {
			flush()
			pixel = nextPixel
			first = i
			low = i
			high = i
			last = i
		} else {
			if (y < ys[low]) {
				low = i
			}
			if (y > ys[high]) {
				high = i
			}
			last = i
		}
	}
	flush()
	if (lines) {
		stroke()
	}
}

/**
 * Draw series lines and markers from the supplied numeric columns. Lower
 * series indexes appear above higher indexes. Lines preserve extrema within each
 * backing-pixel column. Dense mode omits outlines and keeps only the first finite
 * marker at each rounded backing-pixel position per series.
 * @param {CanvasRenderingContext2D} ctx Context with uniform, axis-aligned chart scaling.
 * @param {NumericColumns} columns Plotted data with ascending X values.
 * @param {Array<SeriesStyle>} series Styles paired with columns.ys.
 * @param {ChartLayout} layout Validated domain and drawing bounds.
 * @param {LineRenderOptions} [options] Line, marker, and dense-rendering settings.
 * @returns {Array<Uint8Array>|null} Visibility bitsets when dense markers are enabled,
 * otherwise null. A set bit (index & 7) in byte (index >> 3) marks a drawn row.
 */
export function drawLines(
	ctx,
	columns,
	series,
	layout,
	{ showLines = true, showPoints = true, pointSize = 7, dense = false } = {},
) {
	const toX = pixelMap(layout.xMin, layout.xMax, layout.left, layout.right)
	const toY = pixelMap(layout.yMin, layout.yMax, layout.bottom, layout.top)
	const scale = ctx.getTransform?.().a ?? 1
	const markerRows =
		showPoints && dense ? series.map(() => new Uint8Array(Math.ceil(columns.length / 8))) : null

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

		if (!showPoints || oneSeries.marker === 'none') {
			continue
		}
		if (dense) {
			/* Distinct observations can project to the same backing pixel. Track
			 * occupancy separately per series and record which rows were painted. */
			const width = Math.ceil(WIDTH * scale) + 1
			const drawn = new Uint8Array(width * (Math.ceil((layout.height ?? HEIGHT) * scale) + 1))
			ctx.fillStyle = color
			ctx.beginPath()
			let count = 0
			for (let i = 0; i < columns.length; i++) {
				if (!Number.isFinite(ys[i])) {
					continue
				}
				const x = toX(columns.x[i])
				const y = toY(ys[i])
				const pixel = Math.round(x * scale) + Math.round(y * scale) * width
				if (drawn[pixel]) {
					continue
				}
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
				if (Number.isFinite(ys[i])) {
					drawMarker(
						ctx,
						oneSeries.marker,
						toX(columns.x[i]),
						toY(ys[i]),
						pointSize,
						color,
					)
				}
			}
		}
	}
	return markerRows
}

/**
 * Draw dashed, half-opacity trend lines within the plot rectangle defined by
 * layout. Endpoints beyond the plot bounds are clipped. The context's drawing
 * state is restored even if projection throws.
 * @param {CanvasRenderingContext2D} ctx Context in logical chart coordinates.
 * @param {Array<RenderedTrend>} trends Fits evaluated at their usable endpoints.
 * @param {ChartLayout} layout Clipping rectangle and coordinate mappings.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when a trend endpoint projects to a non-finite drawing coordinate.
 */
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

/**
 * Append one marker shape to the current path for subsequent filling or stroking.
 * Unknown or omitted shapes use a circle, and 'none' leaves the path unchanged.
 * @param {CanvasRenderingContext2D} ctx Context whose path is extended.
 * @param {MarkerShape|undefined} shape Marker geometry. A 'none' marker leaves the path unchanged.
 * @param {number} x Marker center X.
 * @param {number} y Marker center Y.
 * @param {number} size Nominal marker diameter in logical units.
 */
function markerPath(ctx, shape, x, y, size) {
	/* Keep the rounded-square corners and triangle offsets in sync with
	 * containsMarker so geometric hover checks match the drawn shape. */
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
	} else if (shape !== 'none') {
		ctx.moveTo(x + r, y)
		ctx.arc(x, y, r, 0, 2 * Math.PI)
	}
}

/**
 * Draw an individual data marker or hover highlight with an optional outline.
 * A 'none' marker draws nothing.
 * @param {CanvasRenderingContext2D} ctx Context in logical chart coordinates.
 * @param {MarkerShape|undefined} shape Marker shape, defaulting to a circle when omitted or unknown.
 * @param {number} x Marker center X.
 * @param {number} y Marker center Y.
 * @param {number} size Nominal marker diameter.
 * @param {string|undefined} color Fill color, defaulting to DEFAULT_COLOR when omitted or empty.
 * @param {Object} [options] Outline control.
 * @param {boolean} [options.outline=true] Stroke a 1.5-unit theme-colored outline.
 */
export function drawMarker(ctx, shape, x, y, size, color, { outline = true } = {}) {
	if (shape === 'none') {
		return
	}
	ctx.beginPath()
	markerPath(ctx, shape, x, y, size)
	ctx.fillStyle = color || DEFAULT_COLOR
	ctx.fill()
	if (!outline) {
		return
	}
	ctx.strokeStyle = THEME.outline
	ctx.lineWidth = 1.5
	ctx.stroke()
}

/**
 * Draw the compact symbol used in legends and tooltips. A 'none' marker is
 * represented by a short line so line-only series still have a visible key.
 * @param {CanvasRenderingContext2D} ctx Target context whose drawing styles will be changed.
 * @param {MarkerShape|undefined} shape Symbol shape, defaulting to a circle when omitted.
 * @param {number} x Symbol center X.
 * @param {number} y Symbol center Y.
 * @param {number} r Symbol radius.
 * @param {string|undefined} color Fill/stroke color, defaulting to DEFAULT_COLOR when omitted or empty.
 */
function drawDot(ctx, shape, x, y, r, color) {
	ctx.beginPath()
	if (shape === 'none') {
		ctx.moveTo(x - r - 1, y)
		ctx.lineTo(x + r + 1, y)
		ctx.strokeStyle = color || DEFAULT_COLOR
		ctx.lineWidth = 2
		ctx.stroke()
		return
	}
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

/**
 * Display a point's X and Y values in a tooltip near the point and within the
 * plot bounds. Labels may be shortened, but numeric values are displayed in full.
 * Wide glyphs or long numeric strings can render beyond the box's estimated width.
 * @param {CanvasRenderingContext2D} ctx Context in logical chart coordinates.
 * @param {TooltipOptions} options Hovered values, series style, mappings, and plot bounds.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when the hovered point projects to a non-finite drawing coordinate.
 */
export function drawTooltip(
	ctx,
	{ point, name, color, marker, xLabel = 'X', toX, toY, gap, bounds },
) {
	const { background, border, text: textColor, muted } = THEME.tooltip
	const padding = 7
	const charWidth = 4.5
	const markerSpace = 12
	const boxHeight = 34
	const maxWidth = bounds.right - bounds.left
	const value = String(point.y)
	/**
	 * Shorten a label to an estimated width, ending it with an ellipsis when it
	 * exceeds that width. Exhausted space produces just an ellipsis.
	 * @param {string} label Text to shorten.
	 * @param {number} available Width available in logical units.
	 * @returns {string} Original label when it fits, otherwise a prefix followed by an ellipsis.
	 */
	const shorten = (label, available) => {
		const count = Math.max(1, Math.floor(available / charWidth))
		return label.length > count ? label.slice(0, count - 1) + '…' : label
	}
	const xName = shorten(xLabel, maxWidth - 2 * padding - (String(point.x).length + 2) * charWidth)
	const seriesName = shorten(
		name || 'Value',
		maxWidth - 2 * padding - markerSpace - (value.length + 2) * charWidth,
	)
	const xText = `${xName}: ${point.x}`
	const seriesText = `${seriesName}: `
	const boxWidth = Math.min(
		maxWidth,
		Math.max(xText.length * charWidth, markerSpace + (seriesText + value).length * charWidth) +
			2 * padding,
	)
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
	text(ctx, seriesText, boxX + padding + markerSpace, boxY + 28, {
		size: THEME.label.size,
		color: textColor,
	})
	const valueX = boxX + padding + markerSpace + ctx.measureText(seriesText).width
	text(ctx, value, valueX, boxY + 28, { size: THEME.label.size, weight: 600, color: textColor })
}
