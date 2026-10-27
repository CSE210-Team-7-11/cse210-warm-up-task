import { withSeriesColors } from './colors.js'

export const shownMarker = (marker, type) =>
	type === 'scatter' && marker === 'none' ? 'circle' : marker

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
