/**
 * @file Renders the chart examples in /examples.html
 */
import { createChart } from './graph/Graph.js'

/**
 * @constant
 * @type {Float64Array}
 */
const days = Float64Array.of(1, 2, 3, 4, 5, 6, 7)

/**
 * Plots a graph with the given dataset and chart options using {@link module:graph/Graph.createChart|createChart}.
 * 
 * @param {string} id - DOM element id of the container to plot the graph in
 * @param {string} type - chart type 'scatter'|'line'
 * @param {Object.<symbol, string>} labels - the chart title, subtitle, and y_axis_label
 * @param {Array.<Object.<symbol, string>} series - list of series name, color, and marker shape
 * @param {Array.<Number>} ys - list of dataset y-values
 * @param {Object.<symbol, boolean>} options - chart customization options
 */
function plot(id, type, labels, series, ys, options = {}) {
  createChart(document.getElementById(id), {
    type, labels: { x_axis_label: 'Day', ...labels }, series,
    columns: { length: days.length, x: days, ys: ys.map(values => Float64Array.from(values)) },
    ...options,
  })
}


plot('scatter-a', 'scatter', {
  title: 'Daily foot traffic', subtitle: 'A scatter plot with a trend line', y_axis_label: 'Visitors',
}, [{ name: 'Visitors', color: '#017143' }], [
  [42, 58, 49, 76, 68, 91, 104],
], { showTrendLine: true })

plot('scatter-b', 'scatter', {
  title: 'Lunch rush', subtitle: 'Compare series with different markers', y_axis_label: 'Orders',
}, [
  { name: 'Eat in', color: '#017143', marker: 'square' },
  { name: 'Takeaway', color: '#ec431c', marker: 'triangle' },
], [
  [18, 25, 21, 32, 28, 36, 31],
  [30, 22, 34, 26, 41, 33, 45],
])

plot('line-a', 'line', {
  title: 'Weekly sales', subtitle: 'Multiple series with solid and dashed lines', y_axis_label: 'Sales',
}, [
  { name: 'Snacks', color: '#017143' },
  { name: 'Drinks', color: '#ee3124', dash: '6 4' },
], [
  [24, 31, 28, 42, 38, 51, 59],
  [18, 23, 34, 29, 40, 36, 46],
])

plot('line-b', 'line', {
  title: 'Missing readings', subtitle: 'Day 3 breaks the line; day 5 connects across', y_axis_label: 'Temperature (°C)',
}, [{ name: 'Sensor', color: '#017143' }], [
  [18, 21, Infinity, 24, -Infinity, 26, 22],
])
