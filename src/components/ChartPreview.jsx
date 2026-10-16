import { useMemo } from 'react'
import { BarChartIcon } from './ui/Icons.jsx'
import Graph from '../graph/Graph.jsx'
import { prepareChart } from './charts/chartAdapter.js'
import './ChartPreview.css'

// the chart is drawn by the graph library in src/graph
export default function ChartPreview({ state }) {
  const { graphProps, pointCount } = useMemo(() => prepareChart(state), [state])

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
          <Graph {...graphProps} />
        )}
      </div>

      <footer className="chart-preview-footer">
        <span>
          {graphProps.series.length} series · {pointCount} data points
        </span>
        <span>Hover over a point to pull up tooltips!</span>
      </footer>
    </section>
  )
}
