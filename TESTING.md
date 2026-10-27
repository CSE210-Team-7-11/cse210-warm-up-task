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

## Browser tests

Browser tests live in `e2e/` with `.spec.js` filenames. `npm test` runs only the Node tests in `test/`. The demo smoke test checks that the editor loads and displays its sample chart without uncaught JavaScript errors.

### Chromium

Install Chromium after installing npm dependencies, then run its tests:

```sh
npx playwright install chromium
npm run test:e2e:chromium
```

### Firefox

Install Firefox after installing npm dependencies, then run its tests:

```sh
npx playwright install firefox
npm run test:e2e:firefox
```

### Both browsers

After installing both browsers, run the suite in both with:

```sh
npm run test:e2e
```

Append `-- --headed` to any browser test command to watch it run in a browser window.

### Server and reports

Playwright starts a local Vite server on an available port and stops it afterward. It uses Vite's reported URL, including the configured base path. Use relative paths such as `page.goto('demo.html')` in tests.

To choose a specific server port, set `E2E_PORT` with any browser test command. For example:

```sh
E2E_PORT=4300 npm run test:e2e:firefox
```

The default, `E2E_PORT=0`, selects an available port automatically.

Failed tests retain screenshots and traces in `test-results/`. Open the HTML report with:

```sh
npx playwright show-report --port 0
```

The report viewer also chooses an available port. Replace `0` with a specific port when needed.

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

This runs the unit suite with Node's experimental coverage support, prints a file-level summary, and writes `coverage/lcov.info` for coverage viewers. No coverage thresholds are enforced.

The coverage command and file selection are configured in [`scripts/test-coverage.sh`](scripts/test-coverage.sh).

The report covers `src/graph/*.js` and its shared `src/numericErrors.js` and `src/diagnostics.js` modules. It shows line, branch, and function coverage, along with uncovered line numbers. Node reports files loaded during the run; check that new library modules appear when adding them. Import utilities, demo components, and website scripts are outside this report's scope.

The chart lifecycle test in `test/chart-lifecycle.test.js` imports `Graph.js` directly through Node, with an empty-module loader hook for `Graph.css`. Node omits execution through Vite's SSR loader from the report, so coverage can undercount code exercised by those tests. The chart tests use mocked canvas and browser objects; check rendering and interactions in the browser as well.

Coverage records execution. Use uncovered paths to identify missing cases, and review assertions to ensure the tests check the intended behavior.
