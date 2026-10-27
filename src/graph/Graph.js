// @ts-check

/**
 * Chart lifecycle, prepared drawing state, resizing, and pointer interaction.
 * @module graph/Graph
 */
import { WIDTH, bounds, computeLayout, findNearest, trendLine } from './scale.js'
import {
	drawFrame,
	drawLegend,
	drawLines,
	drawMarker,
	drawTooltip,
	drawTrendLines,
	measureLegend,
} from './canvas.js'
import { prepareSeries } from './series.js'
import { containsMarker } from './markerHit.js'
import { collectOverflowErrors, finiteCalculation } from '../numericErrors.js'
import './Graph.css'

/** Default text replaced individually by each update's label overrides.
 * @type {ChartLabels}
 */
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
 * Create a responsive line or scatter chart inside a browser element. Pass options
 * to draw immediately, or omit them to defer drawing until the first update.
 * The chart follows the container's width, deferring drawing while that width is zero.
 * Data arrays remain shared with the caller. Call update after editing them and
 * destroy when the chart is no longer needed. Requires Canvas2D and ResizeObserver.
 * A failed update can leave partial changes. If the initial draw throws, the
 * allocated canvas and observer remain in place.
 * @param {HTMLElement} container Element that will contain the canvas.
 * @param {ChartOptions} [options] Initial complete configuration, or omit to defer drawing.
 * @returns {ChartHandle} Operations for redrawing and releasing this instance.
 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
 * when a numeric calculation in the initial draw is non-finite.
 * @throws A {@link module:numericErrors.NumericOverflowErrors|NumericOverflowErrors}
 * when independent calculations in the initial draw overflow.
 */
export function createChart(container, options) {
	const canvas = document.createElement('canvas')
	canvas.className = 'graph'
	canvas.setAttribute('role', 'img')
	const ctx = canvas.getContext('2d')
	const saved = document.createElement('canvas')

	const resizeObserver = new ResizeObserver(() => {
		if (view) {
			drawCanvas()
		}
	})
	resizeObserver.observe(container)

	/** @type {ChartView|null} */
	let view = null
	/** @type {PointIndex|null} */
	let hovered = null

	/**
	 * Redraw the chart with a complete replacement configuration and clear hover.
	 * Omitted optional settings return to their defaults. Valid data can be supplied
	 * while the container has zero width, with drawing deferred until it becomes visible.
	 * A failed update may leave partial changes to the previous chart.
	 * @param {ChartOptions} options Complete chart input with defaults applied to omitted fields.
	 * @returns {ChartUpdateResult} Legend omissions from the prepared layout.
	 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
	 * when one checked calculation is non-finite.
	 * @throws A {@link module:numericErrors.NumericOverflowErrors|NumericOverflowErrors}
	 * when multiple checked calculations overflow.
	 */
	function update({
		series,
		columns,
		xColumnName,
		type = 'scatter',
		labels = {},
		showTrendLine = false,
		showPoints = true,
		pointSize = 7,
	}) {
		/* Series and row indexes may identify different observations after this update. */
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
		/**
		 * Return the hover radius for a plotted series.
		 * @param {number} s Plotted series index.
		 * @returns {number} Nominal radius, or zero for a hidden marker.
		 */
		const markerRadius = (s) => (shownSeries[s].marker === 'none' ? 0 : markerSize / 2)
		if (!canvas.isConnected) {
			container.append(canvas)
		}
		const legend = measureLegend(ctx, shownSeries, { title, subtitle })

		const [layout, trends] = collectOverflowErrors([
			() => ({
				...computeLayout({
					xMin,
					xMax,
					yMin,
					yMax,
					xColumnName: xName,
					yColumnName: yName,
					extraHeight: legend.extraHeight,
				}),
				legend,
			}),
			() =>
				showTrendLine && type === 'scatter'
					? collectOverflowErrors(
							shownSeries.map((oneSeries, s) => () => {
								const seriesName = oneSeries.name || y_axis_label
								const trend = trendLine(
									columns.x,
									columns.ys[s],
									columns.length,
									xName,
									seriesName,
								)
								if (!trend) {
									return null
								}
								const { firstX, lastX } = trend
								const [firstY, lastY] = collectOverflowErrors([
									() =>
										finiteCalculation(
											trend.slope * firstX + trend.startHeight,
											seriesName,
											() => `${xName}=${firstX}`,
											'trend line',
										),
									() =>
										finiteCalculation(
											trend.slope * lastX + trend.startHeight,
											seriesName,
											() => `${xName}=${lastX}`,
											'trend line',
										),
								])
								return { color: oneSeries.color, firstX, lastX, firstY, lastY }
							}),
						)
					: [],
		])
		const { left, right, top, bottom, toX, toY } = layout
		// Overlapping white outlines can hide every series on dense plots.
		const dense = pointCount > right - left
		const maxHitRadius = markerSize / 2 + 0.5 + (dense ? 0 : 1.5)
		/**
		 * Test whether a painted marker contains the pointer. Markers omitted by
		 * dense rendering return false, leaving only center-distance hover fallback.
		 * @param {number} s Plotted series index.
		 * @param {number} i Row index.
		 * @param {number} dx Marker center X minus pointer X in logical units.
		 * @param {number} dy Marker center Y minus pointer Y in logical units.
		 * @returns {boolean} Whether this drawn marker contains the pointer.
		 */
		const hitTest = (s, i, dx, dy) => {
			if (view.markerRows && !(view.markerRows[s][i >> 3] & (1 << (i & 7)))) {
				return false
			}
			/* containsMarker uses pointer-minus-center offsets. Reversing them matters
			 * for the triangle, whose upper and lower halves are not symmetric. */
			return containsMarker(shownSeries[s].marker, -dx, -dy, markerSize / 2, dense ? 0 : 0.75)
		}
		/**
		 * Compare the paint priority of two overlapping markers.
		 * @param {number} s Candidate series index.
		 * @param {number} i Candidate row index.
		 * @param {number} otherSeries Previously selected series index.
		 * @param {number} otherIndex Previously selected row index.
		 * @returns {boolean} Whether the candidate is drawn above the other marker.
		 */
		const isAbove = (s, i, otherSeries, otherIndex) =>
			s < otherSeries || (s === otherSeries && i > otherIndex)
		canvas.setAttribute('aria-label', `${type} plot of ${pointCount} points`)

		view = {
			columns,
			layout,
			markerRadius,
			maxRadius: markerSize / 2,
			hitTest: markerSize ? hitTest : undefined,
			maxHitRadius,
			isAbove,
			shownSeries,
			type,
			x_axis_label,
			toX,
			toY,
			bounds: { left, right, top, bottom },
			trends: trends.filter(Boolean),
			labels: { title, subtitle, x_axis_label, y_axis_label },
			markerSize,
			dense,
		}
		drawCanvas()
		return { warnings: legend.warnings }
	}

	/**
	 * Redraw the current chart at the container's width and device pixel ratio.
	 * Does nothing while the container has zero width.
	 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
	 * when a frame or trend projection produces a non-finite coordinate.
	 */
	function drawCanvas() {
		const cssWidth = container.clientWidth
		if (!cssWidth) {
			return
		}
		const ratio = window.devicePixelRatio || 1
		const width = Math.round(cssWidth * ratio)
		const height = Math.round(((cssWidth * view.layout.height) / WIDTH) * ratio)
		if (canvas.width !== width || canvas.height !== height) {
			saved.width = width
			canvas.width = width
			saved.height = height
			canvas.height = height
		}
		ctx.setTransform(width / WIDTH, 0, 0, height / view.layout.height, 0, 0)
		ctx.clearRect(0, 0, WIDTH, view.layout.height)
		const { columns, layout, shownSeries, labels, type, trends, markerSize, dense } = view
		drawFrame(ctx, layout, labels)
		drawLegend(ctx, shownSeries, layout)
		drawTrendLines(ctx, trends, layout)
		/* Resizing changes which observations share a backing pixel, so each draw
		 * must replace the marker mask used by geometric hover checks. */
		view.markerRows = drawLines(ctx, columns, shownSeries, layout, {
			showLines: type === 'line',
			showPoints: markerSize > 0,
			pointSize: markerSize,
			dense,
		})
		/* Cache the unhovered drawing so pointer changes do not redraw the dataset. */
		const savedCtx = saved.getContext('2d')
		savedCtx.clearRect(0, 0, width, height)
		savedCtx.drawImage(canvas, 0, 0)
		drawHover()
	}

	/**
	 * Draw the selected point's highlight and tooltip, or clear the overlay when
	 * no point is selected.
	 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
	 * when the hovered point projects to a non-finite coordinate.
	 */
	function drawHover() {
		/* The saved image already contains backing pixels. Copy it without the chart
		 * transform, then restore logical coordinates for the highlight and tooltip. */
		ctx.save()
		ctx.setTransform(1, 0, 0, 1, 0, 0)
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		ctx.drawImage(saved, 0, 0)
		ctx.restore()
		if (!hovered) {
			return
		}
		const {
			columns,
			shownSeries,
			markerSize,
			dense,
			x_axis_label,
			toX,
			toY,
			bounds: plotBounds,
		} = view
		const hoveredSeries = shownSeries[hovered.seriesIndex]
		const point = {
			x: columns.x[hovered.index],
			y: columns.ys[hovered.seriesIndex][hovered.index],
		}
		if (markerSize) {
			drawMarker(
				ctx,
				hoveredSeries.marker,
				toX(point.x),
				toY(point.y),
				markerSize + HOVER_EXTRA_SIZE,
				hoveredSeries.color,
				{ outline: !dense },
			)
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
			bounds: plotBounds,
		})
	}

	/**
	 * Update the hover target at the pointer's position. Ignore events before the
	 * first update and while the canvas has a zero-sized display rectangle.
	 * @param {PointerEvent} event Pointer movement dispatched on this canvas.
	 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
	 * when coordinate conversion or hover drawing overflows.
	 */
	function pointerMove(event) {
		if (!view) {
			return
		}
		const rect = event.currentTarget.getBoundingClientRect()
		if (!rect.width || !rect.height) {
			return
		}
		/* Browser coordinates follow the displayed rectangle, while lookup uses the
		 * logical layout. Convert through the rectangle rather than backing pixels. */
		const px = ((event.clientX - rect.left) * WIDTH) / rect.width
		const py = ((event.clientY - rect.top) * view.layout.height) / rect.height
		const nearest = findNearest(view.columns, view.layout, px, py, HOVER_DISTANCE, {
			radiusAt: view.markerRadius,
			maxRadius: view.maxRadius,
			hitTest: view.hitTest,
			maxHitRadius: view.maxHitRadius,
			isAbove: view.isAbove,
		})
		setHovered(nearest)
	}

	/** Remove the hover overlay when the pointer leaves the canvas.
	 */
	function pointerLeave() {
		setHovered(null)
	}

	canvas.addEventListener('pointermove', pointerMove)
	canvas.addEventListener('pointerleave', pointerLeave)

	/**
	 * Set the hovered observation, refreshing its highlight and tooltip when the
	 * selected series/row changes.
	 * @param {PointIndex|null} next New hover target, or null to clear it.
	 * @throws A {@link module:numericErrors.Float64OverflowError|Float64OverflowError}
	 * when drawing the new target overflows.
	 */
	function setHovered(next) {
		const sameAsBefore =
			next &&
			hovered &&
			next.seriesIndex === hovered.seriesIndex &&
			next.index === hovered.index
		if (sameAsBefore || next === hovered) {
			return
		}
		hovered = next
		drawHover()
	}

	/**
	 * Remove the chart and stop handling pointer and resize events. Discard the
	 * handle afterward.
	 */
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
