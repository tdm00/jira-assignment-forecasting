# 11 - Non-functional Requirements

| ID          | Priority | Description                 | Acceptance criteria                                                                                                               |
| ----------- | -------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| REQ-NFR-001 | Must     | Single self-contained file. | All JavaScript, CSS and icons are inlined in `index.html`.                                                                        |
| REQ-NFR-002 | Must     | Offline operation.          | The app makes no network requests (verified by end-to-end tests).                                                                 |
| REQ-NFR-003 | Must     | Browser support.            | Latest Chrome, Edge, Firefox and Safari.                                                                                          |
| REQ-NFR-004 | Must     | Performance.                | Scheduling 500 items with 20 architects completes in under 100 ms; the UI stays responsive while editing.                         |
| REQ-NFR-005 | Should   | File size.                  | The built file is under 1 MB.                                                                                                     |
| REQ-NFR-006 | Must     | Data privacy.               | Data stays in the browser; nothing is uploaded.                                                                                   |
| REQ-NFR-007 | Must     | Maintainability.            | TypeScript strict mode, ESLint and Prettier pass in CI. Business logic (calendar, scheduler, parsers) is pure and UI-independent. |
| REQ-NFR-008 | Must     | Time-zone safety.           | Dates are handled as calendar dates (`YYYY-MM-DD`) so results do not shift with the user's time zone.                             |
