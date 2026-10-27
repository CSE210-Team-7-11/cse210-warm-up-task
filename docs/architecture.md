# Architecture

The chart library turns numeric columns and display options into an interactive Canvas2D chart. Its entry point is [`createChart`](../src/graph/Graph.js). Each chart instance owns its canvas, prepared drawing state, hover state, and resize observer. The caller supplies data and controls when that instance is updated or removed.

The rendering code lives in `src/graph/` and uses shared numeric-error utilities from [`numericErrors.js`](../src/numericErrors.js).

## From options to a drawing

Creating a chart with options and calling `update(options)` follow the same path. An update prepares a complete view of the data, then draws it:

1. **Prepare the series.** [`series.js`](../src/graph/series.js) pairs each style entry with its Y column. It calls [`colors.js`](../src/graph/colors.js) to assign missing colors, excludes series that remain uncolored, and resolves marker shapes for the chart type. Filtering styles and values together keeps the legend, drawing, and hover information aligned.
2. **Calculate the layout.** [`scale.js`](../src/graph/scale.js) finds the data bounds and builds axis ticks and coordinate conversions. Legend measurement uses the canvas font and the wrapping rules in [`Legend.js`](../src/graph/Legend.js). Its extra rows increase the chart height before the plot coordinates are calculated. Requested scatter trend lines are calculated from finite points in each series.
3. **Store the prepared view.** `Graph.js` retains the selected columns, resolved styles, layout, labels, and trend lines. Drawing and pointer handling use this same view so they agree about where points appear.
4. **Draw and save the result.** [`canvas.js`](../src/graph/canvas.js) draws the frame, legend, trend lines, and data. `Graph.js` copies the completed chart to a detached canvas, which becomes the background for hover updates.

An update replaces the previous configuration and clears the hovered point. Omitted optional settings return to their defaults. Resizing redraws the prepared view, reusing its resolved series, layout, and trend lines.

## Data assumptions

The renderer takes one sorted X column and one Y column per series, with corresponding values at the same index. Sorting and conversion happen before the renderer is called. The renderer retains references to the supplied numeric arrays; callers must call `update` after changing them so bounds, layout, and drawing are recalculated together.

Missing Y values have two meanings: `Infinity` breaks a line, while `-Infinity` connects across the missing observation. Bounds, trend lines, and hit testing skip both. Line drawing distinguishes them when deciding whether to continue a path. Unresolved empty cells represented by `NaN` must be handled before rendering.

This shared representation is defined in [ADR-0007](decisions/0007-data-contract.md). The [API reference](user-guide/api.md#data-and-series) specifies the input requirements and options.

## Canvas sizing and dense plots

Layout uses a fixed logical width of 500 units. `Graph.js` scales that coordinate system to the container's width and the device pixel ratio, keeping drawing calculations independent of the canvas's backing resolution. [`Graph.css`](../src/graph/Graph.css) makes the visible canvas fill its container. A `ResizeObserver` triggers redraws when the container changes size.

Drawing cost is reduced where many observations occupy the same pixels. For lines, `canvas.js` retains the first, minimum, maximum, and last point in each pixel column, preserving their order and line breaks. For dense markers, it draws one marker per pixel position within each series and records which observations were drawn in a bitset. Paths are drawn in batches. These optimizations leave the input arrays intact.

Drawing styles and tooltip colors come from [`theme.js`](../src/graph/theme.js); automatic series colors are selected separately by `colors.js`.

## Hover interaction

Pointer coordinates are converted from the visible canvas into the same logical coordinates used for drawing. `findNearest` in `scale.js` uses binary search on the sorted X column, then checks nearby observations. [`markerHit.js`](../src/graph/markerHit.js) tests marker shapes, and overlap rules select the point drawn on top. For dense plots, the recorded marker bitsets prevent hit testing from selecting markers that were omitted during drawing.

When the hovered point changes, the chart restores the saved background and draws the highlight and tooltip over it. Leaving the canvas restores the background alone.

The canvas exposes an image role and a point-count label. Point exploration currently requires a pointer; keyboard navigation between points is not implemented.

## Instance lifecycle and failures

`createChart` installs pointer listeners and a resize observer. Supplying initial options draws immediately; otherwise the first `update` draws the chart. `destroy()` removes the canvas and listeners, disconnects the observer, and clears the instance's view and hover state. Applications must call it when removing a chart.

Layout and trend calculations use `numericErrors.js` to detect non-finite arithmetic results. Independent calculations collect overflow errors before throwing; aggregate errors retain the first ten details and the total count. Updates are not transactional: an error does not guarantee that the instance's previous state is preserved.

Legend entries that do not fit produce warnings returned by `update`, while their series can still be plotted. Numeric failures throw exceptions. The caller decides how to present either kind of feedback.

## Import and application integration

File reading is separate from chart rendering. [`fileImport.js`](../src/fileImport.js) reads files in chunks, uses Papa Parse to split records, and delegates numeric interpretation and diagnostics to [`numberFormat.js`](../src/numberFormat.js) and [`importRows.js`](../src/importRows.js). Separate passes let number-format evidence later in the file apply to earlier values. The column builder in [`chartUtils.js`](../src/components/charts/chartUtils.js) grows typed storage and sorts by X while preserving each observation's Y values.

Chunked reading limits the size of individual reads; the resulting dataset and diagnostics remain in memory. Import work yields to the event loop and runs on the main thread.

The [library interface reference](interfaces.md) describes the numeric columns, rendering structures, and import results. The React demo stores imported data and editor settings in [`App`](../src/App.jsx). Its [`chartAdapter.js`](../src/components/charts/chartAdapter.js) selects columns, applies the current empty-cell and precision settings, and produces chart options. `GraphView` in [`ChartPreview`](../src/components/ChartPreview.jsx) calls the chart lifecycle methods and displays feedback.

The home page, examples page, and documentation examples call the chart library directly. Their build and documentation setup is covered in [Contributing](../CONTRIBUTING.md).
