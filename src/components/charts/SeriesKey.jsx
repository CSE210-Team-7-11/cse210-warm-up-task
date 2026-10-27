import Marker from './Marker.jsx'
import { shownMarker } from '../../graph/series.js'

/**
 * Small legend glyph for a series: a line sample with its dash pattern plus
 * its marker shape (line graph), or just the marker (scatter plot).
 */
export default function SeriesKey({ series, chartType }) {
	const scatter = chartType === 'scatter'
	const width = scatter ? 12 : 24
	return (
		<svg
			className="series-key"
			width={width}
			height={12}
			viewBox={`0 0 ${width} 12`}
			aria-hidden="true"
		>
			{scatter ? null : (
				<line
					x1={1}
					x2={width - 1}
					y1={6}
					y2={6}
					stroke={series.color}
					strokeWidth={2}
					strokeDasharray={series.dash || undefined}
					strokeLinecap="round"
				/>
			)}
			<Marker
				shape={shownMarker(series.marker, chartType)}
				cx={width / 2}
				cy={6}
				size={7}
				fill={series.color}
			/>
		</svg>
	)
}
