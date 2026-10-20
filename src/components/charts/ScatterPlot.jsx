import { PlotPlaceholder } from './ChartFrame.jsx'

/**
 * Scatter plot marks, drawn inside ChartFrame's plot area.
 * Same props as LineGraph (data, series, xPos, yPos, plotWidth, plotHeight, onHover).
 *
 * TODO(scatter-plot): replace the placeholder with real marks:
 *   [ ] One <Marker> (Marker.jsx) per (point, series) where p[s.id] !== null, at
 *       cx = xPos(p.x), cy = yPos(p[s.id]); size ≈ 8, fill = s.color,
 *       1.5px white stroke so overlapping markers stay distinguishable.
 *   [ ] Colorblind support: shape = s.marker (circle / square / triangle), so
 *       series differ by shape, not only by color. The legend already shows
 *       these shapes (SeriesKey.jsx).
 *   [ ] No connecting lines, no area fill. Markers are always shown
 *       (ignore the "Show data points" toggle in this mode).
 *   [ ] Hover: bigger invisible hit circle (r ≈ 8) calling
 *       onHover({ x, seriesId, value, px, py }); onMouseLeave -> onHover(null).
 *       Active marker grows to size 11.
 *   [ ] Stretch: optional linear trend line per series (least squares),
 *       drawn with the series' dash pattern.
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
