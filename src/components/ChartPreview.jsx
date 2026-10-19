import { useLayoutEffect, useMemo, useRef } from 'react'
import { BarChartIcon } from './ui/Icons.jsx'
import { createChart } from '../graph/Graph.js'
import { prepareChart } from './charts/chartAdapter.js'
import './ChartPreview.css'

function GraphView({ graphProps }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)

  useLayoutEffect(() => {
    chartRef.current = createChart(containerRef.current)
    return () => {
      chartRef.current.destroy()
      chartRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    chartRef.current.update(graphProps)
  }, [graphProps])

  return <div ref={containerRef} />
}

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
          <GraphView graphProps={graphProps} />
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
