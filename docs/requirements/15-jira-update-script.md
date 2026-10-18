# 15 - Jira Update Script

Planning sessions change story points, SLA days, architects and the order of work.
**Export Jira updates** turns those changes into a shell script with one `curl`
command per change. The script can be run in a macOS (zsh or bash) terminal, or
its lines can be pasted in one at a time. It writes the changes back to Jira with a
personal access token (PAT) read from the `JIRA_PAT` environment variable.

```bash
export JIRA_PAT='your-personal-access-token'
bash jira-updates-2026-10-18.sh
```

Each line prints the change and the HTTP status, for example
`A-1 story points 5 to 8 -> HTTP 204`. Jira returns `204` when an update succeeds.

## What counts as a change

| Change       | Detected when                                                                                                                                                           | Jira request                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Story points | The value differs from the Jira CSV that was imported.                                                                                                                  | `PUT /rest/api/2/issue/{key}` with the story points field.                                |
| SLA days     | The value differs from the Jira CSV that was imported.                                                                                                                  | `PUT /rest/api/2/issue/{key}` with the SLA field.                                         |
| Architect    | A staff member is picked in the grid (or Auto resolves to one) and the name differs from Jira. Optionally also architects chosen by crew pools or auto-assign.          | `PUT /rest/api/2/issue/{key}` with the architect field.                                   |
| Plan order   | Rows were dragged out of Jira rank order. Only the fewest items needed are moved; each is ranked after its new predecessor (or before the first unmoved item if first). | `PUT /rest/agile/1.0/issue/rank` with `rankAfterIssue` or `rankBeforeIssue`, in sequence. |

Changing a value and then setting it back is not a change. Field edits come first
in plan order, followed by the rank moves, which must run in the order written.

## Settings (Settings tab > Jira update script)

| Setting               | Default                   | Notes                                                                                     |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Jira server           | `https://jira.pncint.net` | `https://` is added when missing.                                                         |
| Story points field id | blank                     | For example `customfield_10002`. Field ids differ per Jira server; see below.             |
| SLA days field id     | blank                     |                                                                                           |
| Architect field id    | blank                     |                                                                                           |
| Architect field type  | User picker               | User picker sends `{"name": username}`, select list `{"value": name}`, text the name.     |
| Jira usernames        | -                         | Shown per staff member when the architect field is a user picker.                         |
| Include plan order    | on                        | Writes rank moves.                                                                        |
| Also write forecasts  | off                       | Also writes architects picked by crew pools or auto-assign for items without an override. |

To list the field ids on your server:

```bash
curl -sS -H "Authorization: Bearer $JIRA_PAT" https://jira.pncint.net/rest/api/2/field
```

## Requirements

| ID           | Priority | Description                                              | Acceptance criteria                                                                                                                                  |
| ------------ | -------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-JIRA-001 | Must     | Story point and SLA edits are detected.                  | The imported Jira values are kept on each item; only values that differ from them are exported.                                                      |
| REQ-JIRA-002 | Must     | Architect changes are detected.                          | A grid override (or Auto resolved to a staff member) whose name differs from the Jira architect is exported.                                         |
| REQ-JIRA-003 | Should   | Forecast architects can be exported.                     | With "Also write architects chosen by crew pools or auto-assign" on, open items without an override export their forecast architect when it differs. |
| REQ-JIRA-004 | Must     | Plan order is written as Jira rank moves.                | Replaying the moves in order on the Jira rank order gives the plan order; items that keep their relative order are not moved.                        |
| REQ-JIRA-005 | Must     | The export is a script with one curl command per change. | Every command is a single line that sends `Authorization: Bearer $JIRA_PAT` and JSON to the configured Jira server.                                  |
| REQ-JIRA-006 | Must     | The script checks the token.                             | Running the script without `JIRA_PAT` set stops before any request with a message.                                                                   |
| REQ-JIRA-007 | Must     | Field ids and types are configurable.                    | Field ids, architect field type and Jira usernames are set in Settings and saved with the project.                                                   |
| REQ-JIRA-008 | Must     | Changes that cannot be sent are reported.                | Changes without a field id, username or with rank export off are listed as comments in the script and counted in the notification.                   |
| REQ-JIRA-009 | Must     | Values are quoted safely.                                | Names with quotes or `%` reach Jira unchanged in bash and zsh.                                                                                       |
| REQ-JIRA-010 | Must     | Export is available from the header.                     | "Export Jira updates" downloads `jira-updates-YYYY-MM-DD.sh`; with no changes it shows a message instead.                                            |
