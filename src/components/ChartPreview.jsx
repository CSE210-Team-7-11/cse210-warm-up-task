import { useMemo } from 'react'
import { BarChartIcon } from './ui/Icons.jsx'
import Graph from '../graph/Graph.jsx'
import { buildChartData } from './charts/chartUtils.js'
import './ChartPreview.css'

// the chart is drawn by the graph library in src/graph
export default function ChartPreview({ state }) {
  const { data, series } = useMemo(() => buildChartData(state), [state])

  // one list of points per column, skipping empty cells
  const graphSeries = series.map((oneSeries) => ({
    name: oneSeries.name,
    color: oneSeries.color,
    marker: oneSeries.marker,
    points: data
      .filter((row) => row[oneSeries.id] !== null)
      .map((row) => ({ x: row.x, y: row[oneSeries.id] })),
  }))

  let pointCount = 0
  for (const oneSeries of graphSeries) {
    pointCount += oneSeries.points.length
  }

  return (
    <section className="panel chart-preview" aria-label="Graph preview">
      <header className="chart-preview-header">
        <span className="chart-preview-header-icon">
          <BarChartIcon size={14} />
        </span>
        <span>Graph preview</span>
      </header>

      <div className="chart-preview-body">
        {pointCount < 2 ? (
          <div className="chart-preview-empty">
            Drop a file with at least two numeric rows and your graph will show up here.
          </div>
        ) : (
          <Graph
            series={graphSeries}
            type={state.chartType}
            showTrendLine
            labels={{
              title: state.title,
              subtitle: state.showSubtitle ? state.subtitle : '',
              x_axis_label: state.xLabel,
              y_axis_label: state.yLabel,
            }}
          />
        )}
      </div>

      <footer className="chart-preview-footer">
        <span>
          {series.length} series · {pointCount} data points
        </span>
        <span>Hover over a point to pull up tooltips!</span>
      </footer>
    </section>
  )
}
