---
status: accepted
date: 2026-10-17
decision-makers: Team leads
---

# ADR-0007: Shared data contract

## Context and Problem Statement

Backend produces chart data and import results; frontend draws them. Both need one agreed format before the numeric-column and Canvas work starts. Shared interfaces between backend and frontend are decided by the leads (agreed in #leads).

## Decision Outcome

### Series data

```js
{
  length: 3,
  x: Float64Array [1, 2, 3],          // sorted ascending
  ys: [Float64Array [10, -Infinity, 30], Float64Array [5, 6, Infinity]],
}
```

Series styles (name, color, dash, marker) stay as plain objects in the same order as `ys`.

### Missing values

* `-Infinity`: the series has no point at this X. The line connects across it.
* `+Infinity`: an intentional break. The line stops and restarts.

Both fail `Number.isFinite`, so bounds, trend lines, and hit testing skip them with one check. Only line drawing tells them apart.

### Import results

A list of `[type, data]` entries. `data` depends on the type: a count, or a list of `[column, row]` cell positions.

```js
[['invalid-number', [[2, 11], [2, 40]]], ['TooFewFields', [57]]]
```

Papa Parse error codes are used as types for parse errors. The full list of types is documented with the import code.

### Lifecycle

`createChart(container, options)` returns `{ update(options), destroy() }`. Creation and updates follow Team 8's existing options (series styles, type, labels, `showPoints`, `showTrendLine`). `destroy()` removes every element, listener, and observer the chart added.

### Consequences

* Good: subteams can build against the contract in parallel.
* Bad: changing it means changing both sides; changes go through the leads.
