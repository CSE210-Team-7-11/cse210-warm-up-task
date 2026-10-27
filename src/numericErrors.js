/**
 * Numeric overflow diagnostics and aggregation for independent calculations.
 * @module numericErrors
 */
import { MAX_DIAGNOSTICS, addDiagnostic, createDiagnostics } from './diagnostics.js'

/** Error for a value exceeding the finite range of 32-bit column storage. */
export class Float32OverflowError extends RangeError {
	/**
	 * Create a column-specific overflow report. Finite original values include a
	 * recommendation to use 64-bit storage.
	 * @param {number} value Value rejected by 32-bit conversion.
	 * @param {string} columnName Source column identified in the message.
	 */
	constructor(value, columnName) {
		/* Changing storage precision can preserve a finite original value, but it
		 * cannot recover an input that is already non-finite. */
		const recommendation = Number.isFinite(value) ? ' Switch to 64-bit mode.' : ''
		super(
			`The value ${value} in "${columnName}" is too large for 32-bit precision.${recommendation}`,
		)
		this.name = 'Float32OverflowError'
	}
}

/** A non-finite input or calculation result, including NaN and infinities. */
export class Float64OverflowError extends RangeError {
	/**
	 * Create an error identifying a rejected value or failed calculation in a column.
	 * @param {number|string} value Rejected value or description of the calculation's input.
	 * @param {string} columnName Column identified in the message.
	 * @param {Object} [options] Additional diagnostic context.
	 * @param {string} [options.calculation] Calculation name, such as 'axis range'.
	 * @param {number} [options.sourceRow] Zero-based source data row, displayed one-based.
	 */
	constructor(value, columnName, { calculation, sourceRow } = {}) {
		const subject = calculation ? `The ${calculation} for ${value}` : `The value ${value}`
		const location = sourceRow === undefined ? '' : ` (source data row ${sourceRow + 1})`
		super(`${subject} in "${columnName}"${location} is too large for 64-bit precision.`)
		this.name = 'Float64OverflowError'
	}
}

/**
 * Multiple numeric failures with bounded retained details. The inherited errors
 * array contains at most MAX_DIAGNOSTICS entries. Use count for the total number
 * of failures, including those whose details were omitted.
 */
export class NumericOverflowErrors extends AggregateError {
	/**
	 * Create an aggregate report with bounded error details and the full failure count.
	 * @param {Array<Error>} errors Individual failures in encounter order.
	 * @param {number} [count] Total failures, including those already omitted by the caller.
	 * Defaults to errors.length and must be at least that length.
	 */
	constructor(errors, count = errors.length) {
		const listed = errors.slice(0, MAX_DIAGNOSTICS)
		const marker = count > listed.length ? '\nList truncated.' : ''
		super(
			listed,
			`${count} numeric overflow errors:\n${listed.map((error) => error.message).join('\n')}${marker}`,
		)
		this.name = 'NumericOverflowErrors'
		/** Total failures, including those omitted from errors.
		 * @type {number}
		 */
		this.count = count
	}
}

/**
 * Determine whether a thrown value is one of the library's numeric errors,
 * including an aggregate.
 * @function
 * @param {unknown} error Thrown value to classify.
 * @returns {boolean} Whether the value is a recognized numeric overflow error.
 */
export const isNumericOverflowError = (error) =>
	error instanceof Float32OverflowError ||
	error instanceof Float64OverflowError ||
	error instanceof NumericOverflowErrors

/**
 * Throw collected failures as the original error for one occurrence or an
 * aggregate for several. Returns normally when the failure count is zero.
 * @param {DiagnosticBuffer<Error>} diagnostics Collected failures with at least one
 * retained error whenever count is positive.
 * @throws {Error} The original retained failure when count is one.
 * @throws {module:numericErrors.NumericOverflowErrors} Multiple failures occurred.
 */
export function throwOverflowErrors({ items, count }) {
	if (count === 1) {
		throw items[0]
	}
	if (count > 1) {
		throw new NumericOverflowErrors(items, count)
	}
}

/**
 * Run synchronous calculations and return their results, collecting numeric
 * failures for a combined report. Unrelated exceptions abort immediately. Multiple
 * numeric failures produce an aggregate with the complete count even when some
 * details were omitted from nested aggregates.
 * @template T
 * @param {Array<function(): T>} calculations Lazy calculations to attempt.
 * @returns {Array<T>} Results in input order, only when all calculations succeeded.
 * @throws {module:numericErrors.Float32OverflowError} The only failure was a 32-bit overflow.
 * @throws {module:numericErrors.Float64OverflowError} The only failure was a 64-bit overflow.
 * @throws {module:numericErrors.NumericOverflowErrors} More than one numeric failure was recorded.
 * @throws {Error} An unrelated exception from a calculation is rethrown unchanged.
 */
export function collectOverflowErrors(calculations) {
	const errors = createDiagnostics()
	const results = calculations.map((calculate) => {
		try {
			return calculate()
		} catch (error) {
			if (!isNumericOverflowError(error)) {
				throw error
			}
			/* Nested aggregates may have already truncated their details. Flatten the
			 * retained errors and then add the omitted count without counting twice. */
			const listed = error instanceof NumericOverflowErrors ? error.errors : [error]
			for (const oneError of listed) {
				addDiagnostic(errors, () => oneError)
			}
			if (error instanceof NumericOverflowErrors) {
				errors.count += error.count - listed.length
			}
			return undefined
		}
	})
	throwOverflowErrors(errors)
	return results
}

/**
 * Require a finite numeric result or throw an error identifying its column and
 * calculation. Detects NaN and infinities, but finite rounding error and underflow
 * to zero pass the check.
 * @param {number} result Calculated value to check.
 * @param {string} columnName Column identified in the failure message.
 * @param {number|string|function(): (number|string)} input Value or lazy description
 * used to explain the failing calculation. A function is evaluated only on failure.
 * @param {string} calculation Calculation name for the diagnostic message.
 * @returns {number} The validated finite result.
 * @throws {module:numericErrors.Float64OverflowError} The result is NaN or infinite.
 */
export function finiteCalculation(result, columnName, input, calculation) {
	if (!Number.isFinite(result)) {
		throw new Float64OverflowError(typeof input === 'function' ? input() : input, columnName, {
			calculation,
		})
	}
	return result
}
