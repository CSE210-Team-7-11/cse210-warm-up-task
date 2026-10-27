import { ChevronDownIcon } from './Icons.jsx'
import './Select.css'

/**
 * Styled native <select>.
 * options: Array<{ value, label }>
 * variant: 'default' (full-width field) | 'compact' (inline, auto width)
 */
export default function Select({ value, options, onChange, variant = 'default', ariaLabel }) {
	return (
		<span className={`select select-${variant}`}>
			<select value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
			<span className="select-chevron">
				<ChevronDownIcon size={12} />
			</span>
		</span>
	)
}
