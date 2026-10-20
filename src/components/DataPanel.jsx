import { useCallback, useMemo, useRef, useState } from 'react'
import { importFile } from '../state.js'
import { isNumericOverflowError } from '../numericErrors.js'
import NumericOverflowAlert from './NumericOverflowAlert.jsx'
import PrecisionWarnings from './PrecisionWarnings.jsx'
import { precisionWarning } from '../precision.js'
import {
  checkFile,
  checkParsed,
  describeIssue,
  findIssues,
  isWarning,
  summarizeData,
} from '../importFeedback.js'
import { AlertCircleIcon, CheckCircleIcon, UploadIcon } from './ui/Icons.jsx'
import Select from './ui/Select.jsx'
import './DataPanel.css'

const EMPTY_CELL_OPTIONS = [
  { value: 'gap', label: 'Gap' },
  { value: 'zero', label: 'Zero' },
  { value: 'connect', label: 'Connect' },
]

/**
 * Step 02: load data from a file. The only way to change the data is to
 * drop/browse a new CSV or TSV file.
 */
export default function DataPanel({ state, onImport, onEmptyCellsChange }) {
  const { sourceName, rows, numericColumns, columns, parseIssues, series, emptyCells } = state
  const fileInputRef = useRef(null)
  const readId = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')

  const summary = useMemo(
    () => summarizeData({ sourceName, columns, rows, numericColumns }),
    [sourceName, columns, rows, numericColumns],
  )
  const issues = useMemo(
    () => findIssues({ parseIssues, series }),
    [parseIssues, series],
  )
  const warnings = issues.filter(isWarning)
  const notes = issues.filter((issue) => !isWarning(issue) && issue[0] !== 'precision-loss' && issue[0] !== 'precision-loss-truncated' &&
    !(issue[0] === 'empty-cell' && emptyCells === 'zero'))
  const precisionWarnings = issues.filter(([type]) => type === 'precision-loss')
    .flatMap(([, cells]) => cells.map(([c, r, text, stored]) => precisionWarning(text, stored, columns[c].name, 64, r)))
  const precisionCount = precisionWarnings.length + (issues.find(([type]) => type === 'precision-loss-truncated')?.[1] ?? 0)

  const readFile = useCallback(
    async (file) => {
      if (!file) return
      const id = ++readId.current
      const fileProblem = checkFile(file)
      if (fileProblem) {
        setFileError(fileProblem)
        return
      }
      try {
        const parsed = await importFile(file, { emptyCells: 'mark' })
        if (id !== readId.current) return
        const parseProblem = checkParsed(parsed, file.name)
        if (parseProblem) {
          setFileError(parseProblem)
          return
        }
        onImport({ ...parsed, sourceName: file.name })
        setFileError('')
      } catch (error) {
        if (id === readId.current) setFileError(isNumericOverflowError(error) ? error : `Couldn’t read ${file.name}. Try choosing it again.`)
      }
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
          <span className="data-panel-dropzone-hint">CSV or TSV</span>
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
        <div className="data-panel-option">
          <span className="field-label" aria-hidden="true">Empty cells</span>
          <Select variant="compact" value={emptyCells} options={EMPTY_CELL_OPTIONS} onChange={onEmptyCellsChange} ariaLabel="Empty cells" />
        </div>
        {fileError && (typeof fileError === 'string' ? (
          <p className="data-panel-error" role="alert">
            {fileError} Your current data is unchanged.
          </p>
        ) : (
          <NumericOverflowAlert error={fileError} className="data-panel-error">
            The file was not imported. Your current data is unchanged.
          </NumericOverflowAlert>
        ))}

        <p className="data-panel-caption data-panel-summary">
          {`${summary.sourceName} · ${summary.rowCount} ${summary.rowCount === 1 ? 'row' : 'rows'} · ${summary.seriesCount} series`}
          <br />
          {`X: ${summary.xName}${formatRange(summary.xRange)}`}
        </p>

        {/* ---- validation ---- */}
        <div className="data-panel-feedback" role="status">
          {warnings.length === 0 && precisionWarnings.length === 0 ? (
            <p className="data-panel-status">
              <span className="data-panel-status-icon">
                <CheckCircleIcon size={14} />
              </span>
              Looking good. All values are valid.
            </p>
          ) : (
            warnings.map((issue) => (
              <p key={issue[0]} className="data-panel-status is-invalid">
                <span className="data-panel-status-icon">
                  <AlertCircleIcon size={14} />
                </span>
                {describeIssue(issue, { columns })}
              </p>
            ))
          )}
          {notes.map((issue) => (
            <p key={issue[0]} className="data-panel-caption">
              {describeIssue(issue, { columns })}
            </p>
          ))}
          <PrecisionWarnings warnings={precisionWarnings} count={precisionCount} />
        </div>
      </div>
    </section>
  )
}

function formatRange(range) {
  if (!range) return ''
  const [min, max] = range
  return min === max ? `, ${min}` : `, ${min} to ${max}`
}
