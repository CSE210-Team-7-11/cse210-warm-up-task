/**
 * Shared visual defaults for the canvas renderer.
 * @module graph/theme
 */

/** First automatic palette color and fallback for uncolored drawing primitives.
 * @type {string}
 */
export const DEFAULT_COLOR = '#256b47'

/** Canvas drawing styles with sizes expressed in logical chart units.
 * @type {ChartTheme}
 */
export const THEME = {
	title: { size: 16, weight: 600, color: '#1c1f1a' },
	subtitle: { size: 9, weight: 400, color: '#8a8f85' },
	label: { size: 8, weight: 400, color: '#6f746a' },
	axis: '#c9cdc4',
	gridline: '#e8eae4',
	outline: '#fff',
	tooltip: { background: '#ffffff', border: '#eaede3', text: '#20382c', muted: '#8a968c' },
}
