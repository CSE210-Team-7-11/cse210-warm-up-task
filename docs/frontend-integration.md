# Frontend integration proposal

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

This is the inherited interface. Data stays sorted by x; missing y values remain line gaps and are omitted from scatter points. Invalid x values are omitted. The preview still requires at least two valid points in total. The adapter preserves these behaviors and leaves input data unchanged.

## Proposed ownership

Use the Part 1 ownership split as a starting point: frontend owns the demo, rendering, axes, labels, and hover interactions; backend owns CSV parsing and numeric data preparation. Both groups review changes to the shared series and chart options. Confirm this split with Nathan before members begin overlapping renderer work.

## Decisions for the leads

The next library interface needs agreement on:

- Data layout: parallel x/y columns, Float32 or Float64 precision, who sorts them, and whether callers may mutate them.
- Missing values: distinguish a series with no sample at an x position from an intentional line break; define the representation before changing the current gaps.
- Import results: define fatal errors, skipped rows and cells, warning locations, and when an import replaces the current dataset. CSV quoting and numeric conversion are separate concerns; a quoted value such as `"1,010"` needs an explicit numeric policy.
- Chart lifecycle: define creation, data and option updates, resizing, hover reporting, and cleanup. Keep titles, subtitles, labels, series styles, and trend lines available.
- Ownership: name the owners of rendering, axes and tooltips, the parser and data model, and the demo adapter before overlapping changes begin.

The Part 1 `Chart`, `Series`, and `PointSet` interfaces are useful references. Moving them into this project would change storage, precision, line gaps, and lifecycle behavior, so that migration needs a separate decision. Canvas2D and framework independence also remain proposals until the team settles them.

## First frontend tasks

1. Import feedback: clear errors and a compact dataset summary; agree on replacing the full table.
2. Display controls: point size and visibility, retaining existing labels and series styles. Define the new option names with the renderer owner.
3. Chart integration: check existing switching and hover behavior, then connect the agreed library API through the adapter.

Pengwei coordinates the frontend task split and integration review. Members claim implementation tasks and flag work already in progress. The leads confirm the group boundaries above and agree on the shared interface before migration starts.

## Working agreements

Use the Part 2 fork as the shared base. State the task being claimed before starting unless it has already been approved, and coordinate larger changes with the subteam lead. Keep each behavior change in a focused PR with its expected result and checks, leaving other tasks available for teammates. Every PR needs at least one approving review from someone other than its author before merging. Contributors must understand and test the code they submit.

Include a small input example when changing data behavior. Interface changes need review from the affected subteam before callers are migrated. Keep extraction, bug fixes, and renderer migration in separate steps so each change can be reviewed against the inherited behavior. Preserve the inherited history and credit reused code in the PR description.

Run `npm test`, `npm run lint`, and `npm run build`. The adapter tests cover series pairing, gaps, settings, counts, precision, and source data preservation. Browser checks of switching, hover, and labels are also needed when rendering or integration behavior changes.
