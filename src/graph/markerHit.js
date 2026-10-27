// @ts-check

/**
 * Geometric hit testing for the marker paths used by the canvas renderer.
 * @module graph/markerHit
 */

/**
 * Determine whether a point lies inside a marker, including optional outline
 * expansion. Unknown or omitted shapes use a circle. Returns false for 'none'
 * or a non-positive radius.
 * @param {MarkerShape|undefined} shape Marker geometry.
 * @param {number} dx Pointer X minus marker center X in logical chart units.
 * @param {number} dy Pointer Y minus marker center Y, increasing downward.
 * @param {number} radius Half the nominal marker size.
 * @param {number} [outline=0] Non-negative outward hit tolerance in logical units.
 * @returns {boolean} Whether the pointer is inside the expanded footprint.
 */
export function containsMarker(shape, dx, dy, radius, outline = 0) {
	/* Match markerPath's rounded corners and triangle offsets. A circular-radius
	 * test would include empty space near a triangle and miss a square's corners. */
	if (!(radius > 0) || shape === 'none') {
		return false
	}
	if (shape === 'square') {
		const corner = Math.min(1, radius)
		const x = Math.max(0, Math.abs(dx) - radius + corner)
		const y = Math.max(0, Math.abs(dy) - radius + corner)
		return (
			Math.hypot(x, y) <= corner + outline &&
			Math.abs(dx) <= radius + outline &&
			Math.abs(dy) <= radius + outline
		)
	}
	if (shape === 'triangle') {
		const top = -radius * 1.1 - 0.5
		const bottom = radius * 1.1
		const halfWidth = radius + 0.5
		const slope = halfWidth / (bottom - top)
		return (
			dy <= bottom + outline &&
			Math.abs(dx) <= slope * (dy - top) + outline * Math.hypot(1, slope)
		)
	}
	return Math.hypot(dx, dy) <= radius + outline
}
