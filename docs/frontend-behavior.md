# Frontend behavior

This guide describes the existing React editor in `demo.html`: file import,
chart controls, and error feedback. It complements the [application integration](architecture.md#import-and-application-integration)
and [verification checklist](frontend-checks.md). It does not define new APIs.

## Ownership and data flow

`App.jsx` owns the dataset and presentation state. `DataPanel` reads and validates
files before requesting a state replacement. `ChartTypePicker` and `SpecsPanel`
send settings patches. `ChartPreview` prepares input through `prepareChart(state)`
and manages the Canvas chart lifecycle through `createChart`, `update`, and `destroy`.

| Action                                   | State change                                                                            | What stays in place                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Accept a new file                        | Replace source name, column metadata, numeric columns, parser issues, and series styles | Chart type, empty-cell choice, titles, axis labels, and point settings |
| Reject a file                            | Display the rejection in DataPanel; do not call `onImport`                              | Previous dataset and chart settings                                    |
| Switch line/scatter                      | Change `chartType`                                                                      | Dataset and saved styles, including a line marker set to None          |
| Change Gap/Zero/Connect                  | Change `emptyCells`; prepare chart data again                                           | Imported numeric columns; the file is not reread                       |
| Edit title, axis label, color, or marker | Patch the relevant field or series                                                      | Dataset and unrelated settings                                         |
| Reset to defaults                        | Restore the fields in `DEFAULT_SPECS`                                                   | Dataset, chart type, empty-cell choice, per-series colors and markers  |

The reset label should not be interpreted as reloading sample data or undoing
every customization. The behavior above follows the current `App.resetSpecs`.

## File import

The editor accepts `.csv`, `.tsv`, and `.txt` filenames, case-insensitively. An
Excel file is rejected with advice to export CSV. There is no frontend file-size
cutoff; that is not a claim that every file size fits available memory.

1. `checkFile(file)` validates the extension without reading contents.
2. `importFile(file, { emptyCells: 'mark' })` reads in chunks and returns typed
   numeric columns plus diagnostics. The first column is X; the others are Y
   series. Usable rows are sorted by X. The initial sample still uses row arrays.
3. `checkParsed(result, file.name)` rejects empty input, missing closing quotes,
   fewer than two columns, or no usable data rows. Other diagnostics are shown
   as feedback on the accepted data.
4. Only the latest requested read may update the panel or invoke `onImport`.
   Starting another import supersedes the earlier request; it does not cancel
   the earlier file-reading computation.
5. On success, App rebuilds series styles from the new columns. The first 11
   series receive automatic colors; later series need an explicit color and
   the Plot action before they are drawn.

The public `parseDelimited(text)` helper still exists for text callers and tests.
The upload panel uses `importFile`, so its contract must also work without `rows`.

## Missing values and feedback

| Input                                      | Current behavior                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Empty X, `#N/A` in X, or other invalid X   | Omit the row and report its source location. Reject the file if no usable X rows remain.                  |
| Empty Y                                    | Keep a `NaN` marker during upload; prepare a gap, zero, or connection according to the editor setting.    |
| `#N/A` in Y                                | Supported skip marker (`-Infinity`); line charts connect across it, and no nonnumeric warning is shown.   |
| Other nonnumeric Y, such as `bad` or `n/a` | Report the original text and location; represent the invalid value as a gap (`+Infinity`).                |
| Numeric zero                               | Valid plotted value.                                                                                      |
| Numeric overflow                           | Reject the file or block chart rendering, depending on where it occurs; display a specific numeric error. |
| Representable value with precision loss    | Keep the data and show rounding details. Precision-warning lists are bounded.                             |

Parser diagnostic positions refer to **source data records**, excluding the
header and blank records. Displayed positions start at one. They are neither
sorted chart indexes nor physical file line numbers: quoted multiline fields
can make those differ.

`findIssues` uses parser diagnostics and adds a missing-color warning. It does
not rescan typed values to reconstruct the original input. `describeIssue`
returns plain text; React escapes it when rendering. Empty-cell notes are hidden
in Zero mode; genuine invalid-number warnings remain visible. A supported `#N/A`
marker alone does not make the import invalid.

General import rejections use `role="alert"`; ongoing feedback uses
`role="status"`. These attributes are useful semantics, not evidence of a full
screen-reader or accessibility audit.

## Chart controls

- Chart type buttons expose their selection with `aria-pressed`.
- Editing an axis label changes its displayed text, not the data-column mapping.
- Colors and marker shapes belong to individual series. None is offered for
  line markers; scatter displays a circle for that saved choice and preserves
  it for a later switch back to line.
- Point size is adjustable from 2 through 12. Its control is visible on scatter
  charts and on line charts when Show data points is enabled.
- The preview counts finite values across enabled series. Its current render
  threshold is two points in total, even though the empty-state text says
  "at least two numeric rows."

## Maintenance boundaries

Parser and rendering semantics are shared contracts described in ADR-0006 and
ADR-0007. Coordinate changes to those contracts with their owners. This guide
does not assign unfinished homepage, examples, live-editor, chart-integration,
or accessibility work to the author of the import/control documentation.

The shared tooling is described in [Contributing](../CONTRIBUTING.md) and
[Testing](../TESTING.md). Browser tests use Playwright with Chromium and Firefox.
JavaScript type diagnostics remain advisory; axe scans record existing findings
rather than enforcing zero violations. The generated JSDoc reference covers the
chart library and shared numeric utilities, not these React component comments.
Record results for the actual commit being demonstrated.
