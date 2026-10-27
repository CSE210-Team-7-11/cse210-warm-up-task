---
status: accepted
date: 2026-10-18
decision-makers: Team poll
---

# ADR-0010: Make the chart library independent of React

## Context and Problem Statement

The chart is a React component, so any application that wants to show it must also load React, and React's update machinery runs on every hover. Profiles of a 20k-row import showed substantial time in React's DOM work.

## Considered Options

- Keep the chart as a React component
- Make the library plain JavaScript, with React only in the demo

## Decision Outcome

Remove React as a dependency of the charting library while keeping the existing app as a demo that loads it. A plain HTML example verifies that library users don't need React.

### Consequences

- Good: chart work uses familiar JavaScript, without requiring the team to learn React.
- Good: chart interactions no longer incur React's component-update overhead.
- Good: the library works in applications regardless of their framework. Users don't need to download or maintain React for the chart, or match its React version.
- Bad: removing the framework takes a one-time effort to move existing component logic to native browser APIs and JavaScript.
- Bad: React's default text escaping no longer protects the chart. CSV text must be drawn or inserted as text, never interpreted as HTML.
