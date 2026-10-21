---
status: accepted
date: 2026-10-17
decision-makers: Team poll (no votes against)
---

# ADR-0009: Configurable point markers

## Context and Problem Statement

Team 8's marker shapes and dash patterns give each series a non-color cue, but at high density the markers overlap and hide the data.

## Decision Outcome

Point markers are configurable: visibility (the existing "Show data points") and size. Shape and dash options are kept for plots where they help tell series apart. Scatter charts always show their points.

### Consequences

* Good: dense line charts stay readable without losing the accessibility cues.
* Bad: one more option to carry through the renderer.
