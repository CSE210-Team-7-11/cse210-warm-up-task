import { DEFAULT_COLOR } from './theme.js'

const MIN_NORMAL_DIFFERENCE = 15
const MIN_COLORBLIND_DIFFERENCE = 8

// Machado et al. 2009 matrices that simulate red-green color blindness in linear RGB
const PROTAN = [
  [0.152286, 1.052583, -0.204868],
  [0.114503, 0.786281, 0.099216],
  [-0.003882, -0.048116, 1.051998],
]
const DEUTAN = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
]

function toLinear(channel) {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function transform(matrix, rgb) {
  return matrix.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])))
}

function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function appearance(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '')
  if (!match) {
    return null
  }
  const rgb = match.slice(1).map((pair) => toLinear(parseInt(pair, 16)))
  return { hex, normal: oklab(rgb), protan: oklab(transform(PROTAN, rgb)), deutan: oklab(transform(DEUTAN, rgb)) }
}

const distance = (a, b) => 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// 1 or more means the two colors are far enough apart for everyone
function separation(a, b) {
  return Math.min(
    distance(a.normal, b.normal) / MIN_NORMAL_DIFFERENCE,
    distance(a.protan, b.protan) / MIN_COLORBLIND_DIFFERENCE,
    distance(a.deutan, b.deutan) / MIN_COLORBLIND_DIFFERENCE,
  )
}

let candidates = null

function isAllowed(color) {
  const [lightness, a, b] = color.normal
  return lightness >= 0.43 && lightness <= 0.77 && Math.hypot(a, b) >= 0.1
}

function getCandidates() {
  if (!candidates) {
    candidates = []
    for (let r = 0; r < 32; r++) {
      for (let g = 0; g < 32; g++) {
        for (let b = 0; b < 32; b++) {
          const hex = '#' + [r, g, b].map((step) => Math.round((step * 255) / 31).toString(16).padStart(2, '0')).join('')
          const color = appearance(hex)
          if (isAllowed(color)) {
            candidates.push(color)
          }
        }
      }
    }
  }
  return candidates
}

function refine(color, used) {
  const closestTo = (candidate) => Math.min(Infinity, ...used.map((other) => separation(candidate, other)))
  let best = color
  let bestSeparation = closestTo(color)
  let improved = true
  while (improved) {
    improved = false
    const rgb = best.hex.slice(1).match(/../g).map((pair) => parseInt(pair, 16))
    for (let channel = 0; channel < 3; channel++) {
      for (const step of [-1, 1]) {
        const next = [...rgb]
        next[channel] += step
        if (next[channel] < 0 || next[channel] > 255) {
          continue
        }
        const candidate = appearance('#' + next.map((value) => value.toString(16).padStart(2, '0')).join(''))
        if (isAllowed(candidate) && closestTo(candidate) > bestSeparation) {
          best = candidate
          bestSeparation = closestTo(candidate)
          improved = true
        }
      }
    }
  }
  return best
}

// gives each series without a color the one that differs most from the colors in use (readable up to 12 series)
export function withSeriesColors(series) {
  if (series.every((oneSeries) => oneSeries.color)) {
    return series
  }
  const used = series.map((oneSeries) => appearance(oneSeries.color)).filter(Boolean)
  const closest = getCandidates().map((candidate) => Math.min(Infinity, ...used.map((color) => separation(candidate, color))))

  return series.map((oneSeries) => {
    if (oneSeries.color) {
      return oneSeries
    }
    let picked = appearance(DEFAULT_COLOR)
    if (used.length > 0) {
      let best = 0
      for (let i = 1; i < closest.length; i++) {
        if (closest[i] > closest[best]) {
          best = i
        }
      }
      picked = refine(candidates[best], used)
    }
    used.push(picked)
    candidates.forEach((candidate, i) => {
      closest[i] = Math.min(closest[i], separation(candidate, picked))
    })
    return { ...oneSeries, color: picked.hex }
  })
}
