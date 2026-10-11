import { useState } from 'react'
import Select from './ui/Select.jsx'
import Toggle from './ui/Toggle.jsx'
import { ChevronDownIcon, ChevronUpIcon, ResetIcon } from './ui/Icons.jsx'
import { LINE_WIDTHS } from '../state.js'
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

const WIDTH_OPTIONS = LINE_WIDTHS.map((w) => ({ value: String(w), label: `${w} px` }))

/** Collapsible section: title + chevron header, body only rendered while open. */
function Section({ id, title, open, onToggle, children }) {
  const bodyId = `specs-panel-body-${id}`
  return (
    <section className={`specs-panel-section specs-panel-section--${id}${open ? ' is-open' : ''}`}>
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

export default function SpecsPanel({ state, handlers }) {
  const { update, setSeriesProp, resetSpecs } = handlers
  const [open, setOpen] = useState({ titles: true, axes: true, series: true, display: true })
  const [titleField, setTitleField] = useState('title')

  const toggleSection = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }))

  const xOptions = state.columns.map((c, i) => ({ value: i, label: c.name }))
  const yOptions = [
    { value: 'both', label: 'Both series' },
    ...state.series.map((s) => ({ value: s.id, label: s.name })),
  ]

  return (
    <div className="panel specs-panel">
      <div className="specs-panel-top">
        <h2 className="step-heading">
          <span className="step-num">03</span>
          Graph Specifications
        </h2>
        <div className="specs-panel-tabs" role="tablist" aria-label="Graph specification views">
          <button type="button" role="tab" aria-selected="true" className="specs-panel-tab is-active">
            Customize
          </button>
        </div>
      </div>

      <Section id="titles" title="Titles & labels" open={open.titles} onToggle={() => toggleSection('titles')}>
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

      <Section id="axes" title="Axes" open={open.axes} onToggle={() => toggleSection('axes')}>
        <div className="specs-panel-axes-grid">
          <div className="specs-panel-field">
            <span className="field-label specs-panel-field-label">X-axis data</span>
            <div className="specs-panel-field-select">
              <Select
                value={state.xColumn}
                options={xOptions}
                onChange={(v) => update({ xColumn: Number(v) })}
                ariaLabel="X-axis data"
              />
            </div>
          </div>
          <div className="specs-panel-field">
            <span className="field-label specs-panel-field-label">Y-axis data</span>
            <div className="specs-panel-field-select">
              <Select
                value={state.yMode}
                options={yOptions}
                onChange={(yMode) => update({ yMode })}
                ariaLabel="Y-axis data"
              />
            </div>
          </div>
          <div className="specs-panel-field">
            <label className="field-label specs-panel-field-label" htmlFor="specs-panel-x-label">
              X-axis label
            </label>
            <input
              id="specs-panel-x-label"
              type="text"
              className="input specs-panel-text-input"
              value={state.xLabel}
              placeholder="Time (Months)"
              onChange={(e) => update({ xLabel: e.target.value })}
            />
          </div>
          <div className="specs-panel-field">
            <label className="field-label specs-panel-field-label" htmlFor="specs-panel-y-label">
              Y-axis label
            </label>
            <input
              id="specs-panel-y-label"
              type="text"
              className="input specs-panel-text-input"
              value={state.yLabel}
              placeholder="Plant height (cm)"
              onChange={(e) => update({ yLabel: e.target.value })}
            />
          </div>
        </div>
      </Section>

      <Section id="series" title="Data series" open={open.series} onToggle={() => toggleSection('series')}>
        {state.series.map((s) => (
          <div className="specs-panel-series-row" key={s.id}>
            <span className="specs-panel-swatch" style={{ background: s.color }} aria-hidden="true" />
            <span className="specs-panel-series-name" title={s.name}>
              {s.name}
            </span>
            <span className="specs-panel-series-width">
              <span
                className="specs-panel-line-sample"
                style={{ background: s.color, height: s.width }}
                aria-hidden="true"
              />
              <span className="specs-panel-width-select">
                <Select
                  variant="compact"
                  value={String(s.width)}
                  options={WIDTH_OPTIONS}
                  onChange={(v) => setSeriesProp(s.id, { width: Number(v) })}
                  ariaLabel={`${s.name} line width`}
                />
              </span>
            </span>
          </div>
        ))}
        <ToggleRow
          label="Show data points"
          checked={state.showPoints}
          onChange={(showPoints) => update({ showPoints })}
        />
      </Section>

      <Section id="display" title="Display" open={open.display} onToggle={() => toggleSection('display')}>
        <ToggleRow label="Gridlines" checked={state.gridlines} onChange={(gridlines) => update({ gridlines })} />
        <ToggleRow label="Legend" checked={state.legend} onChange={(legend) => update({ legend })} />
      </Section>

      <div className="specs-panel-footer">
        <button type="button" className="specs-panel-reset" onClick={resetSpecs}>
          <ResetIcon size={12} />
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
