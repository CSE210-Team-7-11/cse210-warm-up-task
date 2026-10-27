import './PrecisionWarnings.css'

export default function ChartWarnings({ warnings }) {
	if (!warnings.length) {
		return null
	}
	return (
		<div className="precision-warnings" role="status">
			{warnings.map(([type, count]) => (
				<p key={type}>
					{type === 'legend-overflow'
						? `${count} ${count === 1 ? "series doesn't" : "series don't"} fit in the legend.`
						: type}
				</p>
			))}
		</div>
	)
}
