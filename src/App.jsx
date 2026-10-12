import { useCallback, useState } from 'react'
import TopNav from './components/TopNav.jsx'
import TitleBar from './components/TitleBar.jsx'
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
  const importData = useCallback(({ columns, rows }) => {
    setState((s) => ({ ...s, columns, rows, series: seriesFromColumns(columns) }))
  }, [])

  const resetSpecs = useCallback(() => update({ ...DEFAULT_SPECS }), [update])

  return (
    <div className="app">
      <TopNav userInitials="LK" />
      <main className="page">
        <TitleBar
          graphName={state.graphName}
          onRename={(graphName) => update({ graphName })}
          onNewGraph={() => setState(initialState)}
        />

        <div className="workspace">
          <aside className="column column-left">
            <ChartTypePicker
              value={state.chartType}
              onChange={(chartType) => update({ chartType })}
            />
            <DataPanel state={state} onImport={importData} />
          </aside>

          <section className="column column-center">
            <ChartPreview state={state} />
          </section>

          <aside className="column column-right">
            <SpecsPanel state={state} update={update} onReset={resetSpecs} />
          </aside>
        </div>

        <footer className="page-footer">
          We are selling your data. Don&apos;t say we didn&apos;t warn you.
        </footer>
      </main>
    </div>
  )
}
