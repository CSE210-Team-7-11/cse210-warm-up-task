# Library interfaces

The chart's modules pass numeric columns, resolved series styles, and layout calculations through the rendering pipeline. This reference describes those shared structures for contributors changing the implementation. The [architecture guide](architecture.md) explains how the modules work together; the [public API reference](user-guide/api.md) covers chart configuration and lifecycle methods.

## Numeric columns and series

Data has one shared X column and one Y column per series:

```js
const columns = {
  length: 4,
  x: Float64Array.of(1, 2, 3, 4), // Days shared by both series.
  ys: [
    Float64Array.of(24, 31, 28, 42), // Sales.
    Float64Array.of(18, 22, 20, 27), // Costs.
  ],
}
const series = [
  { name: 'Sales', color: '#2a78d6' },
  { name: 'Costs', color: '#eb6834' },
]
```

`columns.x` and each Y column contain `length` values in `Float64Array` or `Float32Array` storage. X values must be finite and sorted ascending; duplicate X values are supported. `series[i]` describes `columns.ys[i]`. Every operation that selects or reorders series must preserve that pairing.

Finite Y values contribute to bounds, trend lines, drawing, and hover lookup. `Infinity` breaks a line; `-Infinity` connects across a missing observation. Both are skipped by bounds, trend calculations, and hit testing. Resolve `NaN` before passing data to the chart. These conventions are defined in [ADR-0007](decisions/0007-data-contract.md).

The chart retains references to the numeric arrays. Changes require an update so the stored bounds, layout, and drawing reflect the same data.

## Series preparation

[`prepareSeries(series, columns, type)`](../src/graph/series.js) returns `{ series, columns }` for the plotted series. It assigns automatic colors, excludes series that remain uncolored, and changes `marker: 'none'` to `'circle'` for scatter plots.

The returned series and Y columns have matching indexes. The X array and retained Y arrays are shared with the input. When all series are retained, the returned `columns` is the original object. When filtering is required, a new columns object contains the selected Y arrays. Resolved styles use new objects when a color or marker changes.

All subsequent calculations use this prepared result, including bounds, legend measurement, trend lines, and hover lookup.

## Bounds, legend, and layout

[`bounds(columns)`](../src/graph/scale.js) returns `{ xMin, xMax, yMin, yMax, count }`. `count` is the number of finite Y values across all series. Only rows with a finite Y value contribute to the X bounds.

[`measureLegend(ctx, series, labels)`](../src/graph/canvas.js) measures text and returns a legend layout calculated by [`legendEntries`](../src/graph/Legend.js):

| Field | Meaning |
| --- | --- |
| `entries` | Positioned legend items with label, color, shape, radius `r`, coordinates `x` and `y`, and measured width |
| `extraHeight` | Additional logical height needed for wrapped entries |
| `warnings` | `[]` or `[['legend-overflow', omittedCount]]` |

Omitting a legend entry leaves its series in the plotted data. `Graph.js` passes `extraHeight` into `computeLayout` and attaches the measured legend to the result for drawing.

`computeLayout({ xMin, xMax, yMin, yMax, xColumnName, yColumnName, extraHeight })` returns:

| Fields | Meaning |
| --- | --- |
| `xMin`, `xMax`, `yMin`, `yMax` | Numeric domain |
| `left`, `right`, `top`, `bottom`, `height` | Plot edges and total chart height in logical coordinates |
| `toX`, `toY` | Convert data values to logical drawing coordinates |
| `fromX`, `fromY` | Convert logical coordinates back to data values |
| `xTicks`, `yTicks`, `xGridlines`, `yGridlines` | Numeric tick and gridline positions |

The logical chart width is `WIDTH`, currently 500. Drawing and pointer handling must use the same layout; `Graph.js` handles conversion between logical coordinates and the displayed canvas size.

`trendLine(x, y, length, xColumnName, yColumnName)` returns `{ slope, startHeight, firstX, lastX }`, or `null` when there are fewer than two finite Y values or all usable X values are equal. `Graph.js` evaluates the endpoints and supplies `{ color, firstX, lastX, firstY, lastY }` objects to `drawTrendLines`.

## Drawing and hit testing

[`drawLines(ctx, columns, series, layout, options)`](../src/graph/canvas.js) draws connecting lines and markers according to `showLines`, `showPoints`, `pointSize`, and `dense`. It returns `null`, or an array of per-series bitsets when dense markers are enabled. These `Uint8Array` bitsets record which observations received a marker:

```js
const markerWasDrawn = Boolean(markerRows[seriesIndex][index >> 3] & (1 << (index & 7)))
```

`Graph.js` stores this result as `view.markerRows` after each redraw. Its hit-test callback uses those bits to restrict marker hits to the observations actually drawn.

`findNearest(columns, layout, px, py, maxDistance, options)` in `scale.js` receives pointer coordinates in logical chart units and returns `{ seriesIndex, index }` or `null`. Its options connect the search to marker geometry and draw order:

| Option | Meaning |
| --- | --- |
| `radiusAt(seriesIndex, index)`, `maxRadius` | Per-point target radius and its upper bound |
| `hitTest(seriesIndex, index, dx, dy)`, `maxHitRadius` | Marker containment test and its horizontal search bound |
| `isAbove(seriesIndex, index, otherSeries, otherIndex)` | Resolve overlapping marker hits in drawing order |

`dx` and `dy` are the marker center's offsets from the pointer. [`containsMarker(shape, dx, dy, radius, outline)`](../src/graph/markerHit.js) tests geometry using offsets from the marker center, so `Graph.js` negates them when calling it. The returned point indexes address the prepared series and columns.

## File import

[`importFile(file, options?)`](../src/fileImport.js) reads a browser `File` asynchronously. It returns `null` for empty input or an object with these fields:

| Field | Meaning |
| --- | --- |
| `columns` | Source names as `{ key, name }` objects, starting with X |
| `numericColumns` | Sorted `{ length, x, ys }` numeric data, preserving duplicate-X order |
| `delimiter`, `numberFormat` | Detected field delimiter and resolved decimal separator |
| `issues` | Parse and value diagnostics |
| `warnings`, `warningCount` | First ten Float32 precision-conversion warnings and their total count |

`numericColumns` supplies the chart's `columns`. The source names supply axis and series labels. For example, an import with two named columns can be mapped directly to chart options:

```js
import { importFile } from './src/fileImport.js'

const file = new File(['Day,Sales\n2,31\n1,24'], 'sales.csv')
const imported = await importFile(file)
const options = {
  type: 'line',
  columns: imported.numericColumns, // X: [1, 2], Y: [24, 31].
  series: imported.columns.slice(1).map(({ name }) => ({ name })),
  labels: { x_axis_label: imported.columns[0].name },
}
```

These source imports are relative to the repository root. Applications decide how to handle empty input and diagnostics before creating a chart.

### Import options

| Option | Default | Behavior |
| --- | --- | --- |
| `emptyCells` | `'gap'` | `'gap'`, `'zero'`, `'connect'`, or `'mark'` for Y cells |
| `numberFormat` | `'auto'` | Detect the decimal separator, or explicitly use `'.'` or `','` |
| `precision` | `'float64'` | `'float64'` or `'float32'` numeric storage |
| `chunkSize` | `1024 * 1024` | Positive integer bytes per read |

Empty Y cells become `Infinity`, `0`, or `-Infinity` for gap, zero, and connect modes. `'mark'` retains them as `NaN` for later resolution. Empty or invalid X values remove the row. `#N/A` becomes `-Infinity`; other invalid Y text produces a gap and a diagnostic. Invalid option values reject with `TypeError`.

Field delimiters and decimal separators are detected separately. Auto mode recognizes consistent format evidence, including decimal commas such as `1,5`. With no evidence it uses decimal points; conflicting evidence produces `number-format` issues and uses decimal points. An explicit separator overrides detection and validates grouping in that format.

### Import diagnostics

`issues` is an array of `[type, data]` entries. Positions are zero-based source data records, excluding headers and blank records. Quoted newlines belong to the same record. Sorting numeric columns preserves these diagnostic source positions.

| Issue type | Data |
| --- | --- |
| `TooFewFields`, `TooManyFields`, `invalid-x` | Source row indexes |
| Papa Parse error codes, such as `MissingQuotes` | Source row indexes, or a count when positions cannot be mapped |
| `invalid-number`, `number-format` | `[columnIndex, sourceRowIndex, originalText]` entries |
| `empty-cell` | `[columnIndex, sourceRowIndex]` entries |
| `duplicate-header` | Column indexes |
| `precision-loss` | Up to ten `[columnIndex, sourceRowIndex, originalText, storedValue]` entries |
| `precision-loss-truncated` | Count of additional precision changes |

Float64 parsing changes are recorded in `issues`. Float32 conversion warnings contain `message`, `value`, `storedValue`, `columnName`, `precision`, and an optional `sourceRow`.

## Numeric failures

Import, precision conversion, and chart calculations share the error types in [`numericErrors.js`](../src/numericErrors.js): `Float32OverflowError`, `Float64OverflowError`, and the aggregate `NumericOverflowErrors`. `isNumericOverflowError(error)` recognizes all three. An aggregate exposes up to ten errors in `errors` and the full total in `count`.

`finiteCalculation(result, columnName, input, calculation)` returns a finite result or throws `Float64OverflowError`. `collectOverflowErrors(calculations)` runs independent calculations, collects numeric failures, and throws after checking them all. Other exceptions propagate immediately.

The bounded collector in [`diagnostics.js`](../src/diagnostics.js) stores `{ items, count }`. `addDiagnostic` increments the total while constructing at most ten details. This limit applies to numeric-error and precision-warning details; ordinary import issue lists can grow with the input.
