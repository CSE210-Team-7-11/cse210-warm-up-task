// @ts-check

import './Toggle.css'

/** Pill switch. `label` is used for accessibility only. */
export default function Toggle({ checked, onChange, label }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			className={`toggle${checked ? ' is-on' : ''}`}
			onClick={() => onChange(!checked)}
		>
			<span className="toggle-knob" />
		</button>
	)
}
