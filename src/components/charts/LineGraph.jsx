import { PlotPlaceholder } from './ChartFrame.jsx'

/**
 * Line graph marks, drawn inside ChartFrame's plot area.
 *
 * Props
 *   data        [{ x, s1, s2, ... }] sorted by x; a series value may be null (bad/empty cell)
 *   series      visible series: [{ id, name, color, width }]
 *   xPos, yPos  data -> pixel functions from ChartFrame
 *   plotWidth, plotHeight
 *   showPoints  "Show data points" toggle
 *   onHover     (point | null) => void — for the shared tooltip (see ChartPreview TODO)
 *
 * TODO(line-graph): replace the placeholder with real marks:
 *   [ ] One <path> per series: build "M x0 y0 L x1 y1 ..." from data with
 *       xPos(p.x) / yPos(p[s.id]). Straight segments (mockup is not smoothed).
 *       Skip null values (start a new "M" segment after a gap).
 *       stroke = s.color, strokeWidth = s.width, fill none, round joins/caps.
 *   [ ] Soft area fill under the FIRST series only: same path closed down to
 *       yPos(0), filled with a vertical <linearGradient> from s.color @ 14%
 *       opacity to 0%. Give the gradient a unique id (React useId).
 *   [ ] When showPoints is on: <circle r={3}> at each point, fill = s.color.
 *   [ ] Hover: an invisible wider hit target per point (r ≈ 8) calling
 *       onHover({ x, seriesId, value, px, py }); onMouseLeave -> onHover(null).
 *       Active point gets r=5 with a 2px white ring.
 *   [ ] Draw the series in order so series 1 sits on top (render reversed).
 */
export default function LineGraph({ plotWidth, plotHeight, series }) {
  return (
    <PlotPlaceholder
      plotWidth={plotWidth}
      plotHeight={plotHeight}
      label={`Line graph — TODO (${series.length} series)`}
      hint="Implement in src/components/charts/LineGraph.jsx"
    />
  )
}
