// @ts-check

import { LineChartIcon, ScatterIcon } from './ui/Icons.jsx'
import './ChartTypePicker.css'

/** @type {Array<{value: 'scatter'|'line', label: string, Icon: typeof LineChartIcon}>} */
const OPTIONS = [
	{ value: 'scatter', label: 'Scatter plot', Icon: ScatterIcon },
	{ value: 'line', label: 'Line graph', Icon: LineChartIcon },
]

/**
 * Select the chart type without replacing the dataset or series settings.
 * @param {Object} props - Controlled selection and callback.
 * @param {string} props.value - Currently selected chart type.
 * @param {(value: string) => void} props.onChange - Receives scatter or line.
 * @returns {React.ReactElement} Buttons exposing the selected type with aria-pressed.
 */
export default function ChartTypePicker({ value, onChange }) {
	return (
		<section className="panel chart-type-picker" aria-labelledby="chart-type-picker-heading">
			<div className="panel-section">
				<h2 className="step-heading" id="chart-type-picker-heading">
					<span className="step-num">01</span>
					Choose your graph
				</h2>

				<div className="chart-type-picker-grid" role="group" aria-label="Graph type">
					{OPTIONS.map(({ value: option, label, Icon }) => {
						const selected = option === value
						return (
							<button
								key={option}
								type="button"
								aria-pressed={selected}
								className={`chart-type-picker-card${selected ? ' is-selected' : ''}`}
								onClick={() => onChange(option)}
							>
								<span className="chart-type-picker-icon">
									<Icon size={20} />
								</span>
								<span className="chart-type-picker-label">{label}</span>
							</button>
						)
					})}
				</div>
			</div>
		</section>
	)
}
