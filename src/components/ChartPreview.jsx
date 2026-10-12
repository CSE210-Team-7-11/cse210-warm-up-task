import { useMemo } from 'react'
import { BarChartIcon } from './ui/Icons.jsx'
import ChartFrame from './charts/ChartFrame.jsx'
import LineGraph from './charts/LineGraph.jsx'
import ScatterPlot from './charts/ScatterPlot.jsx'
import useElementWidth from './charts/useElementWidth.js'
import { CHART_HEIGHT, buildChartData, computeScales } from './charts/chartUtils.js'
import './ChartPreview.css'

/*
 * Graph preview panel: title, subtitle, the chart, legend, footer.
 * The chart itself is our own SVG (no charting library):
 *   ChartFrame  -> gridlines, ticks, axis titles   (done)
 *   LineGraph   -> lines, area fill, points        (TODO, see file)
 *   ScatterPlot -> dots                            (TODO, see file)
 *
 * TODO(tooltip): shared hover tooltip for both chart types.
 *   [ ] Keep `const [hover, setHover] = useState(null)` here and pass
 *       `onHover={setHover}` to LineGraph / ScatterPlot.
 *   [ ] Render an absolutely-positioned <div className="chart-preview-tooltip">
 *       over .chart-preview-chart at (hover.px + MARGIN.left, hover.py + MARGIN.top).
 *       Content: "{xName} {hover.x}" title, then one row per visible series with
 *       a colored dot, series name, and the value at that x (styles already
 *       exist in ChartPreview.css: .chart-preview-tooltip-*).
 *   [ ] Flip the tooltip to the left of the point near the right edge.
 */
export default function ChartPreview({ state, chartRef }) {
  const [chartBoxRef, width] = useElementWidth()

  const { data, visibleSeries } = useMemo(() => buildChartData(state), [state])
  const scales = useMemo(() => computeScales(data, visibleSeries), [data, visibleSeries])

  const isScatter = state.chartType === 'scatter'
  const Marks = isScatter ? ScatterPlot : LineGraph
  const pointCount = data.length * visibleSeries.length

  return (
    <section className="panel chart-preview" aria-label="Graph preview">
      <header className="chart-preview-header">
        <span className="chart-preview-header-icon">
          <BarChartIcon size={14} />
        </span>
        <span>Graph preview</span>
      </header>

      <div className="chart-preview-body">
        {/* chartRef wraps everything that gets exported (title + chart + legend). */}
        <div className="chart-preview-canvas" ref={chartRef}>
          <h2 className="chart-preview-title" data-export="text">
            {state.title}
          </h2>
          {state.showSubtitle && state.subtitle ? (
            <p className="chart-preview-subtitle" data-export="text">
              {state.subtitle}
            </p>
          ) : null}

          <div className="chart-preview-chart" ref={chartBoxRef} style={{ height: CHART_HEIGHT }}>
            {!scales ? (
              <div className="chart-preview-empty">
                {visibleSeries.length === 0
                  ? 'Pick a data series to plot.'
                  : 'Add a few valid rows and your graph will show up here.'}
              </div>
            ) : (
              <ChartFrame
                width={width}
                height={CHART_HEIGHT}
                scales={scales}
                xLabel={state.xLabel}
                yLabel={state.yLabel}
                gridlines={state.gridlines}
              >
                {(plot) => (
                  <Marks
                    {...plot}
                    data={data}
                    series={visibleSeries}
                    showPoints={state.showPoints}
                    onHover={() => {}}
                  />
                )}
              </ChartFrame>
            )}
          </div>

          {state.legend && visibleSeries.length > 0 ? (
            <ul className="chart-preview-legend" aria-label="Legend">
              {visibleSeries.map((s) => (
                <li key={s.id} className="chart-preview-legend-item">
                  <span
                    className={`chart-preview-legend-swatch${isScatter ? ' is-dot' : ''}`}
                    data-export="swatch"
                    style={{ background: s.color, height: isScatter ? 8 : Math.max(2, s.width) }}
                  />
                  <span className="chart-preview-legend-label" data-export="text">
                    {s.legendLabel || s.name}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <footer className="chart-preview-footer">
        <span>
          {visibleSeries.length} series · {pointCount} data points
        </span>
        <span>Hover over a point to pull up tooltips!</span>
      </footer>
    </section>
  )
}
