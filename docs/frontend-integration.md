# Frontend integration

Keep the existing demo working while the chart library evolves. The first change extracts its current chart input preparation into `src/components/charts/chartAdapter.js`, so the page and library can be changed separately.

## Current boundary

`prepareChart(state)` returns `{ graphProps, pointCount }`. `ChartPreview` uses the count for its existing empty state and passes `graphProps` through `GraphView` to `createChart`.

```js
{
  series: [{
    name: 'Trial A',
    color: '#2a78d6',
    marker: 'circle',
    dash: '',
    points: [{ x: 1, y: 2 }]
  }],
  type: 'line',
  showPoints: true,
  showTrendLine: true,
  labels: {
    title: 'Experiment',
    subtitle: '',
    x_axis_label: 'Time (s)',
    y_axis_label: 'Distance (m)'
  }
}
```

Data stays sorted by x, invalid x values are omitted, and input data is left unchanged. Numeric zero remains a valid sample. The preview still requires at least two valid points in total.

For line charts, empty Y cells become `+Infinity` and break the line. `#N/A` becomes `-Infinity`, which the renderer skips while connecting neighboring valid points. Other invalid Y values retain the existing `null` break behavior. Line strokes and area fills use the same segments. Markers, hover targets, and point counts include only finite values. Scatter input omits all nonfinite Y values.

These markers follow ADR-0007 while retaining the current point-object interface; migration to typed columns remains separate. The importer still supplies raw cell values. Empty-cell choices in an import dialog and the data panel's validation messages remain separate work; the existing panel still flags `#N/A` as nonnumeric.

## Integration changes

`ChartPreview` calls `prepareChart(state)` and passes its result through `GraphView` to the existing `createChart` API. Changes to the editor or renderer should use this boundary, retaining titles, subtitles, axis labels, series styles, and chart settings when the shared API changes.

Pengwei coordinates frontend integration and agrees on shared API changes with Nathan. Parser, renderer, and adapter contributors should review changes together before callers are migrated. Keep bug fixes and renderer migration separate from this extraction.

Record architecture decisions in ADRs and track bugs in issues, with a small input example and expected result. This document describes the current interface; decisions about storage, rendering, and import behavior belong with those changes. Continue evolving Team 8's implementation rather than importing the Part 1 implementation.

## Checks

Run `npm test`, `npm run lint`, and `npm run build`.

Tests cover CSV-to-chart empty-cell gaps and `#N/A` skips, line segmentation, scatter filtering, entirely missing series, series pairing, settings, counts, precision, and source data preservation.

Check switching, hover, and labels in the browser when rendering or integration behavior changes. Every PR requires an approving review from someone other than its author before merging.
