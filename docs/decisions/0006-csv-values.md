---
status: accepted
date: 2026-10-17
decision-makers: Team leads
---

# ADR-0006: CSV value conventions

## Context and Problem Statement

The library should read what spreadsheet programs export. Those exports contain empty cells, `#N/A`, and numbers with thousands separators that depend on the locale.

Excel, LibreOffice Calc, and MATLAB all draw an empty cell as a gap in a line by default, and offer connecting across it as an option (Excel's "Show empty cells as", LibreOffice's "Plot missing values", MATLAB's `NaN` gaps). Excel connects across `#N/A`. In CSV exports, empty cells are empty fields and `#N/A` is the text `#N/A`.

## Decision Outcome

* The first column is X; every other column is a series named by its header. A header row is detected as in Team 8's code (any non-numeric cell in the first row).
* **Empty field:** a gap in the line by default. An import option allows treating empty fields as zero or connecting across them, matching Excel's options.
* **`#N/A`:** no point; the line connects across it, as in Excel.
* **Numbers:** anything JavaScript's `Number()` reads as finite, including hex, scientific notation, and surrounding whitespace. Thousands separators follow the detected delimiter: with `,` commas are removed; with `;`, `.` is the thousands separator and `,` the decimal point.
* **Anything else**, including the text `Infinity`, is invalid and reported as a diagnostic. An invalid X skips the row.

### Consequences

* Good: files exported from spreadsheets behave the way their authors expect.
* Bad: a formula that returns `""` in Excel exports as an empty field, so we draw a gap where Excel drew zero.
