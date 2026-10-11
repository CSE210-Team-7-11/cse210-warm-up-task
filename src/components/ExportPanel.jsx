import { useState } from 'react'
import { EXPORT_FORMATS, RESOLUTIONS } from '../state.js'
import Select from './ui/Select.jsx'
import { DownloadIcon } from './ui/Icons.jsx'
import './ExportPanel.css'

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

function slugify(name) {
  return (
    String(name || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'graph'
  )
}

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  return el
}

/**
 * Rebuild the preview node (title, subtitle, Recharts svg, legend) as one
 * standalone SVG document. HTML text is traced into <text> nodes at its
 * on-screen position; the chart svg is cloned inline; fonts are inlined.
 */
function buildExportSvg(node) {
  const chartSvg = node.querySelector('svg.recharts-surface') || node.querySelector('svg')
  if (!chartSvg) throw new Error('Nothing to export yet — the chart has not rendered.')

  const box = node.getBoundingClientRect()
  const width = Math.ceil(box.width)
  const height = Math.ceil(box.height)
  const nodeStyle = getComputedStyle(node)
  const fontFamily = nodeStyle.fontFamily
  const background = nodeStyle.backgroundColor

  const root = svgEl('svg', {
    xmlns: SVG_NS,
    'xmlns:xlink': XLINK_NS,
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    'font-family': fontFamily,
  })
  root.appendChild(svgEl('rect', { x: 0, y: 0, width, height, fill: background }))

  for (const el of node.querySelectorAll('[data-export]')) {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    const x = r.left - box.left
    const y = r.top - box.top
    if (el.dataset.export === 'swatch') {
      const radius = Math.min(r.height / 2, parseFloat(cs.borderTopLeftRadius) || 0)
      root.appendChild(
        svgEl('rect', {
          x,
          y,
          width: r.width,
          height: r.height,
          rx: radius,
          ry: radius,
          fill: cs.backgroundColor,
        }),
      )
    } else {
      const text = svgEl('text', {
        x,
        y: y + r.height / 2,
        'dominant-baseline': 'central',
        'font-family': fontFamily,
        'font-size': cs.fontSize,
        'font-weight': cs.fontWeight,
        'letter-spacing': cs.letterSpacing === 'normal' ? '0' : cs.letterSpacing,
        fill: cs.color,
      })
      text.textContent = el.textContent
      root.appendChild(text)
    }
  }

  const chartBox = chartSvg.getBoundingClientRect()
  const clone = chartSvg.cloneNode(true)
  clone.setAttribute('xmlns', SVG_NS)
  clone.setAttribute('x', String(chartBox.left - box.left))
  clone.setAttribute('y', String(chartBox.top - box.top))
  clone.setAttribute('width', String(chartBox.width))
  clone.setAttribute('height', String(chartBox.height))
  clone.setAttribute('font-family', fontFamily)
  clone.removeAttribute('tabindex')
  clone.removeAttribute('style')
  root.appendChild(clone)

  const markup =
    '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(root)
  return { markup, width, height, background }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not rasterize the chart.'))
    img.src = src
  })
}

async function exportPng({ markup, width, height, background }, filename, scale) {
  const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'),
  )
  triggerDownload(blob, `${filename}.png`)
}

function exportSvg({ markup }, filename) {
  triggerDownload(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`)
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

function exportPdf({ markup, width }, title) {
  const win = window.open('', '_blank')
  if (!win) throw new Error('The print window was blocked. Allow pop-ups and try again.')
  const body = markup.replace(/^<\?xml[^>]*>\s*/, '')
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 14mm; }
  html, body { margin: 0; background: #fff; }
  body { display: flex; justify-content: center; padding: 16px; }
  svg { max-width: 100%; width: ${width}px; height: auto; }
</style>
</head>
<body>${body}</body>
</html>`
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.document.title = title
  const print = () => {
    win.focus()
    win.print()
  }
  win.onafterprint = () => win.close()
  // Give the new document a beat to lay out before the print dialog grabs it.
  setTimeout(print, 250)
}

export default function ExportPanel({ state, update, chartRef }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const format = state.exportFormat
  const formatLabel = String(format).toUpperCase()
  const scale = parseInt(state.resolution, 10) || 1

  const handleDownload = async () => {
    const node = chartRef?.current
    if (!node || busy) return
    setBusy(true)
    setError('')
    try {
      const svg = buildExportSvg(node)
      const filename = slugify(state.graphName)
      if (format === 'svg') exportSvg(svg, filename)
      else if (format === 'pdf') exportPdf(svg, state.graphName || 'Graph')
      else await exportPng(svg, filename, scale)
    } catch (err) {
      console.error('Export failed', err)
      setError(err?.message || 'Export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel export-panel" aria-label="Export">
      <h2 className="export-panel-heading">Ready to share your findings?</h2>

      <div className="export-panel-row">
        <div className="export-panel-segmented" role="radiogroup" aria-label="Export format">
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              className={`export-panel-tab${format === f ? ' is-active' : ''}`}
              onClick={() => update({ exportFormat: f })}
            >
              {f}
            </button>
          ))}
        </div>

        <label className="export-panel-resolution">
          <span className="export-panel-resolution-label">Resolution</span>
          <Select
            variant="compact"
            value={state.resolution}
            options={RESOLUTIONS.map((r) => ({ value: r, label: r }))}
            onChange={(resolution) => update({ resolution })}
            ariaLabel="Export resolution"
          />
        </label>

        <button
          type="button"
          className="btn btn-primary export-panel-download"
          onClick={handleDownload}
          disabled={busy}
          aria-busy={busy}
        >
          <DownloadIcon size={14} />
          <span>{busy ? 'Preparing…' : `Download ${formatLabel}`}</span>
        </button>
      </div>

      {error ? (
        <p className="export-panel-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
