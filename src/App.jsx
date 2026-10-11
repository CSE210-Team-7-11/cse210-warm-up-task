import { useCallback, useRef, useState } from 'react'
import TopNav from './components/TopNav.jsx'
import TitleBar from './components/TitleBar.jsx'
import ChartTypePicker from './components/ChartTypePicker.jsx'
import DataPanel from './components/DataPanel.jsx'
import ChartPreview from './components/ChartPreview.jsx'
import ExportPanel from './components/ExportPanel.jsx'
import SpecsPanel from './components/SpecsPanel.jsx'
import { DEFAULT_SPECS, initialState } from './state.js'
import './App.css'

export default function App() {
  const [state, setState] = useState(initialState)
  // Ref to the DOM node wrapping the rendered chart (title + svg). Used by ExportPanel.
  const chartRef = useRef(null)

  const update = useCallback((patch) => setState((s) => ({ ...s, ...patch })), [])

  // ---- data handlers ----
  const setCell = useCallback((row, col, value) => {
    setState((s) => {
      const rows = s.rows.map((r, i) => (i === row ? r.map((v, j) => (j === col ? value : v)) : r))
      return { ...s, rows }
    })
  }, [])

  const selectCell = useCallback((row, col) => update({ selectedCell: { row, col } }), [update])

  const addRow = useCallback(() => {
    setState((s) => ({
      ...s,
      rows: [...s.rows, s.columns.map(() => '')],
      selectedCell: { row: s.rows.length, col: 0 },
    }))
  }, [])

  const removeRow = useCallback((row) => {
    setState((s) => ({
      ...s,
      rows: s.rows.filter((_, i) => i !== row),
      selectedCell: null,
    }))
  }, [])

  const setColumnName = useCallback((col, name) => {
    setState((s) => ({
      ...s,
      columns: s.columns.map((c, i) => (i === col ? { ...c, name } : c)),
    }))
  }, [])

  /** Replace the whole dataset (CSV upload / paste). Rebuilds series from columns. */
  const importData = useCallback(({ columns, rows }) => {
    setState((s) => {
      const series = columns.slice(1).map((c, i) => ({
        id: `s${i + 1}`,
        columnIndex: i + 1,
        name: c.name,
        legendLabel: c.name,
        color: DEFAULT_SPECS.series[i % DEFAULT_SPECS.series.length].color,
        width: 2,
      }))
      return { ...s, columns, rows, series, xColumn: 0, yMode: 'both', selectedCell: null }
    })
  }, [])

  // ---- spec handlers ----
  const setSeriesProp = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      series: s.series.map((sr) => (sr.id === id ? { ...sr, ...patch } : sr)),
    }))
  }, [])

  const resetSpecs = useCallback(() => update({ ...DEFAULT_SPECS }), [update])

  const handlers = {
    update,
    setCell,
    selectCell,
    addRow,
    removeRow,
    setColumnName,
    importData,
    setSeriesProp,
    resetSpecs,
  }

  return (
    <div className="app">
      <TopNav userInitials="LK" />
      <main className="page">
        <TitleBar
          graphName={state.graphName}
          onRename={(graphName) => update({ graphName })}
          onNewGraph={() => update({ ...initialState })}
          onExport={() => chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />

        <div className="workspace">
          <aside className="column column-left">
            <ChartTypePicker
              value={state.chartType}
              onChange={(chartType) => update({ chartType })}
            />
            <DataPanel state={state} handlers={handlers} />
          </aside>

          <section className="column column-center">
            <ChartPreview state={state} chartRef={chartRef} />
            <ExportPanel state={state} update={update} chartRef={chartRef} />
          </section>

          <aside className="column column-right">
            <SpecsPanel state={state} handlers={handlers} />
          </aside>
        </div>

        <footer className="page-footer">
          We are selling your data. Don&apos;t say we didn&apos;t warn you.
        </footer>
      </main>
    </div>
  )
}
