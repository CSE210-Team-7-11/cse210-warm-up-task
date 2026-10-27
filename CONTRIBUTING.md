# Contributing

## Local setup

Install Node.js >=22.23.4.

From the repository root, install the dependencies:

```sh
npm ci
```

### Work on the website or library

```sh
npm run dev
```

Open the URL printed by Vite.

### Work on the documentation

```sh
npm run docs:dev
```

Astro serves the public documentation. In local builds, open the URL printed by this command.

The source files and live-example setup are described under [Documentation site](#documentation-site).

### Build and preview

Build the complete site, then preview the result:

```sh
npm run build
npm run preview
```

The build runs Vite first, producing the website in `dist/`, then Astro, producing the documentation in `dist/docs/`. This ordering matters because Vite clears `dist/`. The GitHub Pages artifact includes both outputs.

For a documentation-only change, `npm run docs:build` builds just the user guide and `npm run docs:preview` previews it.

## Making a code change

For chart changes, start with the [rendering pipeline](docs/architecture.md#from-options-to-a-drawing). For import or demo changes, see [Import and application integration](docs/architecture.md#import-and-application-integration).

Before changing shared data structures, check the [library interfaces](docs/interfaces.md). Agree shared interface changes with the leads, as recorded in [ADR-0007](docs/decisions/0007-data-contract.md), and update the modules that produce and consume the changed data together.

Update JSDoc annotations and relevant documentation when behavior changes. Follow the [JSDoc conventions](docs/jsdoc.md).

## Documentation site

Edit the public documentation in `docs/user-guide/`:

- `index.md`: documentation landing page.
- `getting-started.md`: walkthrough with live chart examples.
- `api.md`: chart inputs, configuration, and methods.

### Rendering and links

Astro builds the Markdown files directly inside `docs/user-guide/` with the shared layout in `docs/site/layouts/Docs.astro`. The layout supplies navigation and links to the page's sections. `docs/site/middleware.js` converts local `.md` links into `.html` links in rendered pages, preserving source links for GitHub readers.

The site uses static HTML and ordinary browser JavaScript. Its generated `.astro/` files and build output are ignored by Git.

### Live chart examples

`docs/site/components/ChartExamples.astro` registers a browser custom element for each example in the getting-started guide. The element calls the chart library, hides its fallback image after mounting, and destroys the chart when removed. The images remain available with JavaScript disabled and in repository Markdown views.

The example configurations are in `docs/site/examples/sales.js`. Keep them consistent with the displayed code and data tables when changing an example. Verify the live result, hover, resizing, and static image fallback; regenerate the images from the library output when the result changes.

## Check a change

Before requesting review, run:

```sh
npm run lint
npm test
npm run build
```

Oxlint checks the source code. The Node test suite covers imports, data preparation, chart calculations, drawing, and demo components. The build checks the website and public documentation.

For renderer or demo changes, check the affected behavior in the browser, including hover, resizing, chart switching, controls, and import feedback as applicable. For documentation changes, check the rendered page, links, and any affected examples.

To run one test file, use a command such as `node --test test/chart-adapter.test.js`. Import fixtures in `test/fixtures/` pair each CSV/TSV with expected JSON. When deliberately changing those expectations, run `UPDATE_FIXTURES=1 node --test test/import-fixtures.test.js` and review the generated diff.

## Prepare a review

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). For example, `docs: describe the chart lifecycle` or `fix: preserve gaps after sorting`.

For bug fixes, include a small input example and the expected behavior in the pull request.

Record agreed technical decisions in an [ADR](docs/decisions/README.md), using the lightweight MADR format established in ADR-0001, and add it to the decision index. Include the rationale and alternatives considered. Discuss changes to an accepted decision with the team before updating its record.

Every pull request requires an approving review from someone other than its author before merging. Authors must understand, explain, and be able to build on their contributed code, including AI-assisted code, under [ADR-0002](docs/decisions/0002-ai-usage.md). The same policy excludes AI use for visual or UI design.

## CI and deployment

GitHub Actions runs lint, tests, and the combined production build for every pull request and pushes to `main`. The separate deployment workflow repeats these checks before deploying `main` to GitHub Pages. Both workflows use Node 24.
