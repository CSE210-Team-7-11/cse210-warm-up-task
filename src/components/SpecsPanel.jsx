// @ts-check

import { useState } from 'react'
import Select from './ui/Select.jsx'
import Toggle from './ui/Toggle.jsx'
import { AlertCircleIcon, ChevronDownIcon, ChevronUpIcon, ResetIcon } from './ui/Icons.jsx'
import SeriesKey from './charts/SeriesKey.jsx'
import { shownMarker } from '../graph/series.js'
import './SpecsPanel.css'

// Which text field the "Titles & labels" pill select edits.
const TITLE_FIELDS = [
	{ value: 'title', label: 'Graph Title' },
	{ value: 'subtitle', label: 'Subtitle' },
]

const TITLE_PLACEHOLDERS = {
	title: 'Graph title',
	subtitle: 'Subtitle',
}

/** Collapsible section: title + chevron header, body only rendered while open. */
function Section({ id, title, open, onToggle, children }) {
	const bodyId = `specs-panel-body-${id}`
	return (
		<section
			className={`specs-panel-section specs-panel-section--${id}${open ? ' is-open' : ''}`}
		>
			<button
				type="button"
				className="specs-panel-section-header"
				aria-expanded={open}
				aria-controls={open ? bodyId : undefined}
				onClick={onToggle}
			>
				<span className="specs-panel-section-title">{title}</span>
				<span className="specs-panel-section-chevron" aria-hidden="true">
					{open ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
				</span>
			</button>
			{open && (
				<div id={bodyId} className="specs-panel-section-body">
					{children}
				</div>
			)}
		</section>
	)
}

/** Label on the left, pill switch pushed to the right. */
function ToggleRow({ label, checked, onChange }) {
	return (
		<div className="specs-panel-toggle-row">
			<span className="specs-panel-row-label">{label}</span>
			<Toggle checked={checked} onChange={onChange} label={label} />
		</div>
	)
}

function SeriesColor({ series, onChange }) {
	const [color, setColor] = useState('#000000')
	return (
		<span className="specs-panel-series-color">
			<input
				type="color"
				value={series.color || color}
				aria-label={`Color for ${series.name}`}
				onChange={(e) =>
					series.color ? onChange(e.target.value) : setColor(e.target.value)
				}
			/>
			{!series.color && (
				<button
					type="button"
					aria-label={`Plot ${series.name}`}
					onClick={() => onChange(color)}
				>
					Plot
				</button>
			)}
		</span>
	)
}

function SeriesShape({ series, chartType, onChange }) {
	const shapes = ['circle', 'square', 'triangle', ...(chartType === 'line' ? ['none'] : [])]
	return (
		<span className="specs-panel-series-shape">
			<SeriesKey series={series} chartType={chartType} />
			<select
				value={shownMarker(series.marker, chartType)}
				aria-label={`Marker shape for ${series.name}`}
				title="Marker shape"
				onChange={(e) => onChange(e.target.value)}
			>
				{shapes.map((shape) => (
					<option key={shape} value={shape}>
						{shape[0].toUpperCase() + shape.slice(1)}
					</option>
				))}
			</select>
		</span>
	)
}

/**
 * Edit presentation settings while keeping dataset ownership in App.
 * Color and marker edits replace the matching series object. Scatter displays
 * a circle for a saved none marker without changing that saved line preference.
 * @param {Object} props - Controlled editor settings and callbacks.
 * @param {EditorState} props.state - Labels, chart type, series styles, and point settings.
 * @param {(patch: EditorSettingsPatch) => void} props.update - Shallow-merges presentation settings in App.
 * @param {() => void} props.onReset - Restores DEFAULT_SPECS only; it preserves
 *   the dataset, chart type, empty-cell policy, and per-series colors and markers.
 * @returns {React.ReactElement} Title, axis, series, and reset controls.
 */
export default function SpecsPanel({ state, update, onReset }) {
	const [open, setOpen] = useState({ titles: true, axes: true, series: true })
	const [titleField, setTitleField] = useState(/** @type {'title'|'subtitle'} */ ('title'))

	const toggleSection = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }))

	return (
		<div className="panel specs-panel">
			<div className="specs-panel-top">
				<h2 className="step-heading">
					<span className="step-num">03</span>
					Graph Specifications
				</h2>
				<div
					className="specs-panel-tabs"
					role="tablist"
					aria-label="Graph specification views"
				>
					<button
						type="button"
						role="tab"
						aria-selected="true"
						className="specs-panel-tab is-active"
					>
						Customize
					</button>
				</div>
			</div>

			<Section
				id="titles"
				title="Titles & labels"
				open={open.titles}
				onToggle={() => toggleSection('titles')}
			>
				<div className="specs-panel-title-select">
					<Select
						variant="compact"
						value={titleField}
						options={TITLE_FIELDS}
						onChange={setTitleField}
						ariaLabel="Text field to edit"
					/>
				</div>
				<input
					type="text"
					className="input specs-panel-text-input"
					value={state[titleField]}
					placeholder={TITLE_PLACEHOLDERS[titleField]}
					aria-label={titleField === 'title' ? 'Graph title' : 'Subtitle'}
					onChange={(e) => update({ [titleField]: e.target.value })}
				/>
				<ToggleRow
					label="Add subtitle"
					checked={state.showSubtitle}
					onChange={(showSubtitle) => update({ showSubtitle })}
				/>
			</Section>

			{/* Axis data is fixed: column 1 of the file is X, the rest are series. Only names are editable. */}
			<Section
				id="axes"
				title="Axis names"
				open={open.axes}
				onToggle={() => toggleSection('axes')}
			>
				<div className="specs-panel-axes-grid">
					<div className="specs-panel-field">
						<label
							className="field-label specs-panel-field-label"
							htmlFor="specs-panel-x-label"
						>
							X-axis label
						</label>
						<input
							id="specs-panel-x-label"
							type="text"
							className="input specs-panel-text-input"
							value={state.xLabel}
							placeholder="Time (months)"
							onChange={(e) => update({ xLabel: e.target.value })}
						/>
					</div>
					<div className="specs-panel-field">
						<label
							className="field-label specs-panel-field-label"
							htmlFor="specs-panel-y-label"
						>
							Y-axis label
						</label>
						<input
							id="specs-panel-y-label"
							type="text"
							className="input specs-panel-text-input"
							value={state.yLabel}
							placeholder="Value"
							onChange={(e) => update({ yLabel: e.target.value })}
						/>
					</div>
				</div>
			</Section>

			<Section
				id="series"
				title="Data series"
				open={open.series}
				onToggle={() => toggleSection('series')}
			>
				{state.series.map((s) => (
					<div className="specs-panel-series-row" key={s.id}>
						{s.color ? (
							<SeriesShape
								series={s}
								chartType={state.chartType}
								onChange={(marker) =>
									update({
										series: state.series.map((oneSeries) =>
											oneSeries.id === s.id
												? { ...oneSeries, marker }
												: oneSeries,
										),
									})
								}
							/>
						) : (
							<span
								className={`specs-panel-series-warning${state.chartType === 'scatter' ? ' is-scatter' : ''}`}
								role="img"
								aria-label="Not plotted: needs an explicit color"
								title="Not plotted: needs an explicit color"
							>
								<AlertCircleIcon size={12} />
							</span>
						)}
						<span className="specs-panel-series-name" title={s.name}>
							{s.name}
						</span>
						<SeriesColor
							series={s}
							onChange={(color) =>
								update({
									series: state.series.map((oneSeries) =>
										oneSeries.id === s.id ? { ...oneSeries, color } : oneSeries,
									),
								})
							}
						/>
					</div>
				))}
				<ToggleRow
					label="Show data points"
					checked={state.showPoints}
					onChange={(showPoints) => update({ showPoints })}
				/>
				{(state.chartType === 'scatter' || state.showPoints) && (
					<div className="specs-panel-field">
						<label
							className="field-label specs-panel-field-label"
							htmlFor="specs-panel-point-size"
						>
							Point size: {state.pointSize}
						</label>
						<input
							id="specs-panel-point-size"
							type="range"
							min="2"
							max="12"
							step="1"
							value={state.pointSize}
							onChange={(e) => update({ pointSize: Number(e.target.value) })}
						/>
					</div>
				)}
			</Section>

			<div className="specs-panel-footer">
				<button type="button" className="specs-panel-reset" onClick={onReset}>
					<ResetIcon size={12} />
					Reset to defaults
				</button>
			</div>
		</div>
	)
}
