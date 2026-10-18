# 15 - Jira Update File

Planning sessions change story points, SLA days, architects, dates and the order of
work. The **Jira update file** button turns those changes into a shell script with
one `curl` line per issue. The script can be run in a macOS (zsh or bash) terminal, or
its lines can be pasted in one at a time. It writes the changes back to Jira with a
personal access token (PAT) read from the `JIRA_PAT` environment variable, and adds
a comment to each updated issue with the meeting notes and every field's from and to
values.

```bash
export JIRA_PAT='your-personal-access-token'
bash jira-updates-2026-10-20.sh
```

## Workflow

1. After the working session, the solution architect manager clicks **Jira update file**.
2. A dialog shows how many issues will be updated, how many rank moves will be made, and
   how many changes cannot be sent yet (for example because a field id is missing).
3. The **Meeting notes** box starts with
   `Based on a meeting on October 20, 2026, the following fields of this Jira issue changed:`
   and can be edited. A preview shows the comment for the first issue. Comments can be
   turned off with **Add a comment to each updated issue**.
4. **Download update file** saves `jira-updates-YYYY-MM-DD.sh`.

An example comment:

```text
Based on a meeting on October 20, 2026, the following fields of this Jira issue changed:

* Story points: 5 to 8
* SLA days: 3 to 4
* Architect: Bob Martinez to Alice Chen
* Target start: 2026-11-09 to 2026-11-10
* Target end: blank to 2026-11-16
```

## What counts as a change

| Change       | Detected when                                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Story points | The value differs from the Jira CSV that was imported.                                                                                                                  |
| SLA days     | The value differs from the Jira CSV that was imported.                                                                                                                  |
| Architect    | A staff member is picked in the grid (or Auto resolves to one) and the name differs from Jira. Optionally also architects chosen by crew pools or auto-assign.          |
| Target start | The forecast start of an open (planned or in-progress) item differs from the Jira start date. Done and unscheduled items are not changed.                               |
| Target end   | The forecast end of an open item differs from the Jira end (due) date.                                                                                                  |
| Plan order   | Rows were dragged out of Jira rank order. Only the fewest items needed are moved; each is ranked after its new predecessor (or before the first unmoved item if first). |

Changing a value and then setting it back is not a change.

## The script

- One line per issue: `PUT /rest/api/2/issue/{key}` with all of the issue's changed
  fields, then `&&` `POST /rest/api/2/issue/{key}/comment`. The update uses
  `--fail-with-body`, so the comment is only added when the update succeeds and Jira's
  error message is shown when it does not (needs curl 7.76 or later, macOS 12+).
- Then one line per rank move: `PUT /rest/agile/1.0/issue/rank` with `rankAfterIssue` or
  `rankBeforeIssue`. These must run in the order written and are not commented.
- Each line prints what it changed and the HTTP status (`204` fields updated, `201`
  comment added).
- The header repeats the meeting notes and lists changes that were left out and why. A
  guard line stops the script before any request when `JIRA_PAT` is not set.

## Settings (Settings tab > Jira update file)

| Setting               | Default                   | Notes                                                                                     |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Jira server           | `https://jira.pncint.net` | `https://` is added when missing.                                                         |
| Story points field id | blank                     | For example `customfield_10002`. Field ids differ per Jira server; see below.             |
| SLA days field id     | blank                     |                                                                                           |
| Architect field id    | blank                     |                                                                                           |
| Target start field id | blank                     | For example the Advanced Roadmaps `Target start` custom field.                            |
| Target end field id   | blank                     | A `Target end` custom field, or `duedate` for the Jira due date.                          |
| Architect field type  | User picker               | User picker sends `{"name": username}`, select list `{"value": name}`, text the name.     |
| Jira usernames        | -                         | Shown per staff member when the architect field is a user picker.                         |
| Target dates          | on                        | Set target start and end to the forecast dates.                                           |
| Include plan order    | on                        | Writes rank moves.                                                                        |
| Also write forecasts  | off                       | Also writes architects picked by crew pools or auto-assign for items without an override. |

To list the field ids on your server:

```bash
curl -sS -H "Authorization: Bearer $JIRA_PAT" https://jira.pncint.net/rest/api/2/field
```

## Requirements

| ID           | Priority | Description                                          | Acceptance criteria                                                                                                                                                                          |
| ------------ | -------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-JIRA-001 | Must     | Story point and SLA edits are detected.              | The imported Jira values are kept on each item; only values that differ from them are exported.                                                                                              |
| REQ-JIRA-002 | Must     | Architect changes are detected.                      | A grid override (or Auto resolved to a staff member) whose name differs from the Jira architect is exported.                                                                                 |
| REQ-JIRA-003 | Should   | Forecast architects can be exported.                 | With "Also write architects chosen by crew pools or auto-assign" on, open items without an override export their forecast architect when it differs.                                         |
| REQ-JIRA-004 | Must     | Plan order is written as Jira rank moves.            | Replaying the moves in order on the Jira rank order gives the plan order; items that keep their relative order are not moved.                                                                |
| REQ-JIRA-005 | Must     | The export is a script with one curl line per issue. | Every line sends `Authorization: Bearer $JIRA_PAT` and JSON to the configured Jira server and updates all of that issue's changed fields at once.                                            |
| REQ-JIRA-006 | Must     | The script checks the token.                         | Running the script without `JIRA_PAT` set stops before any request with a message.                                                                                                           |
| REQ-JIRA-007 | Must     | Field ids and types are configurable.                | Field ids, architect field type and Jira usernames are set in Settings and saved with the project.                                                                                           |
| REQ-JIRA-008 | Must     | Changes that cannot be sent are reported.            | Changes without a field id, username or with rank export off are listed in the dialog count, as comments in the script and in the notification.                                              |
| REQ-JIRA-009 | Must     | Values are quoted safely.                            | Names and notes with quotes or `%` reach Jira unchanged in bash and zsh.                                                                                                                     |
| REQ-JIRA-010 | Must     | The update file is created from the header.          | "Jira update file" opens the dialog and "Download update file" saves `jira-updates-YYYY-MM-DD.sh`; with no changes it shows a message instead.                                               |
| REQ-JIRA-011 | Must     | Target dates follow the forecast.                    | With target dates on, open items whose forecast start or end differs from Jira export the forecast date as `YYYY-MM-DD`.                                                                     |
| REQ-JIRA-012 | Must     | Each updated issue gets a meeting comment.           | The comment is the editable note (default "Based on a meeting on <date>, ...") followed by one bullet per changed field with from and to values; it is only posted when the update succeeds. |
