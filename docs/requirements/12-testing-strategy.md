# 12 - Testing Strategy

## Test levels

| Level       | Tool                                   | Location             | Scope                                                                   |
| ----------- | -------------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| Unit        | Vitest                                 | `tests/unit/`        | Pure modules: calendar, scheduler, parsers, filters, rank, persistence. |
| Integration | Vitest + React Testing Library (jsdom) | `tests/integration/` | The `App` component with real parsers, store and scheduler.             |
| End-to-end  | Playwright (Chromium)                  | `tests/e2e/`         | The built `dist/index.html` opened via `file://`.                       |

Test names include requirement IDs (for example `REQ-SCH-004`) so requirements
can be traced to tests with a text search.

## Commands

```bash
npm run test:unit
npm run test:integration
npm run test:coverage   # unit + integration with coverage
npm run build && npm run test:e2e
```

## Requirements

| ID          | Priority | Description                                         | Acceptance criteria                                                                                                      |
| ----------- | -------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| REQ-TST-001 | Must     | Unit tests cover business logic.                    | Calendar, scheduler, parsers and filters have unit tests; line coverage of `src/core` and `src/parsers` is at least 90%. |
| REQ-TST-002 | Must     | Integration tests cover main workflows.             | Import, filter, edit, reorder and persistence are tested through the UI component tree.                                  |
| REQ-TST-003 | Must     | End-to-end tests run against the built single file. | Tests open `file://.../dist/index.html`, drop files, reorder with the mouse, edit cells and export.                      |
| REQ-TST-004 | Must     | Tests are deterministic.                            | Tests set the forecast start date explicitly and do not depend on today's date or time zone.                             |
| REQ-TST-005 | Must     | Tests run in CI.                                    | All three levels run on every push and pull request.                                                                     |
