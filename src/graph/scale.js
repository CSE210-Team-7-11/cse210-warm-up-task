// @ts-check

/**
 * Axis geometry, regression, and point lookup in logical chart coordinates.
 * @module graph/scale
 */
import { collectOverflowErrors, finiteCalculation } from '../numericErrors.js'

/** Logical chart width, before scaling to CSS and backing pixels.
 * @type {number}
 */
export const WIDTH = 500
/** Logical chart height before adding legend rows.
 * @type {number}
 */
export const HEIGHT = 300
/** Space reserved around the plot in logical chart units.
 * @type {ChartMargins}
 */
export const MARGIN = { top: 40, right: 5, bottom: 35, left: 45 }
/** Gap between axis text and adjacent geometry, in logical units.
 * @type {number}
 */
export const PADDING = 5
/** Logical size used to position axis labels.
 * @type {number}
 */
export const TEXT_SIZE = 10
/** Logical height reserved for the title baseline.
 * @type {number}
 */
export const TITLE_TEXT_SIZE = 15
/** Axis tick length in logical chart units.
 * @type {number}
 */
export const TICK_SIZE = 5

/**
 * Find the minimum and maximum of an iterable. Empty input returns Infinity and
 * -Infinity, and any NaN makes both extrema NaN.
 * @param {Iterable<number>} values Values to inspect.
 * @returns {{min: number, max: number}} Minimum and maximum encountered.
 */
export function minMax(values) {
	let min = Infinity
	let max = -Infinity
	/* Spreading a large column into Math.min or Math.max can exceed the engine's
	 * argument-count limit. Scan without turning its values into arguments. */
	for (const value of values) {
		min = Math.min(min, value)
		max = Math.max(max, value)
	}
	return { min, max }
}

/**
 * Create a linear mapping from a data domain to drawing coordinates. Ascending
 * and descending drawing ranges are supported, and values outside the domain are
 * extrapolated. A constant domain maps to the range midpoint.
 * @param {number} domainMin First data-domain endpoint.
 * @param {number} domainMax Second data-domain endpoint.
 * @param {number} rangeMin Drawing coordinate for domainMin.
 * @param {number} rangeMax Drawing coordinate for domainMax.
 * @param {string} [columnName='axis'] Column identified in numeric diagnostics.
 * @returns {CoordinateMap} Mapping from data values to logical drawing coordinates.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when the domain span is non-finite, or a later mapping
 * produces a non-finite difference or position.
 */
export function scale(domainMin, domainMax, rangeMin, rangeMax, columnName = 'axis') {
	const span = finiteCalculation(
		domainMax - domainMin,
		columnName,
		() => `${domainMin} to ${domainMax}`,
		'axis range',
	)
	return (value) => {
		// All values equal: put everything in the middle instead of dividing by zero.
		if (domainMax === domainMin) {
			return (rangeMin + rangeMax) / 2
		}
		const t = finiteCalculation(value - domainMin, columnName, value, 'chart position') / span
		return finiteCalculation(
			rangeMin + t * (rangeMax - rangeMin),
			columnName,
			value,
			'chart position',
		)
	}
}

/**
 * Generate count + 1 evenly spaced ticks from min through max, including both
 * endpoints. A constant domain produces repeated values at the same drawing
 * position. Very narrow ranges can also produce repeated values through
 * floating-point rounding.
 * Callers must supply a positive integer interval count.
 * @param {number} min First endpoint.
 * @param {number} max Last endpoint.
 * @param {number} [count=5] Number of intervals between ticks.
 * @param {string} [columnName='axis'] Column identified in numeric diagnostics.
 * @returns {Array<number>} count + 1 evenly spaced values for a valid count.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when the span or a generated tick is non-finite.
 */
export function ticks(min, max, count = 5, columnName = 'axis') {
	const describeRange = () => `${min} to ${max}`
	const span = finiteCalculation(max - min, columnName, describeRange, 'axis range')
	return Array.from({ length: count + 1 }, (_, i) =>
		finiteCalculation(min + span * (i / count), columnName, describeRange, 'axis ticks'),
	)
}

/**
 * Generate axis values for interior gridlines, excluding the two endpoint tick
 * entries. Values have the same constant-domain and rounding limitations as ticks.
 * @param {number} min First domain endpoint.
 * @param {number} max Last domain endpoint.
 * @param {number} [count=5] Positive integer number of intervals.
 * @param {string} [columnName='axis'] Column identified in numeric diagnostics.
 * @returns {Array<number>} Interior tick values, empty when there is one interval.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when the span or a generated tick is non-finite.
 */
export function gridlines(min, max, count = 5, columnName = 'axis') {
	return ticks(min, max, count, columnName).slice(1, -1)
}

/**
 * Find the X/Y extent and count of finite observations across all series. X bounds
 * cover rows containing at least one finite Y, and each series' finite Y values
 * count separately. A zero count leaves infinite extrema, so callers must handle
 * empty data before requesting a layout.
 * @param {NumericColumns} columns Aligned data with finite X values.
 * @returns {DataBounds} Extrema and finite Y count. When no finite Y values are found,
 * minima remain Infinity and maxima remain -Infinity.
 */
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
			if (!Number.isFinite(y)) {
				continue
			}
			shown = true
			count++
			if (y < yMin) {
				yMin = y
			}
			if (y > yMax) {
				yMax = y
			}
		}
		if (!shown) {
			continue
		}
		if (columns.x[i] < xMin) {
			xMin = columns.x[i]
		}
		if (columns.x[i] > xMax) {
			xMax = columns.x[i]
		}
	}
	return { xMin, xMax, yMin, yMax, count }
}

/**
 * Fit y = slope * x + startHeight by ordinary least squares, skipping non-finite Y
 * observations. Returns null for fewer than two usable observations or zero
 * computed X variance, including constant X values and differences small enough
 * to underflow to zero variance. Finite inputs can still lose
 * precision or overflow during the fit.
 * @param {NumericColumn} x Finite X values aligned with y.
 * @param {NumericColumn} y Y values, including missing-value sentinels.
 * @param {number} length Number of observations to read.
 * @param {string} [xColumnName='X'] X name in numeric diagnostics.
 * @param {string} [yColumnName='Y'] Y name in numeric diagnostics.
 * @returns {TrendFit|null} Fit and usable X extent, or null with fewer than two
 * usable observations or zero computed X variance.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when a sum, product, slope, or intercept is non-finite.
 */
export function trendLine(x, y, length, xColumnName = 'X', yColumnName = 'Y') {
	let count = 0
	let totalX = 0
	let totalY = 0
	let firstX = Infinity
	let lastX = -Infinity
	for (let i = 0; i < length; i++) {
		if (!Number.isFinite(y[i])) {
			continue
		}
		count++
		totalX = finiteCalculation(totalX + x[i], xColumnName, x[i], 'trend line')
		totalY = finiteCalculation(totalY + y[i], yColumnName, y[i], 'trend line')
		if (x[i] < firstX) {
			firstX = x[i]
		}
		if (x[i] > lastX) {
			lastX = x[i]
		}
	}
	if (count < 2) {
		return null
	}
	const averageX = totalX / count
	const averageY = totalY / count

	/* Compute covariance and variance around the means to avoid subtracting large
	 * raw sums of squares. These sums are still uncompensated and unscaled. */
	let top = 0
	let bottom = 0
	for (let i = 0; i < length; i++) {
		if (!Number.isFinite(y[i])) {
			continue
		}
		top = finiteCalculation(
			top + (x[i] - averageX) * (y[i] - averageY),
			yColumnName,
			y[i],
			'trend line',
		)
		bottom = finiteCalculation(
			bottom + (x[i] - averageX) * (x[i] - averageX),
			xColumnName,
			x[i],
			'trend line',
		)
	}
	// A zero denominator cannot define a slope, including when tiny deviations underflow.
	if (bottom === 0) {
		return null
	}

	const slope = finiteCalculation(top / bottom, yColumnName, averageY, 'trend line')
	return {
		slope,
		startHeight: finiteCalculation(
			averageY - slope * averageX,
			yColumnName,
			averageY,
			'trend line',
		),
		firstX,
		lastX,
	}
}

/**
 * Create a mapping from drawing coordinates back to data values. Coordinates
 * outside the drawing range are extrapolated. Constant domains
 * and zero-width drawing ranges return domainMin for every input.
 * @param {number} domainMin First data-domain endpoint.
 * @param {number} domainMax Second data-domain endpoint.
 * @param {number} rangeMin Drawing coordinate for domainMin.
 * @param {number} rangeMax Drawing coordinate for domainMax.
 * @param {string} [columnName='axis'] Column identified in numeric diagnostics.
 * @returns {CoordinateMap} Mapping from logical drawing coordinates to data values.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when the domain span or a later mapped value is non-finite.
 */
export function invert(domainMin, domainMax, rangeMin, rangeMax, columnName = 'axis') {
	const span = finiteCalculation(
		domainMax - domainMin,
		columnName,
		() => `${domainMin} to ${domainMax}`,
		'axis range',
	)
	return (pixel) => {
		if (domainMax === domainMin) {
			return domainMin
		}
		if (rangeMax === rangeMin) {
			return domainMin
		}
		const t = (pixel - rangeMin) / (rangeMax - rangeMin)
		return finiteCalculation(
			domainMin + t * span,
			columnName,
			() => `${domainMin} to ${domainMax}`,
			'axis value',
		)
	}
}

/**
 * Find the hover target near a pointer position. Marker containment takes priority
 * over center distance, with isAbove resolving overlapping hits. Otherwise,
 * choose the nearest eligible center, breaking ties by lower series index
 * and then lower row index. A false hitTest result still permits distance fallback.
 * Non-finite Y values and rows outside the plotted X domain are excluded. Radius
 * bounds must cover the extents reported by the caller's marker callbacks.
 * @param {NumericColumns} columns Plotted data with ascending finite X values.
 * @param {ChartLayout} layout Geometry used to draw these columns.
 * @param {number} px Pointer X in logical chart units.
 * @param {number} py Pointer Y in logical chart units.
 * @param {number} maxDistance Minimum target radius in logical chart units.
 * @param {NearestOptions} [options] Marker geometry, radius bounds, and draw order.
 * @returns {PointIndex|null} Selected observation, or null for empty data, no target,
 * non-finite pointer coordinates, or negative/non-finite distance bounds.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when converting coordinates produces a non-finite value.
 */
export function findNearest(
	columns,
	layout,
	px,
	py,
	maxDistance,
	{
		radiusAt,
		maxRadius = maxDistance,
		hitTest,
		maxHitRadius = maxRadius,
		isAbove = (s, i, otherSeries, otherIndex) =>
			s < otherSeries || (s === otherSeries && i > otherIndex),
	} = {},
) {
	if (
		!columns.length ||
		!Number.isFinite(px) ||
		!Number.isFinite(py) ||
		!Number.isFinite(maxDistance) ||
		maxDistance < 0 ||
		!Number.isFinite(maxRadius) ||
		maxRadius < 0 ||
		!Number.isFinite(maxHitRadius) ||
		maxHitRadius < 0
	) {
		return null
	}

	/* Start at the pointer's insertion point in sorted X, then scan outward.
	 * Horizontal distance can rule out whole remaining ranges without projecting Y. */
	const inverseX = layout.fromX(Math.max(layout.left, Math.min(px, layout.right)))
	const x = Math.max(layout.xMin, Math.min(inverseX, layout.xMax))
	let low = 0
	let high = columns.length
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if (columns.x[middle] < x) {
			low = middle + 1
		} else {
			high = middle
		}
	}

	let nearest = null
	let hit = null
	let distance = Math.max(maxDistance, maxRadius)
	/**
	 * Inspect one row and update the selected target. Return false when its X
	 * position proves that later rows in this scan direction cannot be candidates.
	 * @param {number} index Candidate row.
	 * @returns {boolean} Whether the outward scan may continue in this direction.
	 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
	 * when a candidate projects to a non-finite drawing coordinate.
	 */
	function check(index) {
		// Missing-only rows can lie outside the plotted domain. Do not project them.
		if (columns.x[index] < layout.xMin || columns.x[index] > layout.xMax) {
			return false
		}
		const dx = layout.toX(columns.x[index]) - px
		// Keep overlapping markers in range even after finding a closer centre.
		if (Math.abs(dx) > Math.max(distance, hitTest ? maxHitRadius : 0)) {
			return false
		}
		for (let seriesIndex = 0; seriesIndex < columns.ys.length; seriesIndex++) {
			const y = columns.ys[seriesIndex][index]
			if (!Number.isFinite(y)) {
				continue
			}
			const dy = layout.toY(y) - py
			if (hitTest?.(seriesIndex, index, dx, dy)) {
				if (!hit || isAbove(seriesIndex, index, hit.seriesIndex, hit.index)) {
					hit = { seriesIndex, index }
				}
				distance = 0
				continue
			}
			if (hit) {
				continue
			}
			const nextDistance = Math.hypot(dx, dy)
			const targetRadius = Math.max(maxDistance, radiusAt?.(seriesIndex, index) ?? 0)
			if (nextDistance > targetRadius) {
				continue
			}
			if (
				nextDistance < distance ||
				(nextDistance === distance &&
					(!nearest ||
						seriesIndex < nearest.seriesIndex ||
						(seriesIndex === nearest.seriesIndex && index < nearest.index)))
			) {
				distance = nextDistance
				nearest = { seriesIndex, index }
			}
		}
		return true
	}

	for (let i = low; i < columns.length; i++) {
		if (!check(i)) {
			break
		}
	}
	for (let i = low - 1; i >= 0; i--) {
		if (!check(i)) {
			break
		}
	}
	return hit ?? nearest
}

/**
 * Calculate plot dimensions, axis mappings, and tick values for the supplied data
 * domains. Larger Y values appear higher on the plot. Extra legend height moves
 * the plot down and increases total chart height, preserving the plot's dimensions.
 * Domains are used as supplied, including repeated ticks for a constant domain.
 * @param {Object} options Domain bounds and optional diagnostic names/legend space.
 * @param {number} options.xMin Minimum plotted X.
 * @param {number} options.xMax Maximum plotted X.
 * @param {number} options.yMin Minimum plotted Y.
 * @param {number} options.yMax Maximum plotted Y.
 * @param {string} [options.xColumnName='X'] X name in numeric diagnostics.
 * @param {string} [options.yColumnName='Y'] Y name in numeric diagnostics.
 * @param {number} [options.extraHeight=0] Extra logical height reserved for the legend.
 * @returns {ChartLayout} Plot edges, total height, mappings, and axis values.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when one axis has a non-finite span or tick.
 * @throws A {@link module:numericErrors.NumericOverflowErrors|NumericOverflowErrors}
 * when both axes fail independent calculations.
 */
export function computeLayout({
	xMin,
	xMax,
	yMin,
	yMax,
	xColumnName = 'X',
	yColumnName = 'Y',
	extraHeight = 0,
}) {
	const left = MARGIN.left
	const right = WIDTH - MARGIN.right
	const top = MARGIN.top + extraHeight
	const height = HEIGHT + extraHeight
	const bottom = height - MARGIN.bottom
	/**
	 * Calculate the coordinate conversions, ticks, and gridlines for one axis.
	 * @param {number} min First data endpoint.
	 * @param {number} max Last data endpoint.
	 * @param {number} start Drawing coordinate for min.
	 * @param {number} end Drawing coordinate for max.
	 * @param {string} columnName Name in numeric diagnostics.
	 * @returns {{toPixel: CoordinateMap, fromPixel: CoordinateMap, ticks: Array<number>, gridlines: Array<number>}}
	 * Mappings and endpoint/interior tick values.
	 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
	 * when the span or a generated tick is non-finite.
	 */
	function axis(min, max, start, end, columnName) {
		const toPixel = scale(min, max, start, end, columnName)
		const fromPixel = invert(min, max, start, end, columnName)
		const axisTicks = ticks(min, max, 5, columnName)
		return { toPixel, fromPixel, ticks: axisTicks, gridlines: axisTicks.slice(1, -1) }
	}
	/* Attempt both axes so a failure on X does not conceal an independent failure
	 * on Y. Canvas Y increases downward, so reverse the Y drawing endpoints. */
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
