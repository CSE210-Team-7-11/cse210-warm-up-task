import { el } from './svg.js'
import { marker } from './Marker.js'
import { minMax } from './scale.js'

export const LEGEND_CENTER_Y = 20
export const LABEL_BASELINE_OFFSET = 3
export const LABEL_PADDING = 5
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

export function legendEntries({ sizes, series, toRadius, right }) {
  let entries = []
  if (sizes.length > 0) {
    const { min: smallestSize, max: largestSize } = minMax(sizes)
    const largestSizeThatFitsHeader =
      smallestSize * (MAX_RADIUS_THAT_FITS_HEADER / SMALLEST_DOT_RADIUS) ** 2
    const smallValue = roundToOneSignificantFigure(smallestSize)
    const largeValue = roundToOneSignificantFigure(
      Math.min(largestSize, largestSizeThatFitsHeader)
    )
    const referenceValues = smallValue === largeValue ? [smallValue] : [smallValue, largeValue]
    entries = referenceValues.map((value) => ({ r: toRadius(value), label: String(value) }))
  } else {
    entries = series
      .filter((oneSeries) => oneSeries.name)
      .map((oneSeries) => ({
        r: SMALLEST_DOT_RADIUS,
        label: oneSeries.name,
        color: oneSeries.color,
        shape: oneSeries.marker,
      }))
  }

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

export default function legend(options) {
  return el('g', { class: 'legend' }, legendEntries(options).map(({ r, label, color, shape, x }) =>
    el('g', {}, [
      marker({ shape, color, cx: x + r, cy: LEGEND_CENTER_Y, r }),
      el('text', {
        class: 'label',
        x: x + 2 * r + LABEL_PADDING,
        y: LEGEND_CENTER_Y + LABEL_BASELINE_OFFSET,
        text: label,
      }),
    ])
  ))
}
