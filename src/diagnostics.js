/**
 * Bounded diagnostic storage for calculations that may report many failures.
 * @module diagnostics
 */

/** Maximum number of retained details. The total occurrence count remains uncapped.
 * @type {number}
 */
export const MAX_DIAGNOSTICS = 10

/**
 * Create an empty collection for bounded diagnostic details and a total count.
 * @function
 * @template T
 * @returns {DiagnosticBuffer<T>} Mutable retained details and total occurrence count.
 */
export const createDiagnostics = () => ({ items: [], count: 0 })

/**
 * Record each occurrence in the count and retain its detail while the collection
 * has room. The factory is evaluated only for details being retained.
 * @template T
 * @param {DiagnosticBuffer<T>} diagnostics Collection mutated in place.
 * @param {function(): T} create Factory for one detail to retain.
 */
export function addDiagnostic(diagnostics, create) {
	diagnostics.count++
	if (diagnostics.items.length < MAX_DIAGNOSTICS) {
		diagnostics.items.push(create())
	}
}
