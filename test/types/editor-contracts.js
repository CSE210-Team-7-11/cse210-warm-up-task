// @ts-check
// Compile-only cases, checked by editor-types.test.js; do not execute this file.

import ChartTypePicker from '../../src/components/ChartTypePicker.jsx'
import DataPanel from '../../src/components/DataPanel.jsx'
import SpecsPanel from '../../src/components/SpecsPanel.jsx'
import { checkParsed, summarizeData } from '../../src/importFeedback.js'
import { initialState } from '../../src/state.js'

export function checkEditorContracts() {
	const columns = [
		{ key: 'c0', name: 'X' },
		{ key: 'c1', name: 'Y' },
	]
	const rows = [[1, 2]]
	const numericColumns = {
		length: 1,
		x: new Float64Array([1]),
		ys: [new Float64Array([2])],
	}
	checkParsed(null, 'empty.csv')
	checkParsed({ columns, rows, issues: [] }, 'rows.csv')
	checkParsed({ columns, numericColumns, issues: [] }, 'typed.csv')
	checkParsed({ columns, rows, numericColumns, issues: [] }, 'both.csv')
	summarizeData({ sourceName: 'rows.csv', columns, rows })
	summarizeData({ sourceName: 'typed.csv', columns, numericColumns })
	summarizeData({ sourceName: 'both.csv', columns, rows, numericColumns })

	// @ts-expect-error A parser result must contain one of the data representations.
	checkParsed({ columns, issues: [] }, 'missing.csv')
	// @ts-expect-error Explicitly undefined representations are also invalid.
	checkParsed({ columns, issues: [], rows: undefined, numericColumns: undefined }, 'missing.csv')
	// @ts-expect-error Summary input cannot omit both representations.
	summarizeData({ sourceName: 'missing.csv', columns })
	// @ts-expect-error Summary input cannot provide undefined data in both fields.
	summarizeData({
		sourceName: 'missing.csv',
		columns,
		rows: undefined,
		numericColumns: undefined,
	})

	/** @type {EditorState} */
	const uploaded = {
		...initialState,
		sourceName: 'typed.csv',
		columns,
		rows: undefined,
		numericColumns,
		parseIssues: [['invalid-x', [2]]],
	}
	summarizeData(initialState)
	summarizeData(uploaded)
	SpecsPanel({ state: uploaded, update: () => {}, onReset: () => {} })
	DataPanel({
		state: uploaded,
		onEmptyCellsChange: () => {},
		onImport(result) {
			/** @type {AcceptedUpload} */
			const accepted = result
			summarizeData(accepted)
		},
	})
	/** @type {AcceptedUpload} */
	// @ts-expect-error An accepted upload must have typed data, not just legacy rows.
	const rejectedUpload = { sourceName: 'rows.csv', columns, rows, issues: [] }
	void rejectedUpload

	ChartTypePicker({
		value: 'line',
		onChange(value) {
			/** @type {'scatter'|'line'} */
			const selected = value
			void selected
		},
	})
	ChartTypePicker({ value: 'scatter', onChange: () => {} })
	// @ts-expect-error Unsupported chart types must not enter the picker.
	ChartTypePicker({ value: 'bar', onChange: () => {} })
	// @ts-expect-error The callback must accept both supported chart types.
	ChartTypePicker({ value: 'line', onChange: (/** @type {'line'} */ value) => void value })
}
