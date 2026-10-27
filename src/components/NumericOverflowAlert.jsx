import { NumericOverflowErrors } from '../numericErrors.js'
import './NumericOverflowAlert.css'

export default function NumericOverflowAlert({ error, className, children }) {
	return (
		<div className={className} role="alert">
			{error instanceof NumericOverflowErrors ? (
				<>
					<p>{error.count} numeric overflow errors:</p>
					<ul className="numeric-overflow-errors">
						{error.errors.map((oneError, index) => (
							<li key={index}>{oneError.message}</li>
						))}
					</ul>
					{error.count > error.errors.length && (
						<p>
							List truncated. Showing the first {error.errors.length} of {error.count}{' '}
							errors.
						</p>
					)}
				</>
			) : (
				<p>{error.message}</p>
			)}
			{children && <p>{children}</p>}
		</div>
	)
}
