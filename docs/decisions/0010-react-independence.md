---
status: proposed
date: 2026-10-17
decision-makers: Team poll (open; no decision-facing votes cast as of 13:40 2026/10/17)
---

# ADR-0010: Make the chart library independent of React

## Context and Problem Statement

The chart is a React component, so any application that wants to show it must also load React, and React's update machinery runs on every hover. Profiles of a 20k-row import showed substantial time in React's DOM work.

## Considered Options

* Keep the chart as a React component
* Make the library plain JavaScript, with React only in the demo

## Proposed Outcome

Remove React as a dependency of the charting library while keeping the existing app as a demo that loads it. A plain HTML example verifies that library users don't need React.

Work that moves logic out of React in small pieces can proceed before this is decided, since plain functions are easier to test either way.
