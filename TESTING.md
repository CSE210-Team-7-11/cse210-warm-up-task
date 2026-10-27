# Testing

Run commands from the repository root after completing [local setup](CONTRIBUTING.md#local-setup).

## Run tests

The tests in `test/` use Node's built-in test runner:

```sh
npm test
```

To run one file:

```sh
node --test test/chart-adapter.test.js
```

Add regression tests alongside the affected module's existing tests, using a small input that reproduces the behavior and assertions for the expected result.

## Import fixtures

Each CSV or TSV in `test/fixtures/` is paired with a `<name>.expected.json` file. Run the fixture tests with:

```sh
node --test test/import-fixtures.test.js
```

When deliberately changing the expected import behavior, regenerate the expected files and review their diff:

```sh
UPDATE_FIXTURES=1 node --test test/import-fixtures.test.js
```

## Library coverage

```sh
npm run test:coverage
```

This runs the unit suite with Node's experimental coverage support, prints a file-level summary, and writes `coverage/lcov.info` for coverage viewers. Generated reports are ignored by Git. No coverage thresholds are enforced.

The coverage command and file selection are configured in [`scripts/test-coverage.sh`](scripts/test-coverage.sh).

The report covers `src/graph/*.js` and its shared `src/numericErrors.js` and `src/diagnostics.js` modules. It shows line, branch, and function coverage, along with uncovered line numbers. Node reports files loaded during the run; check that new library modules appear when adding them. Import utilities, demo components, and website scripts are outside this report's scope.

The chart lifecycle test in `test/chart-lifecycle.test.js` imports `Graph.js` directly through Node, with an empty-module loader hook for `Graph.css`. Node omits execution through Vite's SSR loader from the report, so coverage can undercount code exercised by those tests. The chart tests use mocked canvas and browser objects; check rendering and interactions in the browser as well.

Coverage records execution. Use uncovered paths to identify missing cases, and review assertions to ensure the tests check the intended behavior.
