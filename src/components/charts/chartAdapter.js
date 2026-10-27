import { buildChartData } from './chartUtils.js'

// Keep the editor-to-chart conversion outside the preview component.
export function prepareChart(state, options) {
	const plotted = { ...state, series: state.series.filter((oneSeries) => oneSeries.color) }
	const { columns, series, warnings, warningCount } = buildChartData(plotted, options)
	let pointCount = 0
	for (const ys of columns.ys) {
		for (let i = 0; i < columns.length; i++) {
			if (Number.isFinite(ys[i])) {
				pointCount++
			}
		}
	}
	const graphSeries = series.map(({ name, color, marker, dash }) => ({
		name,
		color,
		marker,
		dash,
	}))

	return {
		warnings,
		warningCount,
		pointCount,
		graphProps: {
			xColumnName: state.columns[0]?.name ?? 'X',
			columns,
			series: graphSeries,
			type: state.chartType,
			showPoints: state.showPoints,
			pointSize: state.pointSize,
			showTrendLine: true,
			labels: {
				title: state.title,
				subtitle: state.showSubtitle ? state.subtitle : '',
				x_axis_label: state.xLabel,
				y_axis_label: state.yLabel,
			},
		},
	}
}
