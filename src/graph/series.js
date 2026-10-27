// @ts-check

/**
 * Resolve styles and retain aligned Y columns for the plotted series.
 * @module graph/series
 */
import { withSeriesColors } from './colors.js'

/**
 * Resolve a marker shape for the plot type. Scatter plots replace 'none' with
 * 'circle', while line plots preserve the requested shape.
 * @function
 * @param {MarkerShape|undefined} marker Requested shape, possibly omitted by the caller.
 * @param {('line'|'scatter')} type Plot type.
 * @returns {MarkerShape|undefined} Circle for scatter/'none', otherwise the input shape.
 */
export const shownMarker = (marker, type) =>
	type === 'scatter' && marker === 'none' ? 'circle' : marker

/**
 * Prepare series styles and their matching Y columns for plotting. Missing colors
 * are assigned automatically when available, still-uncolored series are excluded,
 * and scatter plots replace 'none' markers with circles. The result shares retained
 * numeric arrays with the caller, creating style objects for changed colors or markers.
 * @param {Array<SeriesStyle>} series Styles paired with columns.ys.
 * @param {NumericColumns} columns Numeric data for all supplied series.
 * @param {('line'|'scatter')} type Plot type used to resolve marker visibility.
 * @returns {{series: Array<SeriesStyle>, columns: NumericColumns}} Plotted styles
 * with colors, and matching columns. The original columns object is reused when
 * no series were removed. Filtering creates a new columns wrapper and ys list.
 */
export function prepareSeries(series, columns, type) {
	const colored = withSeriesColors(series)
	const shown = []
	const ys = []
	for (let i = 0; i < colored.length; i++) {
		if (!colored[i].color) {
			continue
		}
		const marker = shownMarker(colored[i].marker, type)
		shown.push(marker === colored[i].marker ? colored[i] : { ...colored[i], marker })
		ys.push(columns.ys[i])
	}
	return {
		series: shown,
		columns: shown.length === series.length ? columns : { ...columns, ys },
	}
}
