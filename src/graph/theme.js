export const DEFAULT_COLOR = '#256b47'

export const THEME = {
  title: { size: 16, weight: 600, color: '#1c1f1a' },
  subtitle: { size: 9, weight: 400, color: '#8a8f85' },
  label: { size: 8, weight: 400, color: '#6f746a' },
  axis: '#c9cdc4',
  gridline: '#e8eae4',
  outline: '#fff',
  tooltip: { background: '#ffffff', border: '#eaede3', text: '#20382c', muted: '#8a968c' },
}

export function themeProperties() {
  const { title, subtitle, label, axis, gridline, outline, tooltip } = THEME
  return {
    '--graph-title-size': `${title.size}px`,
    '--graph-title-weight': title.weight,
    '--graph-title-color': title.color,
    '--graph-subtitle-size': `${subtitle.size}px`,
    '--graph-subtitle-weight': subtitle.weight,
    '--graph-subtitle-color': subtitle.color,
    '--graph-label-size': `${label.size}px`,
    '--graph-label-color': label.color,
    '--graph-axis': axis,
    '--graph-gridline': gridline,
    '--graph-outline': outline,
    '--graph-series': DEFAULT_COLOR,
    '--graph-tooltip-background': tooltip.background,
    '--graph-tooltip-border': tooltip.border,
    '--graph-tooltip-text': tooltip.text,
  }
}
