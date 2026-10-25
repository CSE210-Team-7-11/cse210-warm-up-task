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
* **Numbers:** after resolving the number format below, accept anything JavaScript's `Number()` reads as finite, including hex, scientific notation, and surrounding whitespace.
* **Anything else**, including the text `Infinity`, is invalid and reported as a diagnostic. An invalid X skips the row.

### Number format

The field delimiter and the decimal separator are separate settings. A semicolon-delimited file can use decimal points or decimal commas; its delimiter must never cause `1.5` to become `15`.

* Import offers **Auto**, **decimal point (`.`)**, and **decimal comma (`,`)**. The user can override automatic detection, including when it detected the wrong format.
* In Auto, a numeric field containing both `.` and `,` provides evidence for the file's format: the rightmost separator is the decimal separator, provided the other separator forms valid groups of three digits. For example, `1,010.5` suggests decimal points and `1.010,5` suggests decimal commas. Use consistent evidence from any such field to interpret the other numeric fields in the file.
* Without evidence from a field containing both separators, default to comma thousands separators and decimal points. For example, `1,010` becomes `1010`, `1.500` becomes `1.5`, and `1.5` remains `1.5`. These values do not require a manual choice.
* If fields containing both separators provide conflicting or ambiguous format evidence, report a diagnostic and retain the default format unless the user selects another. Preserve the original text so the user can correct the interpretation. A value containing only one kind of separator does not trigger an ambiguity diagnostic merely because another locale could interpret it differently.
* For numeric conversion, remove valid thousands separators and represent the decimal separator as `.` so JavaScript's `Number()` can read the value. For example, `1,010.5` with decimal points and `1.010,5` with decimal commas both become `1010.5`. This changes the text used for conversion, not the numeric value or the source file. A value that does not fit the chosen format is reported as invalid rather than repaired by stripping arbitrary punctuation.

### Consequences

* Good: files exported from spreadsheets behave the way their authors expect.
* Good: users can import files from different locales without editing the CSV first, and automatic detection reduces manual setup when the format is clear.
* Good: users retain the default comma-thousands and decimal-point behaviour, and can correct a detected format or resolve conflicting format evidence without editing the source file.
* Bad: detection adds parsing and testing complexity, especially for chunked imports where format evidence may appear after earlier values have been read. Changing the format requires importing the file again.
* Bad: a formula that returns `""` in Excel exports as an empty field, so we draw a gap where Excel drew zero.
