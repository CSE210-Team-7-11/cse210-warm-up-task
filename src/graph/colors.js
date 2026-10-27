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
	return matrix.map((row) =>
		Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])),
	)
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
	return {
		hex,
		normal: oklab(rgb),
		protan: oklab(transform(PROTAN, rgb)),
		deutan: oklab(transform(DEUTAN, rgb)),
	}
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

// Nine OKLab values per candidate: normal, protan, then deutan.
let candidates = null

function isAllowed([lightness, a, b]) {
	return lightness >= 0.43 && lightness <= 0.77 && Math.hypot(a, b) >= 0.1
}

function oklabInto(out, offset, r, g, b) {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
	out[offset] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
	out[offset + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
	out[offset + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
}

function simulatedInto(out, offset, matrix, r, g, b) {
	oklabInto(
		out,
		offset,
		Math.min(1, Math.max(0, matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b)),
		Math.min(1, Math.max(0, matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b)),
		Math.min(1, Math.max(0, matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b)),
	)
}

function getCandidates() {
	if (candidates) {
		return candidates
	}
	const steps = Array.from({ length: 32 }, (_, step) => Math.round((step * 255) / 31))
	const linear = steps.map(toLinear)
	const pairs = steps.map((value) => value.toString(16).padStart(2, '0'))
	const hex = []
	const labs = new Float64Array(32 ** 3 * 9)
	for (let r = 0; r < 32; r++) {
		for (let g = 0; g < 32; g++) {
			for (let b = 0; b < 32; b++) {
				const offset = hex.length * 9
				oklabInto(labs, offset, linear[r], linear[g], linear[b])
				const lightness = labs[offset]
				if (
					lightness < 0.43 ||
					lightness > 0.77 ||
					Math.hypot(labs[offset + 1], labs[offset + 2]) < 0.1
				) {
					continue
				}
				simulatedInto(labs, offset + 3, PROTAN, linear[r], linear[g], linear[b])
				simulatedInto(labs, offset + 6, DEUTAN, linear[r], linear[g], linear[b])
				hex.push('#' + pairs[r] + pairs[g] + pairs[b])
			}
		}
	}
	candidates = { hex, labs: labs.slice(0, hex.length * 9) }
	return candidates
}

const NORMAL_SCALE = (100 / MIN_NORMAL_DIFFERENCE) ** 2
const COLORBLIND_SCALE = (100 / MIN_COLORBLIND_DIFFERENCE) ** 2

// Squared distances preserve ordering without a square root per candidate.
function separationSquaredAt(labs, i, { normal, protan, deutan }) {
	const o = i * 9
	const n0 = labs[o] - normal[0]
	const n1 = labs[o + 1] - normal[1]
	const n2 = labs[o + 2] - normal[2]
	const p0 = labs[o + 3] - protan[0]
	const p1 = labs[o + 4] - protan[1]
	const p2 = labs[o + 5] - protan[2]
	const d0 = labs[o + 6] - deutan[0]
	const d1 = labs[o + 7] - deutan[1]
	const d2 = labs[o + 8] - deutan[2]
	return Math.min(
		(n0 * n0 + n1 * n1 + n2 * n2) * NORMAL_SCALE,
		(p0 * p0 + p1 * p1 + p2 * p2) * COLORBLIND_SCALE,
		(d0 * d0 + d1 * d1 + d2 * d2) * COLORBLIND_SCALE,
	)
}

function candidateAt({ hex, labs }, i) {
	const values = Array.from(labs.subarray(i * 9, i * 9 + 9))
	return {
		hex: hex[i],
		normal: values.slice(0, 3),
		protan: values.slice(3, 6),
		deutan: values.slice(6),
	}
}

function refine(color, used) {
	const closestTo = (candidate) => {
		let closest = Infinity
		for (const other of used) {
			closest = Math.min(closest, separation(candidate, other))
		}
		return closest
	}
	let best = color
	let bestSeparation = closestTo(color)
	let improved = true
	while (improved) {
		improved = false
		const rgb = best.hex
			.slice(1)
			.match(/../g)
			.map((pair) => parseInt(pair, 16))
		for (let channel = 0; channel < 3; channel++) {
			for (const step of [-1, 1]) {
				const next = [...rgb]
				next[channel] += step
				if (next[channel] < 0 || next[channel] > 255) {
					continue
				}
				const candidate = appearance(
					'#' + next.map((value) => value.toString(16).padStart(2, '0')).join(''),
				)
				if (isAllowed(candidate.normal) && closestTo(candidate) > bestSeparation) {
					best = candidate
					bestSeparation = closestTo(candidate)
					improved = true
				}
			}
		}
	}
	return best
}

// Past this many colors, some pair falls below the separation that red-green
// colorblind viewers need, so further series must be given a color.
export const MAX_AUTO_COLORS = 11

// Pick the color with the greatest separation from those already in use.
export function withSeriesColors(series) {
	if (series.every((oneSeries) => oneSeries.color)) {
		return series
	}
	const used = series.map((oneSeries) => appearance(oneSeries.color)).filter(Boolean)
	if (used.length >= MAX_AUTO_COLORS) {
		return series
	}
	const table = getCandidates()
	const { labs } = table
	const count = table.hex.length
	const closest = new Float64Array(count).fill(Infinity)
	for (const color of used) {
		for (let i = 0; i < count; i++) {
			closest[i] = Math.min(closest[i], separationSquaredAt(labs, i, color))
		}
	}

	return series.map((oneSeries) => {
		if (oneSeries.color || used.length >= MAX_AUTO_COLORS) {
			return oneSeries
		}
		let picked = appearance(DEFAULT_COLOR)
		if (used.length > 0) {
			let best = 0
			for (let i = 1; i < count; i++) {
				if (closest[i] > closest[best]) {
					best = i
				}
			}
			picked = refine(candidateAt(table, best), used)
		}
		used.push(picked)
		for (let i = 0; i < count; i++) {
			closest[i] = Math.min(closest[i], separationSquaredAt(labs, i, picked))
		}
		return { ...oneSeries, color: picked.hex }
	})
}
