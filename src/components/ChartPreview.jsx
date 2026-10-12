import { useMemo } from 'react'
import { BarChartIcon } from './ui/Icons.jsx'
import Graph from '../graph/Graph.jsx'
import { buildChartData } from './charts/chartUtils.js'
import './ChartPreview.css'

/*
 * Graph preview panel. The chart itself (title, axes, legend, tooltip) is
 * drawn by the graph library in src/graph.
 */
export default function ChartPreview({ state }) {
  const { data, series } = useMemo(() => buildChartData(state), [state])

  // the graph library draws one series so we show the first data column
  const shown = series[0]
  const points = shown
    ? data.filter((row) => row[shown.id] !== null).map((row) => ({ x: row.x, y: row[shown.id] }))
    : []

  return (
    <section className="panel chart-preview" aria-label="Graph preview">
      <header className="chart-preview-header">
        <span className="chart-preview-header-icon">
          <BarChartIcon size={14} />
        </span>
        <span>Graph preview</span>
      </header>

      <div className="chart-preview-body">
        {points.length < 2 ? (
          <div className="chart-preview-empty">
            Drop a file with at least two numeric rows and your graph will show up here.
          </div>
        ) : (
          <Graph
            points={points}
            type={state.chartType}
            showTrendLine
            labels={{
              title: state.title,
              subtitle: state.showSubtitle ? state.subtitle : '',
              x_axis_label: state.xLabel,
              y_axis_label: state.yLabel,
              legend: shown.name,
            }}
          />
        )}
      </div>

      <footer className="chart-preview-footer">
        <span>{points.length} data points</span>
        <span>Hover over a point to pull up tooltips!</span>
      </footer>
    </section>
  )
}
