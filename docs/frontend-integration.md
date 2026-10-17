# Frontend integration

Keep the existing demo working while the chart library evolves. The first change extracts its current chart input preparation into `src/components/charts/chartAdapter.js`, so the page and library can be changed separately.

## Current boundary

`prepareChart(state)` returns `{ graphProps, pointCount }`. `ChartPreview` uses the count for its existing empty state and passes `graphProps` to `Graph`.

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

This is the inherited interface. Data stays sorted by x, invalid x values are omitted, and input data is left unchanged. Missing y values are omitted from scatter points. The preview still requires at least two valid points in total.

For line charts, the current adapter passes missing y values as `null`, creating gaps. This is a known issue, preserved by the extraction. The TODO test specifies the intended fix: omit absent samples from each series so its valid neighbors can connect. It should become a regular passing test when that bug is fixed in a separate change.

## Integration changes

`ChartPreview` calls `prepareChart(state)` and passes its result to the existing `Graph`. Changes to the editor or renderer should use this boundary, retaining titles, subtitles, axis labels, series styles, and chart settings when the shared API changes.

Pengwei coordinates frontend integration and agrees on shared API changes with Nathan. Parser, renderer, and adapter contributors should review changes together before callers are migrated. Keep bug fixes and renderer migration separate from this extraction.

Record architecture decisions in ADRs and track bugs in issues, with a small input example and expected result. This document describes the current interface; decisions about storage, rendering, and import behavior belong with those changes. Continue evolving Team 8's implementation rather than importing the Part 1 implementation.

## Checks

Run `npm test`, `npm run lint`, and `npm run build`.

The adapter tests cover series pairing, scatter filtering, settings, counts, precision, and source data preservation. The missing-sample line test is marked `{ todo: true }` and currently fails as expected; it is not a completed bug fix.

Check switching, hover, and labels in the browser when rendering or integration behavior changes. Every PR requires an approving review from someone other than its author before merging.
