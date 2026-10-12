import { PlotPlaceholder } from './ChartFrame.jsx'

/**
 * Scatter plot marks, drawn inside ChartFrame's plot area.
 * Same props as LineGraph (data, series, xPos, yPos, plotWidth, plotHeight, onHover).
 *
 * TODO(scatter-plot): replace the placeholder with real marks:
 *   [ ] One <circle> per (point, series) where p[s.id] !== null, at
 *       cx = xPos(p.x), cy = yPos(p[s.id]); r ≈ 3.5, fill = s.color.
 *       Add a 1.5px white stroke so overlapping dots stay distinguishable.
 *   [ ] No connecting lines, no area fill. Points are always shown
 *       (ignore the "Show data points" toggle in this mode).
 *   [ ] Hover: bigger invisible hit circle (r ≈ 8) calling
 *       onHover({ x, seriesId, value, px, py }); onMouseLeave -> onHover(null).
 *       Active dot grows to r=5.
 *   [ ] Decide what series.width means here (suggestion: dot radius = 2 + width/2)
 *       and update the "px" select label in SpecsPanel if it changes meaning.
 *   [ ] Stretch: optional linear trend line per series (least squares).
 */
export default function ScatterPlot({ plotWidth, plotHeight, series }) {
  return (
    <PlotPlaceholder
      plotWidth={plotWidth}
      plotHeight={plotHeight}
      label={`Scatter plot — TODO (${series.length} series)`}
      hint="Implement in src/components/charts/ScatterPlot.jsx"
    />
  )
}
