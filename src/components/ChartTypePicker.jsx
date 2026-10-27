import { LineChartIcon, ScatterIcon } from './ui/Icons.jsx'
import './ChartTypePicker.css'

const OPTIONS = [
	{ value: 'scatter', label: 'Scatter plot', Icon: ScatterIcon },
	{ value: 'line', label: 'Line graph', Icon: LineChartIcon },
]

/** Step 01 — pick the graph type. `value` is 'scatter' | 'line'. */
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
