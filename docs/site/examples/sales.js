/** Chart options from the getting-started guide */
export const salesOptions = {
  type: 'line',
  labels: {
    title: 'Daily sales',
    subtitle: '',
    x_axis_label: 'Day',
    y_axis_label: 'Sales ($)',
  },
  series: [{ name: 'Sales', color: '#2a78d6' }],
  columns: {
    length: 4,
    x: Float64Array.of(1, 2, 3, 4),
    ys: [Float64Array.of(24, 31, 28, 42)],
  },
}

/** Two-series configuration from the second example in the guide. */
export const comparisonOptions = {
  ...salesOptions,
  labels: { ...salesOptions.labels, title: 'Sales and costs', y_axis_label: 'Amount ($)' },
  series: [
    { name: 'Sales', color: '#2a78d6' },
    { name: 'Costs', color: '#eb6834', marker: 'square', dash: '6 4' },
  ],
  columns: {
    length: 4,
    x: Float64Array.of(1, 2, 3, 4),
    ys: [
      Float64Array.of(24, 31, 28, 42),
      Float64Array.of(18, 22, 20, 27),
    ],
  },
}
