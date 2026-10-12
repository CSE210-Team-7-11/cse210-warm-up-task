import { useCallback, useRef, useState } from 'react'
import { MAX_SERIES, allValuesValid, parseDelimited } from '../state.js'
import { AlertCircleIcon, CheckCircleIcon, UploadIcon } from './ui/Icons.jsx'
import './DataPanel.css'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPTED_EXT = /\.(csv|tsv|txt)$/i

/**
 * Step 02: load data from a file. The table is a read-only preview; the only
 * way to change the data is to drop/browse a new CSV or TSV file.
 */
export default function DataPanel({ state, onImport }) {
  const { rows, columns } = state
  const fileInputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')

  const valid = allValuesValid(rows)
  const ignoredColumns = Math.max(0, columns.length - 1 - MAX_SERIES)

  const readFile = useCallback(
    (file) => {
      if (!file) return
      if (!ACCEPTED_EXT.test(file.name)) {
        setFileError(
          /\.xlsx?$/i.test(file.name)
            ? 'XLSX isn’t supported yet — export it as CSV first.'
            : 'Please choose a CSV, TSV or TXT file.',
        )
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        setFileError('That file is over 10 MB.')
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const parsed = parseDelimited(String(reader.result ?? ''))
        if (parsed && parsed.columns.length >= 2) {
          onImport(parsed)
          setFileError('')
        } else {
          setFileError('Need at least two columns: X values, then one or more series.')
        }
      }
      reader.onerror = () => setFileError('Couldn’t read that file.')
      reader.readAsText(file)
    },
    [onImport],
  )

  const openFilePicker = () => fileInputRef.current?.click()

  const onDragLeave = (e) => {
    // Ignore leave events fired when moving between the zone's own children.
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
    setDragging(false)
  }

  return (
    <section className="panel data-panel" aria-labelledby="data-panel-heading">
      <div className="panel-section">
        <div className="data-panel-heading">
          <h2 className="step-heading" id="data-panel-heading">
            <span className="step-num">02</span>
            Add your data
          </h2>
        </div>

        {/* ---- drop zone ---- */}
        <div
          className={`data-panel-dropzone${dragging ? ' is-dragging' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload a data file"
          onClick={openFilePicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openFilePicker()
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!dragging) setDragging(true)
          }}
          onDragLeave={onDragLeave}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            readFile(e.dataTransfer?.files?.[0])
          }}
        >
          <span className="data-panel-dropzone-icon">
            <UploadIcon size={18} />
          </span>
          <span className="data-panel-dropzone-title">Drop a file or browse</span>
          <span className="data-panel-dropzone-hint">CSV or TSV · up to 10 MB</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="data-panel-file-input"
            tabIndex={-1}
            onChange={(e) => {
              readFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        {fileError && (
          <p className="data-panel-error" role="alert">
            {fileError}
          </p>
        )}

        <p className="data-panel-caption">
          {`${rows.length} ${rows.length === 1 ? 'row' : 'rows'} · ${columns.length} columns · first column is X`}
        </p>

        {/* ---- read-only preview table ---- */}
        <div className="data-panel-table-wrap">
          <table className="data-panel-table">
            <colgroup>
              <col className="data-panel-col-num" />
              {columns.map((c) => (
                <col key={c.key} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="data-panel-th data-panel-th-num" scope="col">
                  <span className="data-panel-sr-only">Row</span>
                </th>
                {columns.map((c) => (
                  <th key={c.key} className="data-panel-th" scope="col" title={c.name}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <td className="data-panel-td data-panel-td-num">
                    <span className="data-panel-row-num">{ri + 1}</span>
                  </td>
                  {row.map((v, ci) => {
                    const invalid = v !== '' && typeof v !== 'number'
                    return (
                      <td key={ci} className={`data-panel-td${invalid ? ' is-invalid' : ''}`}>
                        {v === '' ? '—' : String(v)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- validation ---- */}
        <p className={`data-panel-status${valid ? '' : ' is-invalid'}`} role="status">
          <span className="data-panel-status-icon">
            {valid ? <CheckCircleIcon size={14} /> : <AlertCircleIcon size={14} />}
          </span>
          {valid ? 'Looking good. All values are valid.' : 'Some cells aren’t numbers.'}
        </p>
        {ignoredColumns > 0 && (
          <p className="data-panel-caption">
            Only the first {MAX_SERIES} series are plotted ({ignoredColumns} column
            {ignoredColumns === 1 ? '' : 's'} ignored).
          </p>
        )}
      </div>
    </section>
  )
}
