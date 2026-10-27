---
status: accepted
date: 2026-10-17
decision-makers: Team poll (no votes against)
---

# ADR-0004: Draw the chart with Canvas2D

## Context and Problem Statement

The inherited chart draws every point as an SVG element and adds an invisible SVG circle per point for hovering. DOM size grows with the data, and hover re-renders the whole chart.

## Considered Options

- SVG (current)
- Canvas2D
- WebGL

## Decision Outcome

Chosen option: **Canvas2D** for the whole chart.

- Per-point SVG hover targets are replaced with coordinate-based hit testing.
- Axes, labels, titles, the legend, and the tooltip move to the canvas too, so the chart is a single image and can be exported directly.
- Line and scatter are migrated separately, checking that styles and tooltips stay the same.

WebGL was not chosen as more complex than the data sizes require. Part 1 also chose Canvas (Part 1 ADR-0001).

### Consequences

- Good: drawing cost no longer adds DOM elements per point.
- Bad: hover needs pixel-to-data conversion, and drawing must handle device pixel ratio.
