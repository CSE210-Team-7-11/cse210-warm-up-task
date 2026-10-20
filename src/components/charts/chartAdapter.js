import { buildChartData } from './chartUtils.js'

// Keep the editor-to-chart conversion outside the preview component.
export function prepareChart(state, options) {
  const plotted = { ...state, series: state.series.filter((oneSeries) => oneSeries.color) }
  const { columns, series, warnings, warningCount } = buildChartData(plotted, options)
  let pointCount = 0
  // TODO: The SVG renderer still needs point objects, remove on Canvas migration.
  const graphSeries = series.map((oneSeries, s) => {
    const points = []
    for (let i = 0; i < columns.length; i++) {
      const y = columns.ys[s][i]
      const finite = Number.isFinite(y)
      if (finite) pointCount++
      points.push({ x: columns.x[i], y })
    }
    return {
      name: oneSeries.name,
      color: oneSeries.color,
      marker: oneSeries.marker,
      dash: oneSeries.dash,
      points,
    }
  })

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
