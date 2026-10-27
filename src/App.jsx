// @ts-check

import { useCallback, useState } from 'react'
import ChartTypePicker from './components/ChartTypePicker.jsx'
import DataPanel from './components/DataPanel.jsx'
import ChartPreview from './components/ChartPreview.jsx'
import SpecsPanel from './components/SpecsPanel.jsx'
import { DEFAULT_SPECS, initialState, seriesFromColumns } from './state.js'
import './App.css'

export default function App() {
	const [state, setState] = useState(initialState)

	const update = useCallback((patch) => setState((s) => ({ ...s, ...patch })), [])

	/** Replace the whole dataset (file drop). Rebuilds series from the new columns. */
	const importData = useCallback(({ columns, numericColumns, issues = [], sourceName }) => {
		setState((s) => ({
			...s,
			sourceName,
			columns,
			rows: undefined,
			numericColumns,
			series: seriesFromColumns(columns),
			parseIssues: issues,
		}))
	}, [])

	const resetSpecs = useCallback(() => update({ ...DEFAULT_SPECS }), [update])

	return (
		<div className="app">
			<main className="page">
				<div className="workspace">
					<aside className="column column-left">
						<ChartTypePicker
							value={state.chartType}
							onChange={(chartType) => update({ chartType })}
						/>
						<DataPanel
							state={state}
							onImport={importData}
							onEmptyCellsChange={(emptyCells) => update({ emptyCells })}
						/>
					</aside>

					<section className="column column-center">
						<ChartPreview state={state} />
					</section>

					<aside className="column column-right">
						<SpecsPanel state={state} update={update} onReset={resetSpecs} />
					</aside>
				</div>
			</main>
			<footer className="page-footer">
				<a href="./home.html">Back to 78js</a>
			</footer>
		</div>
	)
}
