import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BarChartIcon } from './ui/Icons.jsx'
import { createChart } from '../graph/Graph.js'
import { prepareChart } from './charts/chartAdapter.js'
import { isNumericOverflowError } from '../numericErrors.js'
import NumericOverflowAlert from './NumericOverflowAlert.jsx'
import PrecisionWarnings from './PrecisionWarnings.jsx'
import './ChartPreview.css'

function GraphView({ graphProps, onRenderResult }) {
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
    try {
      chartRef.current.update(graphProps)
      onRenderResult(null)
    } catch (error) {
      if (!isNumericOverflowError(error)) throw error
      onRenderResult(error)
    }
  }, [graphProps, onRenderResult])

  return <div ref={containerRef} />
}

// the chart is drawn by the graph library in src/graph
export default function ChartPreview({ state, precision = 'float64' }) {
  const { graphProps, pointCount, warnings = [], error: preparationError } = useMemo(() => {
    try {
      return prepareChart(state, { precision })
    } catch (error) {
      if (!isNumericOverflowError(error)) throw error
      return { error }
    }
  }, [state, precision])
  const [renderFailure, setRenderFailure] = useState(null)
  const onRenderResult = useCallback((error) => {
    setRenderFailure(error ? { graphProps, error } : null)
  }, [graphProps])
  const error = preparationError || (renderFailure?.graphProps === graphProps ? renderFailure.error : null)

  return (
    <section className="panel chart-preview" aria-label="Graph preview">
      <header className="chart-preview-header">
        <span className="chart-preview-header-icon">
          <BarChartIcon size={14} />
        </span>
        <span>Graph preview</span>
      </header>

      <div className="chart-preview-body">
        {error ? (
          <NumericOverflowAlert error={error} className="chart-preview-error" />
        ) : pointCount < 2 ? (
          <div className="chart-preview-empty">
            Drop a file with at least two numeric rows and your graph will show up here.
          </div>
        ) : (
          <GraphView graphProps={graphProps} onRenderResult={onRenderResult} />
        )}
        <PrecisionWarnings warnings={warnings} />
      </div>

      {!error && (
        <footer className="chart-preview-footer">
          <span>
            {graphProps.series.length} series · {pointCount} data points
          </span>
          <span>Hover over a point to pull up tooltips!</span>
        </footer>
      )}
    </section>
  )
}
