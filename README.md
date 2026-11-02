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
- **Crew pools and what-if scenarios.** Give each crew a primary architect plus a
  backup 2 or 3, choose how the pool picks (primary only, backup if much sooner, or
  earliest available), and compare against a frozen baseline with per-item deltas and
  ghost bars on the Gantt.
- **Architect focus.** Forecast one architect's work for one crew, then add their other
  crews to see the combined plan.
- **Search and filter** by summary, one or more architects, and one or more crews.
- **Saved automatically** in the browser, with project export/import (JSON) and plan
  export (CSV).
- **Write changes back to Jira.** Create a Jira update file: a curl script that uses your
  Jira personal access token to update story points, SLA, architect, target start and end,
  and plan order, and comments on each changed issue with your meeting note and only
  the fields and rank move that changed.

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
| Crew pools  | `Crew`, `Architect`, `Role` (1-3), optional `Available From`                                                        | [crew-pools.csv](docs/sample-data/crew-pools.csv)   |
| Jira export | `Issue key`, `Summary`, `Crew`, `Architect`, `Status`, `Story Points`, `SLA Days`, `Start date`, `Due date`, `Rank` | [jira-export.csv](docs/sample-data/jira-export.csv) |

Jira `Custom field (...)` headers and several aliases are recognised. See
[docs/requirements/02-data-import.md](docs/requirements/02-data-import.md).

### Forecast rules

Items are worked in plan order. Each architect works one item at a time, and an item
takes its SLA in working days (or story points x days-per-point when SLA is blank).
In-progress items are scheduled first, and Done items use no capacity. The full rules
are in [docs/requirements/08-scheduling-forecast.md](docs/requirements/08-scheduling-forecast.md).

### Crew pools and architect focus

- **Crews tab:** pick a primary, backup 2 and backup 3 per crew, switch slots on or off,
  and optionally set an available-from date. Use **Seed primaries from Jira** to start.
  Turn on **Use crew pools** (or Settings > Assignment) so the pools decide who works
  each item.
- **Baseline:** click **Set baseline** in the summary. Every later change shows a delta
  column, ghost bars and a finish delta (for example `-6d vs baseline`).
- **Architect focus:** switch from **Team** to **Architect focus**, choose an architect
  and toggle crew chips. Details in
  [docs/requirements/14-crew-pools-and-scenarios.md](docs/requirements/14-crew-pools-and-scenarios.md).

### Writing changes back to Jira

1. In **Settings > Jira update file**, check the Jira server (default
   `https://jira.pncint.net`) and enter the field ids for story points, SLA days,
   architect, target start and target end (`duedate` works for the Jira due date). List
   them with
   `curl -sS -H "Authorization: Bearer $JIRA_PAT" https://jira.pncint.net/rest/api/2/field`.
   For a user picker architect field, enter each architect's Jira username.
2. Click **Jira update file**. Edit the meeting notes (they start as "Based on a meeting
   on <today> at <time>, the following fields of this Jira issue were changed") and click
   **Download update file** to save `jira-updates-YYYY-MM-DD.sh`.
3. In a macOS Terminal:

   ```bash
   export JIRA_PAT='your-personal-access-token'
   bash ~/Downloads/jira-updates-YYYY-MM-DD.sh
   ```

   Or paste the `curl` lines one at a time, in order. Each changed issue gets a separate
   comment with your note and one plain line per field or rank move that is sent. The
   comment is posted only after that issue's updates succeed. Lines print the change and
   HTTP status (`204` updated, `201` comment added). Details in
   [docs/requirements/15-jira-update-script.md](docs/requirements/15-jira-update-script.md).

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
