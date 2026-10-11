import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_COLUMNS, DEFAULT_ROWS, allValuesValid, parseCell, parseDelimited } from '../state.js'
import { AlertCircleIcon, CheckCircleIcon, EllipsisIcon, PlusIcon, UploadIcon } from './ui/Icons.jsx'
import './DataPanel.css'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPTED_EXT = /\.(csv|tsv|txt)$/i
const PASTE_PLACEHOLDER = 'Month, Smitskis, $ x 10\n0, 4, 40\n2, 6, 38'

/** Step 02 — upload / edit the dataset. Receives the full editor state + handlers. */
export default function DataPanel({ state, handlers }) {
  const { rows, columns, selectedCell } = state

  const fileInputRef = useRef(null)
  const inputRefs = useRef(new Map())
  const focusAfterAdd = useRef(false)
  const menuRef = useRef(null)

  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  // Text the user is currently typing in a cell. Kept separate from state so
  // intermediate strings like "1." or "-" are not normalised away mid-keystroke.
  const [draft, setDraft] = useState(null)

  const valid = allValuesValid(rows)

  // ---- importing -------------------------------------------------------
  const importText = useCallback(
    (text) => {
      const parsed = parseDelimited(text)
      if (!parsed) return false
      handlers.importData(parsed)
      return true
    },
    [handlers],
  )

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
        const ok = importText(String(reader.result ?? ''))
        setFileError(ok ? '' : 'Couldn’t find any rows in that file.')
      }
      reader.onerror = () => setFileError('Couldn’t read that file.')
      reader.readAsText(file)
    },
    [importText],
  )

  const openFilePicker = () => fileInputRef.current?.click()

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    readFile(e.dataTransfer?.files?.[0])
  }

  const onDragLeave = (e) => {
    // Ignore leave events fired when moving between the zone's own children.
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
    setDragging(false)
  }

  const importPasted = () => {
    if (importText(pasteText)) {
      setPasteText('')
      setPasteError('')
      setPasteOpen(false)
    } else {
      setPasteError('Nothing to import — paste comma- or tab-separated rows.')
    }
  }

  // ---- "..." menu --------------------------------------------------------
  useEffect(() => {
    if (!menuOpen) return undefined
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const loadSample = () => {
    handlers.importData({ columns: DEFAULT_COLUMNS, rows: DEFAULT_ROWS })
    setMenuOpen(false)
  }

  const clearRows = () => {
    handlers.update({ rows: [columns.map(() => '')], selectedCell: null })
    setMenuOpen(false)
  }

  // ---- cell editing + keyboard navigation --------------------------------
  const cellKey = (r, c) => `${r}:${c}`

  const registerInput = (r, c) => (el) => {
    const key = cellKey(r, c)
    if (el) inputRefs.current.set(key, el)
    else inputRefs.current.delete(key)
  }

  const focusCell = (r, c) => {
    const el = inputRefs.current.get(cellKey(r, c))
    if (!el) return
    el.focus()
    el.select()
  }

  const addRow = () => {
    focusAfterAdd.current = true
    handlers.addRow()
  }

  // After "+ Add row" (or Enter on the last row) move the caret into the new row.
  useEffect(() => {
    if (!focusAfterAdd.current || !selectedCell) return
    focusAfterAdd.current = false
    focusCell(selectedCell.row, selectedCell.col)
  }, [selectedCell, rows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const onCellKeyDown = (e, r, c) => {
    const el = e.currentTarget
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
    let next = null

    switch (e.key) {
      case 'ArrowDown':
      case 'Enter':
        next = [r + 1, c]
        break
      case 'ArrowUp':
        next = [r - 1, c]
        break
      case 'ArrowLeft':
        if (atStart) next = [r, c - 1]
        break
      case 'ArrowRight':
        if (atEnd) next = [r, c + 1]
        break
      case 'Escape':
        el.blur()
        return
      default:
        return
    }
    if (!next) return
    const [nr, nc] = next
    if (nr < 0 || nc < 0 || nc >= columns.length) return
    e.preventDefault()
    if (nr >= rows.length) {
      if (e.key === 'Enter') addRow()
      return
    }
    focusCell(nr, nc)
  }

  const displayValue = (r, c, v) =>
    draft && draft.row === r && draft.col === c ? draft.text : v === '' ? '' : String(v)

  return (
    <section className="panel data-panel" aria-labelledby="data-panel-heading">
      <div className="panel-section">
        {/* ---- heading ---- */}
        <div className="data-panel-heading">
          <h2 className="step-heading" id="data-panel-heading">
            <span className="step-num">02</span>
            Add your data
          </h2>
          <div className="data-panel-menu" ref={menuRef}>
            <button
              type="button"
              className="data-panel-more"
              aria-label="More data options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <EllipsisIcon size={16} />
            </button>
            {menuOpen && (
              <div className="data-panel-menu-list" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="data-panel-menu-item"
                  onClick={() => {
                    setPasteOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  Paste data
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="data-panel-menu-item"
                  onClick={loadSample}
                >
                  Load sample data
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="data-panel-menu-item is-danger"
                  onClick={clearRows}
                >
                  Clear all rows
                </button>
              </div>
            )}
          </div>
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
          onDrop={onDrop}
        >
          <span className="data-panel-dropzone-icon">
            <UploadIcon size={18} />
          </span>
          <span className="data-panel-dropzone-title">Drop a file or browse</span>
          <span className="data-panel-dropzone-hint">CSV, XLSX or TSV · up to 10 MB</span>
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
          {`${rows.length} ${rows.length === 1 ? 'row' : 'rows'} · ${columns.length} ${
            columns.length === 1 ? 'column' : 'columns'
          }`}
        </p>

        {/* ---- table ---- */}
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
              {rows.map((row, ri) => {
                const rowSelected = selectedCell?.row === ri
                return (
                  <tr key={ri} className={rowSelected ? 'is-selected' : undefined}>
                    <td className="data-panel-td data-panel-td-num">
                      <button
                        type="button"
                        className="data-panel-row-btn"
                        title={`Remove row ${ri + 1}`}
                        aria-label={`Remove row ${ri + 1}`}
                        disabled={rows.length <= 1}
                        onClick={() => handlers.removeRow(ri)}
                      >
                        <span className="data-panel-row-num">{ri + 1}</span>
                        <span className="data-panel-row-x" aria-hidden="true">
                          ×
                        </span>
                      </button>
                    </td>
                    {row.map((v, ci) => {
                      const cellSelected = rowSelected && selectedCell.col === ci
                      const invalid = v !== '' && typeof v !== 'number'
                      const tdClass =
                        'data-panel-td' +
                        (cellSelected ? ' is-selected' : '') +
                        (invalid ? ' is-invalid' : '')
                      return (
                        <td key={ci} className={tdClass}>
                          <input
                            ref={registerInput(ri, ci)}
                            className="data-panel-cell-input"
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            aria-label={`${columns[ci]?.name ?? `Column ${ci + 1}`}, row ${ri + 1}`}
                            aria-invalid={invalid || undefined}
                            value={displayValue(ri, ci, v)}
                            onFocus={() => {
                              setDraft({ row: ri, col: ci, text: v === '' ? '' : String(v) })
                              handlers.selectCell(ri, ci)
                            }}
                            onBlur={() => setDraft(null)}
                            onChange={(e) => {
                              const text = e.target.value
                              setDraft({ row: ri, col: ci, text })
                              handlers.setCell(ri, ci, parseCell(text))
                            }}
                            onKeyDown={(e) => onCellKeyDown(e, ri, ci)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ---- actions ---- */}
        <div className="data-panel-actions">
          <button type="button" className="btn-link data-panel-add-row" onClick={addRow}>
            <PlusIcon size={12} />
            Add row
          </button>
          <button
            type="button"
            className="data-panel-paste-toggle"
            aria-expanded={pasteOpen}
            aria-controls="data-panel-paste"
            onClick={() => setPasteOpen((o) => !o)}
          >
            Paste data
          </button>
        </div>

        {pasteOpen && (
          <div className="data-panel-paste" id="data-panel-paste">
            <textarea
              className="data-panel-paste-textarea"
              rows={4}
              placeholder={PASTE_PLACEHOLDER}
              aria-label="Paste comma- or tab-separated data"
              value={pasteText}
              autoFocus
              onChange={(e) => {
                setPasteText(e.target.value)
                if (pasteError) setPasteError('')
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') importPasted()
              }}
            />
            {pasteError && (
              <p className="data-panel-error" role="alert">
                {pasteError}
              </p>
            )}
            <div className="data-panel-paste-actions">
              <button
                type="button"
                className="btn btn-primary data-panel-paste-import"
                disabled={!pasteText.trim()}
                onClick={importPasted}
              >
                Import
              </button>
              <button
                type="button"
                className="data-panel-paste-cancel"
                onClick={() => {
                  setPasteOpen(false)
                  setPasteText('')
                  setPasteError('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ---- validation ---- */}
        <p className={`data-panel-status${valid ? '' : ' is-invalid'}`} role="status">
          <span className="data-panel-status-icon">
            {valid ? <CheckCircleIcon size={14} /> : <AlertCircleIcon size={14} />}
          </span>
          {valid ? 'Looking good. All values are valid.' : 'Some cells aren’t numbers.'}
        </p>
      </div>
    </section>
  )
}
