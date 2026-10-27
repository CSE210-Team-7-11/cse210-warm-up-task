---
status: accepted
date: 2026-10-17
decision-makers: Team poll (no votes against)
---

# ADR-0003: Store point data in typed numeric columns

## Context and Problem Statement

The inherited pipeline creates an object per row (`{ x, s1, s2 }`) and then another `{ x, y }` object per point for every series, copying x each time. With large files this is millions of small objects.

## Considered Options

- Keep arrays of point objects
- Migrate Part 1's `PointSet`
- Typed numeric columns

## Decision Outcome

Chosen option: **typed numeric columns**. Point data is stored in fixed-type, fixed-size `Float32Array`/`Float64Array` columns: one shared X column and one Y column per series. Series metadata (name, color, dash, marker) stays as plain objects. Existing interfaces are kept where practical.

Precision, growth, and copying choices are explicit and documented in their own records.

Migrating Part 1's `PointSet` was considered but not chosen: the assignment is to evolve Team 8's code, not bring in our own.

### Consequences

- Good: far less memory and allocation, and X is stored once.
- Bad: code that reads points has to change; the old renderer needs a conversion step until it is replaced.
