export const LEGEND_CENTER_Y = 20
export const LABEL_BASELINE_OFFSET = 3
export const LABEL_PADDING = 5
export const MAX_LEGEND_ROWS = 4
const ENTRY_GAP = 10
const ROW_HEIGHT = 20
const DOT_RADIUS = 3

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
