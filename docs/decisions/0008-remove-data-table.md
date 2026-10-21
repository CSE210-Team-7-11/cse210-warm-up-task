---
status: accepted
date: 2026-10-17
decision-makers: Team poll (no votes against)
---

# ADR-0008: Remove the full data table

## Context and Problem Statement

The import panel renders every imported row and cell as an HTML table, so importing more data also creates a DOM row and cells for every record.

## Decision Outcome

Remove the full-dataset table from the main workflow. Import errors and dataset counts are reported without rendering the whole dataset.

### Consequences

* Good: import cost no longer scales with DOM size.
* Bad: users can't scroll through their raw data in the app; their spreadsheet program does that better anyway.
