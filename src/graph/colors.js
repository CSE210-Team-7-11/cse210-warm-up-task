/**
 * Automatic series colors chosen by normalized OKLab separation under ordinary,
 * protan, and deutan viewing simulations.
 * @module graph/colors
 */
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

/**
 * Convert one encoded sRGB channel to linear-light RGB. Expects an 8-bit value
 * in [0, 255].
 * @param {number} channel Encoded sRGB channel.
 * @returns {number} Linear-light channel, normally in [0, 1].
 */
function toLinear(channel) {
	const c = channel / 255
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/**
 * Apply a color-vision simulation matrix to linear RGB, returning channels
 * clamped to the displayable [0, 1] range.
 * @param {Array<Array<number>>} matrix Three rows of three coefficients.
 * @param {Array<number>} rgb Linear [red, green, blue] channels.
 * @returns {Array<number>} Three clamped linear RGB channels.
 */
function transform(matrix, rgb) {
	return matrix.map((row) =>
		Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])),
	)
}

/**
 * Convert linear RGB to perceptual OKLab coordinates.
 * @param {Array<number>} rgb Linear [red, green, blue] channels.
 * @returns {Array<number>} [L, a, b] coordinates for perceptual distance calculations.
 */
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

/**
 * Represent a six-digit hex color under normal, protan, and deutan viewing
 * conditions. Unsupported syntax returns null, including other valid CSS colors.
 * @param {string} [hex] Six-digit #RRGGBB string, case-insensitive.
 * @returns {ColorAppearance|null} Appearances, or null for missing/unsupported syntax.
 */
function appearance(hex) {
	const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '')
	if (!match) {
		return null
	}
	/* Simulation matrices operate on linear light, so decode the sRGB bytes before
	 * applying them. Encoded channel values would give different appearances. */
	const rgb = match.slice(1).map((pair) => toLinear(parseInt(pair, 16)))
	return {
		hex,
		normal: oklab(rgb),
		protan: oklab(transform(PROTAN, rgb)),
		deutan: oklab(transform(DEUTAN, rgb)),
	}
}

/**
 * Measure Euclidean OKLab distance on a scale where full lightness spans 100.
 * @param {Array<number>} a First [L, a, b] triple.
 * @param {Array<number>} b Second [L, a, b] triple.
 * @returns {number} Non-negative scaled perceptual distance.
 */
const distance = (a, b) => 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * Score the separation of two colors in their least-separated viewing condition.
 * A score of one meets all three configured distance thresholds.
 * @param {ColorAppearance} a First color.
 * @param {ColorAppearance} b Second color.
 * @returns {number} Minimum normalized separation across viewing conditions.
 */
function separation(a, b) {
	/* Normalize each viewing condition by its own threshold. Taking the minimum
	 * prevents a large normal-vision difference from hiding a simulated collision. */
	return Math.min(
		distance(a.normal, b.normal) / MIN_NORMAL_DIFFERENCE,
		distance(a.protan, b.protan) / MIN_COLORBLIND_DIFFERENCE,
		distance(a.deutan, b.deutan) / MIN_COLORBLIND_DIFFERENCE,
	)
}

/** Shared, read-only search table populated on first use.
 * @type {ColorCandidates|null}
 */
let candidates = null

/**
 * Determine whether a color meets the lightness and chroma limits for automatic
 * palette assignment.
 * @param {Array<number>} lab Normal-vision [L, a, b] coordinates.
 * @returns {boolean} Whether lightness is in [0.43, 0.77] and chroma is at least 0.1.
 */
function isAllowed([lightness, a, b]) {
	return lightness >= 0.43 && lightness <= 0.77 && Math.hypot(a, b) >= 0.1
}

/**
 * Convert linear RGB to OKLab and write the triple at the specified buffer offset.
 * @param {Float64Array} out Destination coordinate buffer, mutated in place.
 * @param {number} offset Index of the first of three available output slots.
 * @param {number} r Linear red channel.
 * @param {number} g Linear green channel.
 * @param {number} b Linear blue channel.
 */
function oklabInto(out, offset, r, g, b) {
	/* Keep this conversion identical to oklab. Writing directly avoids allocating
	 * a temporary array for each appearance of every candidate in the RGB grid. */
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
	out[offset] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
	out[offset + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
	out[offset + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
}

/**
 * Convert a simulated linear RGB color to OKLab and write it at the specified
 * buffer offset. Simulated channels are clamped to [0, 1] before conversion.
 * @param {Float64Array} out Destination coordinate buffer, mutated in place.
 * @param {number} offset Index of the first of three available output slots.
 * @param {Array<Array<number>>} matrix Three-by-three linear RGB simulation matrix.
 * @param {number} r Linear red channel.
 * @param {number} g Linear green channel.
 * @param {number} b Linear blue channel.
 */
function simulatedInto(out, offset, matrix, r, g, b) {
	/* Match transform followed by oklab without intermediate arrays, keeping table
	 * candidates comparable with the separately decoded explicit colors. */
	oklabInto(
		out,
		offset,
		Math.min(1, Math.max(0, matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b)),
		Math.min(1, Math.max(0, matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b)),
		Math.min(1, Math.max(0, matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b)),
	)
}

/**
 * Return automatic-color candidates within the allowed lightness/chroma band.
 * The returned table is shared across calls and must be treated as read-only.
 * @returns {ColorCandidates} Candidate hex strings and packed OKLab coordinates.
 */
function getCandidates() {
	if (candidates) {
		return candidates
	}
	/* Sample 32 levels per channel to bound the grid search, and precompute all
	 * three appearances so series assignment does not repeatedly convert colors. */
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

/**
 * Return the squared normalized separation of a table candidate from a color.
 * @param {Float64Array} labs Packed nine-coordinate candidate records.
 * @param {number} i Zero-based candidate index, locating its record at offset i * 9.
 * @param {ColorAppearance} color Color to compare against.
 * @returns {number} Squared minimum normalized separation across viewing conditions.
 */
function separationSquaredAt(labs, i, { normal, protan, deutan }) {
	/* The search only needs score ordering. Squaring the normalized distances
	 * preserves that ordering while avoiding a square root per candidate. */
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

/**
 * Return an independent color-appearance record for the indexed candidate.
 * @param {ColorCandidates} table Cached search table.
 * @param {number} i Valid candidate index.
 * @returns {ColorAppearance} Independent color record with copied coordinate arrays.
 */
function candidateAt({ hex, labs }, i) {
	const values = Array.from(labs.subarray(i * 9, i * 9 + 9))
	return {
		hex: hex[i],
		normal: values.slice(0, 3),
		protan: values.slice(3, 6),
		deutan: values.slice(6),
	}
}

/**
 * Improve a candidate's separation from the used palette while keeping it within
 * the allowed lightness/chroma band. The result is a local optimum and may miss a
 * better color elsewhere in RGB space.
 * @param {ColorAppearance} color Initial candidate, treated as read-only.
 * @param {Array<ColorAppearance>} used Existing colors that constrain the search, treated as read-only.
 * @returns {ColorAppearance} Best color reached, possibly the original record.
 */
function refine(color, used) {
	/**
	 * Score a candidate against its closest existing color in any viewing condition.
	 * @param {ColorAppearance} candidate Color being considered.
	 * @returns {number} Weakest separation, or Infinity when no colors are in use.
	 */
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
	/* Refine the coarse grid choice with single-step changes to 8-bit RGB channels.
	 * Accept only strictly better scores to prevent cycles among equivalent colors. */
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

/** Budget for six-digit explicit colors and automatically assigned series colors.
 * Repeated explicit colors consume separate slots. Series with explicit colors
 * remain usable after the budget is exhausted.
 * @type {number}
 */
export const MAX_AUTO_COLORS = 11

/**
 * Assign missing series colors while preserving explicit choices. All six-digit
 * hex colors in the input constrain selection and capacity, including duplicates.
 * Other CSS color formats are preserved as given and may coincide with automatic
 * choices. The first automatic color is DEFAULT_COLOR
 * when no recognized colors are in use. Assignment stops at MAX_AUTO_COLORS and
 * leaves any remaining missing colors unset. Automatic choices may fall below the
 * configured separation thresholds.
 * @param {Array<SeriesStyle>} series Requested styles, treated as read-only.
 * @returns {Array<SeriesStyle>} Original array when all colors are set or capacity is
 * already reached. Otherwise returns a new array, copying only styles that receive a color.
 */
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
	/* Keep each candidate's separation from its closest used color. Updating this
	 * minimum after each assignment avoids comparing the whole palette again. */
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
