# 09 - Persistence and Export

## Requirements

| ID          | Priority | Description                                    | Acceptance criteria                                                                                                            |
| ----------- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| REQ-PER-001 | Must     | The working session is saved automatically.    | Staff, vacations, closures, items (including order and edits) and settings are saved to browser `localStorage` on each change. |
| REQ-PER-002 | Must     | The session is restored on reopen.             | Reloading the page restores the previous session.                                                                              |
| REQ-PER-003 | Must     | The session can be exported as a project file. | "Export project" downloads a `.json` file with all data.                                                                       |
| REQ-PER-004 | Must     | A project file can be imported.                | Dropping or picking an exported `.json` file restores that session, replacing the current one.                                 |
| REQ-PER-005 | Should   | The plan can be exported as CSV.               | "Export CSV" downloads items in plan order with forecast start/end, assigned architect, SP and SLA.                            |
| REQ-PER-006 | Must     | Data can be cleared.                           | "Clear all" (with confirmation) removes all data and the saved session.                                                        |
| REQ-PER-007 | Should   | Storage failures do not break the app.         | If `localStorage` is unavailable, the app still works for the session and shows a warning.                                     |
| REQ-PER-008 | Must     | Project files are versioned.                   | Exported JSON contains `app` and `version` fields; incompatible files are rejected with a message.                             |
| REQ-PER-009 | Must     | Crew pools and the baseline are persisted.     | See REQ-POOL-013. The plan CSV includes an `Assigned Via` column.                                                              |
