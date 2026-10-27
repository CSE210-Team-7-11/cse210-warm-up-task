/**
 * Legend dimensions and entry positions.
 * @module graph/Legend
 */

/** First-row symbol center in logical chart coordinates.
 * @type {number}
 */
export const LEGEND_CENTER_Y = 20
/** Text baseline offset below the legend symbol center.
 * @type {number}
 */
export const LABEL_BASELINE_OFFSET = 3
/** Gap between a legend symbol and its label in logical chart units.
 * @type {number}
 */
export const LABEL_PADDING = 5
/** Maximum number of legend rows before entries are omitted.
 * @type {number}
 */
export const MAX_LEGEND_ROWS = 4
const ENTRY_GAP = 10
const ROW_HEIGHT = 20
const DOT_RADIUS = 3

/**
 * Calculate legend entry positions and required height for named series. Entries
 * are right-aligned and may wrap below the header. Labels wider than a full row
 * or beyond the row limit are omitted and counted, and their series remain plotted.
 * Only named series contribute entries or omission counts.
 * @param {Object} options Series, available span, and a label measurement callback.
 * @param {Array<SeriesStyle>} options.series Styles in legend display order.
 * @param {number} options.left Left edge of the full legend span.
 * @param {number} options.right Right edge of the full legend span.
 * @param {function(string): number} options.measureText Label width in logical chart units.
 * @param {number} [options.headerRight] Right edge of header text, defaulting to left.
 * @returns {LegendLayout} Positioned entries, extra height, and omitted-entry warnings.
 */
export function legendEntries({ series, left, right, measureText, headerRight = left }) {
	const entries = series
		.filter((oneSeries) => oneSeries.name)
		.map((oneSeries) => ({
			r: DOT_RADIUS,
			label: oneSeries.name,
			color: oneSeries.color,
			shape: oneSeries.marker,
		}))

	const rows = [{ entries: [], width: 0, left: headerRight, y: LEGEND_CENTER_Y }]
	let omitted = 0
	for (const entry of entries) {
		const width = 2 * entry.r + LABEL_PADDING + measureText(entry.label)
		if (width > right - left) {
			omitted++
			continue
		}
		let row = rows.at(-1)
		/* An entry may fit a full row but not the space beside the header. Move
		 * that first row below the header without consuming another row slot. */
		if (!row.entries.length && width > right - row.left) {
			row.left = left
			row.y += ROW_HEIGHT
		}
		const gap = row.entries.length ? ENTRY_GAP : 0
		if (row.width + gap + width > right - row.left) {
			if (rows.length === MAX_LEGEND_ROWS) {
				omitted++
				continue
			}
			row = { entries: [], width: 0, left, y: row.y + ROW_HEIGHT }
			rows.push(row)
		}
		row.width += (row.entries.length ? ENTRY_GAP : 0) + width
		row.entries.push({ ...entry, width })
	}
	const placedEntries = []
	for (const row of rows) {
		let x = right - row.width
		for (const entry of row.entries) {
			placedEntries.push({ ...entry, x, y: row.y })
			x += entry.width + ENTRY_GAP
		}
	}
	return {
		entries: placedEntries,
		extraHeight: placedEntries.length ? rows.at(-1).y - LEGEND_CENTER_Y : 0,
		warnings: omitted ? [['legend-overflow', omitted]] : [],
	}
}
