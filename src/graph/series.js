import { withSeriesColors } from './colors.js'

export function prepareSeries(series, columns) {
  const colored = withSeriesColors(series)
  const shown = []
  const ys = []
  for (let i = 0; i < colored.length; i++) {
    if (!colored[i].color) continue
    shown.push(colored[i])
    ys.push(columns.ys[i])
  }
  return {
    series: shown,
    columns: shown.length === series.length ? columns : { ...columns, ys },
  }
}
