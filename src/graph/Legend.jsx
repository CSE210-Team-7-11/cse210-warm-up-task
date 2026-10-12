const LEGEND_CENTER_Y = 20
const LABEL_BASELINE_OFFSET = 3
const LABEL_PADDING = 5
const ENTRY_GAP = 10
const APPROX_CHAR_WIDTH = 5
const SMALLEST_DOT_RADIUS = 3
const MAX_RADIUS_THAT_FITS_HEADER = 14

const roundToOneSignificantFigure = (value) => {
  if (value <= 0) return value
  const power = 10 ** Math.floor(Math.log10(value))
  return Math.round(value / power) * power
}

const entryWidth = ({ r, label }) => 2 * r + LABEL_PADDING + label.length * APPROX_CHAR_WIDTH

export default function Legend({ sizes, name, toRadius, right }) {
  let entries = []
  if (sizes.length > 0) {
    const smallestSize = Math.min(...sizes)
    const largestSizeThatFitsHeader =
      smallestSize * (MAX_RADIUS_THAT_FITS_HEADER / SMALLEST_DOT_RADIUS) ** 2
    const smallValue = roundToOneSignificantFigure(smallestSize)
    const largeValue = roundToOneSignificantFigure(
      Math.min(Math.max(...sizes), largestSizeThatFitsHeader)
    )
    const referenceValues = smallValue === largeValue ? [smallValue] : [smallValue, largeValue]
    entries = referenceValues.map((value) => ({ r: toRadius(value), label: String(value) }))
  } else if (name) {
    entries = [{ r: SMALLEST_DOT_RADIUS, label: name }]
  }

  const totalWidth = entries.reduce((sum, entry) => sum + entryWidth(entry) + ENTRY_GAP, -ENTRY_GAP)
  const rightAlignedStart = right - totalWidth

  const placedEntries = []
  for (const entry of entries) {
    const previous = placedEntries[placedEntries.length - 1]
    const x = previous ? previous.x + entryWidth(previous) + ENTRY_GAP : rightAlignedStart
    placedEntries.push({ ...entry, x })
  }

  return (
    <g className="legend">
      {placedEntries.map(({ r, label, x }, i) => (
        <g key={i}>
          <circle className="point" cx={x + r} cy={LEGEND_CENTER_Y} r={r} />
          <text
            className="label"
            x={x + 2 * r + LABEL_PADDING}
            y={LEGEND_CENTER_Y + LABEL_BASELINE_OFFSET}
          >
            {label}
          </text>
        </g>
      ))}
    </g>
  )
}
