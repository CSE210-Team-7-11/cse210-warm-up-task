# How Smitski Graph Studio Works

A small React app for turning a table of numbers into a line or scatter graph and exporting it as an image. Built from the Figma mockup in [`design/figma-mockup.png`](../design/figma-mockup.png).

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

Stack: React 19 + Vite. **No charting library** — charts are plain SVG we draw ourselves. No backend; everything runs in the browser.

## The page

Three panels, numbered in the order you use them:

| Panel | What it does |
| ----- | ------------ |
| **01 Choose your graph** | Pick *Line graph* or *Scatter plot*. |
| **02 Add your data** | Drop/browse a CSV or TSV file, paste text, or type straight into the table. Every cell is editable; `+ Add row` appends a row. The status line turns into a warning if any cell isn't a number. The `⋯` menu can load the sample data or clear the table. |
| **Graph preview** | The chart, redrawn from the table on every change (line/scatter marks and the hover tooltip are TODO — see below). Below it, **Ready to share your findings?** downloads the chart as PNG, SVG, or PDF at 1×/2×/3× resolution. |
| **03 Graph Specifications** | Title and subtitle, which columns feed the X and Y axes, axis labels, line width per series, and toggles for data points, gridlines, and legend. *Reset to defaults* restores the original look. |

The title bar lets you rename the graph (pencil icon); *New graph* resets everything.

## How the pieces fit together

```
src/
├── App.jsx            owns ALL state; passes slices + handlers to the panels
├── state.js           initial state, defaults, CSV/TSV parser, validation helpers
├── index.css          design tokens (colours, radii, fonts) and shared classes
└── components/
    ├── TopNav / TitleBar          header and title row
    ├── ChartTypePicker / DataPanel  left column
    ├── ChartPreview / ExportPanel   centre column
    ├── charts/                    our SVG chart code (frame done, marks TODO)
    ├── SpecsPanel                 right column
    └── ui/                        Toggle, Select, Icons used everywhere
```

**One-way data flow.** `App.jsx` holds a single state object (see `initialState` in `state.js`): the table (`columns`, `rows`), the chart type, and the appearance settings (`title`, `series`, `xColumn`, `gridlines`, …). Panels never keep their own copy; they call handlers such as `setCell`, `addRow`, `importData`, `setSeriesProp`, or the generic `update(patch)`, and React re-renders everything that depends on the changed state.

**The chart is derived, not stored.** `buildChartData()` in `charts/chartUtils.js` maps `rows` into `{ x, s1, s2 }` points using `xColumn` and each series' `columnIndex`; `computeScales()` picks nice axis ranges and ticks. That's why editing a cell, switching the X column, or hiding a series updates the graph immediately — there is nothing to sync.

**Drawing the chart.** `ChartPreview` renders `ChartFrame` (gridlines, tick labels, axis titles), which gives its child `xPos(x)` / `yPos(y)` functions that map data values to pixels. The child is `LineGraph` or `ScatterPlot`, depending on the chart type, and only has to draw marks with those two functions.

**Importing data.** `parseDelimited()` in `state.js` detects comma vs. tab, treats a non-numeric first line as the header, and returns `{ columns, rows }`. `importData` then rebuilds the series list from the new columns.

**Exporting.** `ExportPanel` finds the chart's `<svg class="chart-svg">` inside `chartRef`, serialises it with `XMLSerializer`, and:

- **SVG** – downloads the markup directly.
- **PNG** – draws the SVG onto a `<canvas>` scaled by the chosen resolution, then `canvas.toBlob()`.
- **PDF** – opens the SVG in a new window and calls `print()`, so the browser's "Save as PDF" does the work (no PDF library).

## Styling

All colours, radii, and font sizes live as CSS variables in `src/index.css` (sampled from the mockup). Each component has its own `.css` file with class names prefixed by the component name, so styles don't collide.

## Open TODOs

Search the code for `TODO(` — each one has a checklist.

| Tag | File | What's left |
| --- | ---- | ----------- |
| `TODO(line-graph)` | `src/components/charts/LineGraph.jsx` | Line paths per series, gradient fill under series 1, data points, hover targets |
| `TODO(scatter-plot)` | `src/components/charts/ScatterPlot.jsx` | Dots per series, hover targets, meaning of line width in scatter mode |
| `TODO(tooltip)` | `src/components/ChartPreview.jsx` | Shared hover tooltip (CSS already written) |

Already done and safe to build on: data shaping, scales and ticks (`chartUtils.js`), axes and gridlines (`ChartFrame.jsx`), responsive width (`useElementWidth.js`), legend, and PNG/SVG/PDF export (works on whatever is inside the chart `<svg>`).

