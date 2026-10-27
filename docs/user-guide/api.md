# API reference

Use this page to look up the chart's input format, configuration, and methods. The [getting-started guide](getting-started.md) demonstrates them with live examples.

## Create a chart

`createChart(container, options?)` creates a chart instance with `update` and `destroy` methods. `container` is the page element that will hold the chart. It must have a nonzero width; the chart resizes when that width changes.

The configuration has two required fields: `columns` supplies the values to plot, and `series` supplies a name and appearance for each dataset. `type` selects `'line'` or `'scatter'`, with `'scatter'` as the default. The remaining [options](#options) control labels and appearance.

Passing `options` draws the initial chart. If it is omitted, the instance is created and drawing begins on the first call to `update`.

## Data and series

All series share the same X values. Each series has its own Y values and a corresponding entry in `series`: the first Y array belongs to the first series, the second to the second series, and so on.

For example, these sales and costs use the same four days:

| Day | Sales ($) | Costs ($) |
| --- | --- | --- |
| 1 | 24 | 18 |
| 2 | 31 | 22 |
| 3 | 28 | 20 |
| 4 | 42 | 27 |

The configuration keeps those columns together and describes each series in the same order:

```js
const options = {
  type: 'line',
  columns: {
    length: 4,
    x: Float64Array.of(1, 2, 3, 4),
    ys: [
      Float64Array.of(24, 31, 28, 42), // Sales.
      Float64Array.of(18, 22, 20, 27), // Costs.
    ],
  },
  series: [
    { name: 'Sales', color: '#2a78d6' },
    { name: 'Costs', color: '#eb6834' },
  ],
}
```

### Column requirements

| Field | Requirement |
| --- | --- |
| `columns.length` | Number of observations in each column |
| `columns.x` | A `Float64Array` or `Float32Array` of finite X values, sorted ascending |
| `columns.ys` | One typed Y array per entry in `series` |

Every X and Y column must contain `length` values. Duplicate X values are supported. The chart expects numeric data in this order; it does not parse strings or sort columns.

The chart keeps references to these arrays for drawing and hover lookup. Treat them as read-only while in use, and pass changed data through `update` to refresh the chart.

### Missing values

A missing Y value can either break a line or allow it to connect to the next observation. The input uses two markers to distinguish these cases:

| Y value | Line plot | Scatter plot |
| --- | --- | --- |
| Finite number, including zero | Draw the line and, when enabled, a marker | Draw a point |
| `Infinity` | Break the line | Skip the point |
| `-Infinity` | Skip the point and connect across it | Skip the point |

Resolve `NaN` values to a number or one of these markers before supplying the columns. Nonfinite Y values are excluded from bounds, trend lines, and hover targets. X values must always be finite.

## Options

Once `columns` and `series` define the datasets, the optional fields below configure the chart. Defaults apply both when creating a chart and on every update.

| Field | Default | Description |
| --- | --- | --- |
| `type` | `'scatter'` | `'line'` or `'scatter'` |
| `labels` | See [Labels](#labels) | Title, subtitle, and axis labels |
| `showPoints` | `true` | Show markers on line charts; scatter plots ignore this setting |
| `pointSize` | `7` | Marker size in chart coordinates; scales with the displayed chart |
| `showTrendLine` | `false` | Draw linear trend lines on scatter plots |
| `xColumnName` | X-axis label | Source column name used in numeric error messages |

### Labels

The `labels` object contains the chart's text. Supply an empty string to omit a label. Text is rendered literally, including characters that would otherwise be interpreted as HTML.

| Field | Default |
| --- | --- |
| `title` | `'Your Title'` |
| `subtitle` | `'Your Subtitle'` |
| `x_axis_label` | `'Your X Axis Label'` |
| `y_axis_label` | `'Your Y Axis Label'` |

### Series styles

Each object in `series` describes the Y column at the same index. Its name appears in the legend and tooltip; the remaining fields control how that dataset is drawn.

| Field | Default | Description |
| --- | --- | --- |
| `name` | Omitted | Series label; unnamed series have no legend entry |
| `color` | Automatic | Series color |
| `marker` | Circle | `'circle'`, `'square'`, `'triangle'`, or `'none'` |
| `dash` | Solid | Line dash pattern, such as `'6 4'`; an empty string gives a solid line |

Scatter plots render `marker: 'none'` as a circle. Dash patterns apply to line charts.

Explicit colors are preserved. Automatic colors are assigned until eleven colors are in use; any remaining uncolored series are excluded along with their Y columns. Series with explicit colors can exceed this limit. Automatically chosen colors do not modify the supplied series objects.

## Lifecycle

### Update a chart

`chart.update(options)` redraws the existing instance and returns `{ warnings }`.

An update takes a complete configuration, including `columns` and `series`. Omitted optional fields use their defaults, rather than keeping their previous values. To change one setting, include the current configuration with that setting changed. For an existing `options` object:

```js
const result = chart.update({ ...options, type: 'scatter' })
```

`result.warnings` reports any legend entries omitted by that redraw. Numeric calculations can also throw; see [Warnings and errors](#warnings-and-errors) for the return format and failure behavior.

### Remove a chart

`chart.destroy()` removes the canvas, event listeners, and resize observer. Call it when the chart's containing view is removed or the instance is no longer needed. It returns `undefined`.

## Warnings and errors

### Legend warnings

`update` returns `{ warnings: [] }` when all named series fit in the legend. Entries that exceed the available width or the four-row layout are omitted, producing a warning such as:

```js
[['legend-overflow', 2]] // Two legend entries were omitted.
```

The count refers to legend entries. Their series remain plotted. The application is responsible for presenting the warning.

### Numeric overflow

A calculation that exceeds the supported numeric range throws `Float64OverflowError`. Multiple overflows are reported as `NumericOverflowErrors`, with up to ten individual errors in `errors` and the full total in `count`.

An update that throws is not guaranteed to preserve the previous chart state. Handle the error before treating the update as successful.
