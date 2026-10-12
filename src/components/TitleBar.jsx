import { useEffect, useRef, useState } from 'react'
import { ChevronRightIcon, PencilIcon, PlusIcon } from './ui/Icons.jsx'
import './TitleBar.css'

/**
 * Page title bar: breadcrumb + editable graph name + save status on the left,
 * "New graph" action on the right.
 */
export default function TitleBar({ graphName, onRename, onNewGraph }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(graphName)
  const inputRef = useRef(null)
  // Guards against commit/cancel running twice (e.g. Enter followed by the blur
  // the browser fires when the input unmounts).
  const doneRef = useRef(false)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEditing = () => {
    doneRef.current = false
    setDraft(graphName)
    setEditing(true)
  }

  const finishEditing = (save) => {
    if (doneRef.current) return
    doneRef.current = true
    if (save) {
      const next = draft.trim()
      if (next && next !== graphName) onRename(next)
    }
    setEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      finishEditing(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      finishEditing(false)
    }
  }

  return (
    <div className="title-bar">
      <div className="title-bar-main">
        <nav className="title-bar-crumbs" aria-label="Breadcrumb">
          <button type="button" className="title-bar-crumb-link">
            My graphs
          </button>
          <span className="title-bar-crumb-sep" aria-hidden="true">
            <ChevronRightIcon size={14} />
          </span>
          <span className="title-bar-crumb-current" aria-current="page">
            {graphName}
          </span>
        </nav>

        <div className="title-bar-heading">
          {editing ? (
            <span className="title-bar-name-edit" data-value={draft}>
              <input
                ref={inputRef}
                className="title-bar-name-input"
                type="text"
                value={draft}
                aria-label="Graph name"
                spellCheck={false}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => finishEditing(true)}
              />
            </span>
          ) : (
            <>
              <h1 className="title-bar-name">{graphName}</h1>
              <button
                type="button"
                className="title-bar-rename"
                aria-label="Rename graph"
                title="Rename graph"
                onClick={startEditing}
              >
                <PencilIcon size={14} />
              </button>
            </>
          )}

          <span className="title-bar-status" role="status">
            <span className="title-bar-status-dot" aria-hidden="true">
              •
            </span>{' '}
            All changes saved
          </span>
        </div>
      </div>

      <div className="title-bar-actions">
        <button type="button" className="btn btn-primary" onClick={onNewGraph}>
          <PlusIcon size={14} />
          New graph
        </button>
      </div>
    </div>
  )
}
