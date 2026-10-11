# How Smitski Graph Studio Works

A small React app for turning a table of numbers into a line or scatter graph and exporting it as an image. Built from the Figma mockup in [`design/figma-mockup.png`](../design/figma-mockup.png).

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

Stack: React 19, Vite, [Recharts](https://recharts.org) for the chart. No backend — everything runs in the browser.

## The page

Three panels, numbered in the order you use them:

| Panel | What it does |
| ----- | ------------ |
| **01 Choose your graph** | Pick *Line graph* or *Scatter plot*. |
| **02 Add your data** | Drop/browse a CSV or TSV file, paste text, or type straight into the table. Every cell is editable; `+ Add row` appends a row. The status line turns into a warning if any cell isn't a number. The `⋯` menu can load the sample data or clear the table. |
| **Graph preview** | The chart, redrawn from the table on every change. Hover a point for a tooltip. Below it, **Ready to share your findings?** downloads the chart as PNG, SVG, or PDF at 1×/2×/3× resolution. |
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
    ├── SpecsPanel                 right column
    └── ui/                        Toggle, Select, Icons used everywhere
```

**One-way data flow.** `App.jsx` holds a single state object (see `initialState` in `state.js`): the table (`columns`, `rows`), the chart type, and the appearance settings (`title`, `series`, `xColumn`, `gridlines`, …). Panels never keep their own copy; they call handlers such as `setCell`, `addRow`, `importData`, `setSeriesProp`, or the generic `update(patch)`, and React re-renders everything that depends on the changed state.

**The chart is derived, not stored.** `ChartPreview` maps `rows` into `{ x, s1, s2 }` points using `xColumn` and each series' `columnIndex`, then hands them to Recharts. That's why editing a cell, switching the X column, or hiding a series updates the graph immediately — there is nothing to sync.

**Importing data.** `parseDelimited()` in `state.js` detects comma vs. tab, treats a non-numeric first line as the header, and returns `{ columns, rows }`. `importData` then rebuilds the series list from the new columns.

**Exporting.** `ExportPanel` finds the chart's `<svg>` inside `chartRef`, serialises it with `XMLSerializer`, and:

- **SVG** – downloads the markup directly.
- **PNG** – draws the SVG onto a `<canvas>` scaled by the chosen resolution, then `canvas.toBlob()`.
- **PDF** – opens the SVG in a new window and calls `print()`, so the browser's "Save as PDF" does the work (no PDF library).

## Styling

All colours, radii, and font sizes live as CSS variables in `src/index.css` (sampled from the mockup). Each component has its own `.css` file with class names prefixed by the component name, so styles don't collide.
