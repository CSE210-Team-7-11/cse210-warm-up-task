import { buildChartData } from './chartUtils.js'

// Keep the editor-to-chart conversion outside the preview component.
export function prepareChart(state) {
  const { data, series } = buildChartData(state)
  const graphSeries = series.map((oneSeries) => ({
    name: oneSeries.name,
    color: oneSeries.color,
    marker: oneSeries.marker,
    dash: oneSeries.dash,
    points: data
      .filter((row) => state.chartType === 'line' || row[oneSeries.id] !== null)
      .map((row) => ({ x: row.x, y: row[oneSeries.id] })),
  }))

  let pointCount = 0
  for (const oneSeries of graphSeries) {
    pointCount += oneSeries.points.filter((point) => Number.isFinite(point.y)).length
  }

  return {
    pointCount,
    graphProps: {
      series: graphSeries,
      type: state.chartType,
      showPoints: state.showPoints,
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
