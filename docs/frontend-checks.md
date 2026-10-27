# Frontend checks

Use this checklist for the file-import, chart-control, and error-feedback area.
Record the commit, environment, actual result, and any limitations when running
it. An unchecked item is not a passing result. Homepage/example/live-editor and
full keyboard/accessibility coverage can be added by their respective owners.

## Existing automated checks

```sh
npm ci
node --test test/import-feedback.test.js test/chart-preview.test.js
npm test
npm run format:check
npm run lint
npm run build
```

| Behavior                                                                                             | Existing test files                                |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| File rejection, diagnostic wording, source positions and data summary                                | `test/import-feedback.test.js`                     |
| Rendered feedback, precision/overflow messages, typed import source positions and missing-cell notes | `test/chart-preview.test.js`                       |
| Chunked import parity, typed-column conversion, byte boundaries and large inputs                     | `test/chunked-import.test.js`                      |
| Gap/Zero/Connect and unchanged imported data                                                         | `test/empty-cells-option.test.js`                  |
| Series alignment, settings and adapter behavior                                                      | `test/chart-adapter.test.js`, `test/state.test.js` |

The rendered-feedback tests use React server rendering. They cannot validate
click handlers, browser focus, asynchronous upload races, Canvas pixels, or
screen-reader announcements. Use browser checks for those boundaries. The
shared [Playwright suite](../TESTING.md#browser-tests) includes demo loading,
chart-type keyboard checks, and a report-only axe baseline in Chromium and
Firefox. Those checks do not establish that every workflow below has passed.

## Repeatable editor walkthrough

Run `npm run dev`, open `/cse210-warm-up-task/demo.html`, and start with the
sample chart. Prepare the following small files.

`missing-values.csv`:

```csv
X,A
1,2
2,
3,#N/A
4,8
5,10
```

`invalid-value.csv`:

```csv
X,A
3,30
1,bad
2,20
```

`invalid-x.csv`:

```csv
X,A
bad,2
#N/A,3
,4
```

| ID  | Action                                                                   | Expected result                                                                                                                     |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Import missing-values.csv                                                | Filename, five retained rows, one series. Empty-cell note; no nonnumeric warning for `#N/A`.                                        |
| F2  | Change Gap → Zero → Connect                                              | Plot responds to the empty Y at X=2. `#N/A` remains a skip. Zero mode hides the empty-cell note.                                    |
| F3  | Import invalid-value.csv                                                 | Warning identifies `bad` at source data row 2, even though sorting moves its X first. Other usable values remain available.         |
| F4  | Then import invalid-x.csv                                                | Rejection explains that no valid X values exist. Filename/summary and graph retain the previously accepted dataset.                 |
| F5  | Try an unsupported extension or a file with a missing closing quote      | Actionable rejection; previously accepted data remains.                                                                             |
| C1  | Switch line/scatter, edit title and axis labels                          | Chart type and text update without replacing data.                                                                                  |
| C2  | Set a line marker to None, switch to scatter, then back                  | Scatter uses circles; line retains None.                                                                                            |
| C3  | Change a series color, empty-cell mode and title, then reset             | Title/display defaults return; imported data, chart type, empty-cell mode, and series styling remain.                               |
| C4  | Import more than 11 series; choose a color and Plot for an extra series  | Only the explicitly enabled extra series begins plotting; its warning clears appropriately.                                         |
| A1  | Use Tab and Enter/Space on the upload control and chart-type buttons     | Focus is visible and controls activate without a mouse. Record the actual browser result separately.                                |
| R1  | Start a slow upload, then choose a second file before the first finishes | The older request cannot replace the newer result. This requires a controlled browser test; a static-render test does not cover it. |

For each completed row, record actual results rather than checking off an
expectation. Keep failures and untested rows visible for the team run-through.

## Checkoff evidence

For each demonstrated improvement, keep four items together: the original
problem, the changed files or PR, why the change helps maintain the project,
and the verification result. Separate existing Part 2 behavior from the new
Part 3 documentation or testing contribution. Local work, an open PR, and a
merged change are different states and should be described accordingly.
