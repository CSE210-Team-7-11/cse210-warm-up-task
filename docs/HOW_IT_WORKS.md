# How Smitski Graph Studio Works

A small React app that turns a CSV/TSV file into a line graph or scatter plot. Based on the Figma mockup in [`design/figma-mockup.png`](../design/figma-mockup.png), trimmed down after team feedback.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

Stack: React 19 + Vite. **No charting library** (no Recharts): charts are plain SVG we draw ourselves. No backend; everything runs in the browser.

## Features

1. **Graph display.** Line graph or scatter plot, with gridlines and a legend always shown.
2. **Drop a file.** Drag a CSV/TSV onto the drop zone or click to browse. The first column is the X axis; the next columns (up to 3) are plotted as series. The table is a read-only preview: to change the data, drop a new file.
3. **Titles and axis names.** Edit the graph title, subtitle (with an on/off toggle), X-axis label, and Y-axis label.
4. **Scatter plot / line graph switch.** The *Choose your graph* cards on the left.

Deliberately **not** included: editing table cells, choosing which columns go on which axis, line-width controls, gridline/legend toggles, and exporting.

## Colorblind-friendly series

Series styles are fixed in `SERIES_STYLES` (`src/state.js`): **blue, orange, aqua**. That palette was checked with a color-vision-deficiency validator and passes for red-green colorblindness, including every pair at once (needed for scatter plots). Color is never the only cue:

| Series | Color | Line | Marker |
| ------ | ----- | ---- | ------ |
| 1 | blue `#2a78d6` | solid | circle |
| 2 | orange `#eb6834` | dashed | square |
| 3 | aqua `#1baf7a` | dotted | triangle |

The legend and the *Data series* list already draw these with `SeriesKey.jsx`. A file with more than 3 series plots only the first 3 rather than reusing colors.

## Sample data

12 months of a Smitski habit: *Smitskis owned* climbs (with buying sprees in months 9 and 12) while *Funds ($ x 10)* drains (with small payday bumps in months 5 and 10). It reads as a story on the line graph and as two opposite trends on the scatter plot. Swap it in `DEFAULT_COLUMNS` / `DEFAULT_ROWS` in `src/state.js`.

## How the pieces fit together

```
src/
├── App.jsx            owns ALL state; passes it + a few handlers to the panels
├── state.js           sample data, series styles, defaults, CSV/TSV parser
├── index.css          design tokens (colors, radii, fonts) and shared classes
└── components/
    ├── TopNav / TitleBar            header and title row
    ├── ChartTypePicker / DataPanel  left column (chart type, file drop, table)
    ├── ChartPreview                 center column (title, chart, legend)
    ├── SpecsPanel                   right column (titles, axis names, series key)
    ├── charts/                      our SVG chart code
    │   ├── chartUtils.js            data shaping, nice axis ranges/ticks
    │   ├── ChartFrame.jsx           gridlines, tick labels, axis titles (done)
    │   ├── LineGraph.jsx            line marks (TODO)
    │   ├── ScatterPlot.jsx          scatter marks (TODO)
    │   ├── Marker.jsx / SeriesKey.jsx  marker shapes and legend glyphs (done)
    │   └── useElementWidth.js       responsive chart width
    └── ui/                          Toggle, Select, Icons
```

**One-way data flow.** `App.jsx` holds one state object (`initialState` in `state.js`). Panels never keep their own copy; they call `update(patch)`, `onImport(data)`, or `onReset()`, and React re-renders whatever depends on the change.

**The chart is derived, not stored.** `buildChartData()` turns the table rows into `{ x, s1, s2 }` points (column 0 is X) and `computeScales()` picks nice axis ranges and ticks, so a new file or a new label updates the graph immediately.

**Drawing.** `ChartPreview` renders `ChartFrame`, which hands its child `xPos(x)` / `yPos(y)` functions that turn data values into pixels. The child is `LineGraph` or `ScatterPlot` and only has to draw marks.

## Open TODOs

Search the code for `TODO(`; each one has a checklist.

| Tag | File | What's left |
| --- | ---- | ----------- |
| `TODO(line-graph)` | `src/components/charts/LineGraph.jsx` | Line path per series with its dash pattern, gradient fill under series 1, markers, hover targets |
| `TODO(scatter-plot)` | `src/components/charts/ScatterPlot.jsx` | One marker per point using the series' shape, hover targets, optional trend line |
| `TODO(tooltip)` | `src/components/ChartPreview.jsx` | Shared hover tooltip (CSS already written) |
