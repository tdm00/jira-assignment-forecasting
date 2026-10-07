# Jira Gantt Forecaster

A single-file, offline web app for planning architecture work with your product team.
Load your staff list, vacations, organization closures and a Jira CSV export, then
reorder the work and edit estimates while a live Gantt chart forecasts when each item
will start and finish.

- **One HTML file.** Everything (JavaScript, CSS, icons) is inlined into `index.html`.
  Open it straight from disk (`file://`) with no server or internet connection.
- **Drag and drop data.** Drop CSV files anywhere in the app; the type of each file is
  detected from its header row.
- **Capacity-aware forecast.** Each architect works one item at a time in plan order,
  skipping weekends, organization closures and their own vacations. Unassigned items
  go to the next available architect.
- **Live what-if planning.** Drag rows to reprioritize, edit story points or SLA, change
  the architect, and the Gantt updates immediately.
- **Search and filter** by summary, one or more architects, and one or more crews.
- **Saved automatically** in the browser, with project export/import (JSON) and plan
  export (CSV).

## Using the app

1. Download `index.html` from the latest CI run (artifact `jira-gantt-forecaster`) or a
   GitHub release, or build it yourself (see below).
2. Open it in Chrome, Edge, Firefox or Safari.
3. Add staff (Staff tab, or drop a staff CSV), vacations and closures.
4. Drop your Jira CSV export. Try **Load sample data** to explore first.

### Input files

| File        | Required columns                                                                                                    | Example                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Staff       | `Name` (or a plain list, one name per line)                                                                         | [staff.csv](docs/sample-data/staff.csv)             |
| Vacations   | `Staff`, `Start Date`, optional `End Date`, `Note`                                                                  | [vacations.csv](docs/sample-data/vacations.csv)     |
| Closures    | `Date`, optional `End Date`, `Name`                                                                                 | [closures.csv](docs/sample-data/closures.csv)       |
| Jira export | `Issue key`, `Summary`, `Crew`, `Architect`, `Status`, `Story Points`, `SLA Days`, `Start date`, `Due date`, `Rank` | [jira-export.csv](docs/sample-data/jira-export.csv) |

Jira `Custom field (...)` headers and several aliases are recognised. See
[docs/requirements/02-data-import.md](docs/requirements/02-data-import.md).

### Forecast rules

Items are worked in plan order. Each architect works one item at a time, and an item
takes its SLA in working days (or story points x days-per-point when SLA is blank).
In-progress items are scheduled first, and Done items use no capacity. The full rules
are in [docs/requirements/08-scheduling-forecast.md](docs/requirements/08-scheduling-forecast.md).

## Development

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev            # local dev server with hot reload
npm run build          # produces dist/index.html (single file)
```

### Tests

```bash
npm run test:unit         # Vitest unit tests (core logic, parsers, state)
npm run test:integration  # Vitest + React Testing Library against the App
npm run test:coverage     # both, with coverage thresholds
npx playwright install chromium
npm run build && npm run test:e2e   # Playwright against file://dist/index.html
```

Lint, format and typecheck: `npm run lint`, `npm run format:check`, `npm run typecheck`.

### Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs lint, format check, typecheck,
unit and integration tests with coverage, the build, and the end-to-end tests on every push
and pull request. It uploads `dist/index.html` as the `jira-gantt-forecaster` artifact.
Pushing a `v*` tag also attaches the file to a GitHub release.

## Project structure

```
src/
  core/        pure business logic: calendar, scheduler, filters, rank
  parsers/     CSV parsing and file type detection
  state/       reducer, persistence, import/export
  components/  React UI (grid, Gantt, panels, filters)
  styles/      theme and layout CSS (light and dark)
tests/
  unit/        Vitest unit tests
  integration/ Vitest + Testing Library tests of the App
  e2e/         Playwright tests of the built file
  fixtures/    small deterministic CSV inputs
docs/
  requirements/  requirements by category, with IDs referenced by tests
  sample-data/   example input files
```

## Documentation

Requirements are documented by category in [docs/](docs/README.md).
