---
status: accepted
date: 2026-10-17
decision-makers: Team poll (no votes against)
---

# ADR-0005: Parse CSV files with Papa Parse

## Context and Problem Statement

The inherited parser splits every line on every comma, so quoted fields such as `"1,010"` shift values into other columns and drop trailing values, while the import still reports success.

## Considered Options

* Papa Parse
* Fix the in-house parser

## Decision Outcome

Chosen option: **[Papa Parse](https://www.papaparse.com/)**, a small, dependency-free library that handles quoted fields, delimiter detection, streaming, and workers.

* Papa Parse only splits fields. Our own adapter converts and validates the values (ADR-0006) and fills the numeric columns (ADR-0003).
* `dynamicTyping` stays off, so our conversion sees the original text.
* Papa Parse's reported errors are checked, not ignored.

### Consequences

* Good: correct quoting and streaming without writing our own CSV parser.
* Bad: one runtime dependency, requiring reading docs and maintaining.
