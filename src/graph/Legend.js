export const LEGEND_CENTER_Y = 20
export const LABEL_BASELINE_OFFSET = 3
export const LABEL_PADDING = 5
const ENTRY_GAP = 10
const APPROX_CHAR_WIDTH = 5
const DOT_RADIUS = 3

const entryWidth = ({ r, label }) => 2 * r + LABEL_PADDING + label.length * APPROX_CHAR_WIDTH

export function legendEntries({ series, right }) {
  const entries = series
    .filter((oneSeries) => oneSeries.name)
    .map((oneSeries) => ({
      r: DOT_RADIUS,
      label: oneSeries.name,
      color: oneSeries.color,
      shape: oneSeries.marker,
    }))

  const totalWidth = entries.reduce((sum, entry) => sum + entryWidth(entry) + ENTRY_GAP, -ENTRY_GAP)
  const rightAlignedStart = right - totalWidth

  const placedEntries = []
  for (const entry of entries) {
    const previous = placedEntries[placedEntries.length - 1]
    const x = previous ? previous.x + entryWidth(previous) + ENTRY_GAP : rightAlignedStart
    placedEntries.push({ ...entry, x })
  }
  return placedEntries
}
