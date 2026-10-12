import { useMemo } from 'react'
import { BarChartIcon } from './ui/Icons.jsx'
import ChartFrame from './charts/ChartFrame.jsx'
import LineGraph from './charts/LineGraph.jsx'
import ScatterPlot from './charts/ScatterPlot.jsx'
import SeriesKey from './charts/SeriesKey.jsx'
import useElementWidth from './charts/useElementWidth.js'
import { CHART_HEIGHT, buildChartData, computeScales } from './charts/chartUtils.js'
import './ChartPreview.css'

/*
 * Graph preview panel: title, subtitle, the chart, legend, footer.
 * Gridlines and legend are always shown. The chart is our own SVG:
 *   ChartFrame  -> gridlines, ticks, axis titles   (done)
 *   LineGraph   -> lines, area fill, points        (TODO, see file)
 *   ScatterPlot -> markers                         (TODO, see file)
 *
 * TODO(tooltip): shared hover tooltip for both chart types.
 *   [ ] Keep `const [hover, setHover] = useState(null)` here and pass
 *       `onHover={setHover}` to LineGraph / ScatterPlot.
 *   [ ] Render an absolutely-positioned <div className="chart-preview-tooltip">
 *       over .chart-preview-chart at (hover.px + MARGIN.left, hover.py + MARGIN.top).
 *       Content: "{x column name} {hover.x}" title, then one row per series with
 *       its <SeriesKey>, name, and the value at that x (styles already exist in
 *       ChartPreview.css: .chart-preview-tooltip-*).
 *   [ ] Flip the tooltip to the left of the point near the right edge.
 */
export default function ChartPreview({ state }) {
  const [chartBoxRef, width] = useElementWidth()

  const { data, series } = useMemo(() => buildChartData(state), [state])
  const scales = useMemo(() => computeScales(data, series), [data, series])

  const Marks = state.chartType === 'scatter' ? ScatterPlot : LineGraph
  const pointCount = data.length * series.length

  return (
    <section className="panel chart-preview" aria-label="Graph preview">
      <header className="chart-preview-header">
        <span className="chart-preview-header-icon">
          <BarChartIcon size={14} />
        </span>
        <span>Graph preview</span>
      </header>

      <div className="chart-preview-body">
        <h2 className="chart-preview-title">{state.title}</h2>
        {state.showSubtitle && state.subtitle ? (
          <p className="chart-preview-subtitle">{state.subtitle}</p>
        ) : null}

        <div className="chart-preview-chart" ref={chartBoxRef} style={{ height: CHART_HEIGHT }}>
          {!scales ? (
            <div className="chart-preview-empty">
              Drop a file with at least one numeric row and your graph will show up here.
            </div>
          ) : (
            <ChartFrame
              width={width}
              height={CHART_HEIGHT}
              scales={scales}
              xLabel={state.xLabel}
              yLabel={state.yLabel}
            >
              {(plot) => (
                <Marks
                  {...plot}
                  data={data}
                  series={series}
                  showPoints={state.showPoints}
                  onHover={() => {}}
                />
              )}
            </ChartFrame>
          )}
        </div>

        {series.length > 0 ? (
          <ul className="chart-preview-legend" aria-label="Legend">
            {series.map((s) => (
              <li key={s.id} className="chart-preview-legend-item">
                <SeriesKey series={s} chartType={state.chartType} />
                <span className="chart-preview-legend-label">{s.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
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
