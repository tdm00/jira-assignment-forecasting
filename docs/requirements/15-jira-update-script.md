# 15 - Jira Update File

Planning sessions change story points, SLA days, architects, dates and the order of
work. The **Jira update file** button turns those changes into a shell script with
one `curl` line per issue. The script can be run in a macOS (zsh or bash) terminal, or
its lines can be pasted in one at a time. It writes the changes back to Jira with a
personal access token (PAT) read from the `JIRA_PAT` environment variable, and adds
a comment to each changed issue with the meeting note and only the fields and rank
move that were sent.

```bash
export JIRA_PAT='your-personal-access-token'
bash jira-updates-2026-10-20.sh
```

## Workflow

1. After the working session, the solution architect manager clicks **Jira update file**.
2. A dialog shows how many issues will be updated, with the counts of story point, SLA,
   date, and architect changes, how many rank moves will be made, and how many changes
   cannot be sent yet (for example because a username is missing, or a field has no id
   and no name).
3. The **Meeting notes** box starts with
   `Based on a meeting on November 2, 2026 at 12:00 PM, the following fields of this Jira issue were changed`
   (the date and time are when the dialog opens, from the browser clock) and can be edited.
   A preview shows the comment for the first issue that will be commented, including a
   rank-only issue when that issue is first. Comments can be turned off with **Add a
   comment to each updated issue**.
4. **Download update file** saves `jira-updates-YYYY-MM-DD.sh`.

An example comment:

```text
Based on a meeting on November 2, 2026 at 12:00 PM, the following fields of this Jira issue were changed

Story Points: 5 to 8
Forecast Start: 2026-11-09 to 2026-11-10
Forecast End: blank to 2026-11-16
SLA: 3 to 4
Architect: Bob Martinez to Alice Chen
Rank: ABC-4 to ABC-9
```

## What counts as a change

| Change       | Detected when                                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Story points | The value differs from the Jira CSV that was imported.                                                                                                                  |
| SLA days     | The value differs from the Jira CSV that was imported.                                                                                                                  |
| Architect    | The architect shown on the row differs from Jira. That includes a grid pick, Auto, a crew pool, and auto-assign. Done items export only a grid pick.                    |
| Target start | The forecast start of an open (planned or in-progress) item differs from the Jira start date. Done and unscheduled items are not changed.                               |
| Target end   | The forecast end of an open item differs from the Jira end (due) date.                                                                                                  |
| Plan order   | Rows were dragged out of Jira rank order. Only the fewest items needed are moved; each is ranked after its new predecessor (or before the first unmoved item if first). |

Changing a value and then setting it back is not a change.

## The script

- One line per field update: `PUT /rest/api/2/issue/{key}` with the issue's changed
  story points, SLA, architect, forecast start, and forecast end. Rank is not on this
  request. The update uses `--fail-with-body` (needs curl 7.76 or later, macOS 12+).
- When a field id is blank, one `GET /rest/api/2/field` before the issue lines looks
  that id up by the field name in Settings (perl, which macOS includes) and reuses it
  for every issue. An id that is filled in is used as-is and is not looked up. If the
  name is not on the server, the script prints a line and leaves that field out of the
  PUT; the other fields on the issue still update.
- When that issue has no rank move, the same line chains `&&`
  `POST /rest/api/2/issue/{key}/comment`, so the comment is added only when the update
  succeeds.
- Then one line per rank move, in order: `PUT /rest/agile/1.0/issue/rank` with
  `rankAfterIssue` or `rankBeforeIssue`.
- A rank-only issue chains `&&` the same comment POST. The comment lists only
  `Rank: ...`. The rank request uses `--fail-with-body` when a comment follows.
- An issue with both a field update and a rank move sets a bash flag on the field line
  (`A_1_ok=0` then `curl PUT && A_1_ok=1`). The key is sanitized for bash 3.2, because
  `A-1` is not a valid variable name. The later rank line, still in move order, is
  `curl PUT rank && [ "$A_1_ok" = 1 ] && curl POST`. The comment lists the field lines
  and the rank line. A failed field update still lets later rank moves run, and skips
  the comment.
- The comment repeats the meeting note, then one plain line per change that is sent.
  Unchanged fields are omitted. There are no wiki bullets. Rank lines are
  `Rank: ABC-4 to ABC-9` (moved from after ABC-4 to after ABC-9),
  `Rank: ABC-4 to before ABC-1` (moved to the front), or `Rank: start to ABC-2` (the
  issue was already first).
- Each line prints what it changed and the HTTP status (`204` fields updated, `201`
  comment added). That status line is a run log; the Jira comment is the POST body.
- The header repeats the meeting notes and lists changes that were left out and why. A
  guard line stops the script before any request when `JIRA_PAT` is not set.

## Settings (Settings tab > Jira update file)

| Setting                 | Default                   | Notes                                                                                      |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| Jira server             | `https://jira.pncint.net` | `https://` is added when missing.                                                          |
| Story points field id   | blank                     | For example `customfield_10002`. A filled-in id wins over the name.                        |
| Story points field name | `Story Points`            | Used when the id is blank. Editable.                                                       |
| SLA field id            | blank                     |                                                                                            |
| SLA field name          | `SLA`                     | Used when the id is blank.                                                                 |
| Architect field id      | blank                     |                                                                                            |
| Architect field name    | `Architect`               | Used when the id is blank.                                                                 |
| Forecast start field id | blank                     | For example the Advanced Roadmaps `Target start` custom field.                             |
| Forecast start name     | `Target start`            | Used when the id is blank.                                                                 |
| Forecast end field id   | blank                     | A `Target end` custom field, or `duedate` for the Jira due date.                           |
| Forecast end name       | `Target end`              | Used when the id is blank.                                                                 |
| Architect field type    | User picker               | User picker sends `{"name": username}`, select list `{"value": name}`, text the name.      |
| Jira usernames          | -                         | Shown per staff member when the architect field is a user picker and an id or name is set. |
| Target dates            | on                        | Set target start and end to the forecast dates.                                            |
| Include plan order      | on                        | Writes rank moves.                                                                         |

Names are saved with the project. Older saved sessions get these names when they are
missing. An id, when present, is sent as-is. When the id is blank, the script looks
the id up once by name. If that name is not on the server, the script prints a line,
skips that field, and still updates the others. A missing architect username is
reported and does not block the download.

To list the field ids on your server:

```bash
curl -sS -H "Authorization: Bearer $JIRA_PAT" https://jira.pncint.net/rest/api/2/field
```

## Requirements

| ID           | Priority | Description                                          | Acceptance criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------ | -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-JIRA-001 | Must     | Story point and SLA edits are detected.              | The imported Jira values are kept on each item; only values that differ from them are exported.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| REQ-JIRA-002 | Must     | Architect changes are detected.                      | The architect shown on the row whose name differs from the Jira architect is exported, including a grid pick, Auto, a crew pool, and auto-assign. Done items export only a grid pick.                                                                                                                                                                                                                                                                                                                                                                   |
| REQ-JIRA-003 | Should   | Forecast architects are included.                    | Open items export the forecast architect (crew pool or auto-assign) when the name differs from Jira, without a separate switch.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| REQ-JIRA-004 | Must     | Plan order is written as Jira rank moves.            | Replaying the moves in order on the Jira rank order gives the plan order; items that keep their relative order are not moved.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| REQ-JIRA-005 | Must     | The export is a script with one curl line per issue. | Every line sends `Authorization: Bearer $JIRA_PAT` and JSON to the configured Jira server and updates all of that issue's changed fields at once.                                                                                                                                                                                                                                                                                                                                                                                                       |
| REQ-JIRA-006 | Must     | The script checks the token.                         | Running the script without `JIRA_PAT` set stops before any request with a message.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| REQ-JIRA-007 | Must     | Field ids, names, and types are configurable.        | Field ids, field names, architect field type and Jira usernames are set in Settings and saved with the project. An id wins over the name. A blank id is looked up by name when the script runs.                                                                                                                                                                                                                                                                                                                                                         |
| REQ-JIRA-008 | Must     | Changes that cannot be sent are reported.            | Changes with no field id and no name, a missing username, or rank export off are listed in the dialog count, as comments in the script, and in the notification. A name that is not on the server is skipped with a line printed by the script. A missing username does not block the download.                                                                                                                                                                                                                                                         |
| REQ-JIRA-009 | Must     | Values are quoted safely.                            | Names and notes with quotes or `%` reach Jira unchanged in bash and zsh.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| REQ-JIRA-010 | Must     | The update file is created from the header.          | "Jira update file" opens the dialog and "Download update file" saves `jira-updates-YYYY-MM-DD.sh`; with no changes it shows a message instead.                                                                                                                                                                                                                                                                                                                                                                                                          |
| REQ-JIRA-011 | Must     | Target dates follow the forecast.                    | With target dates on, open items whose forecast start or end differs from Jira export the forecast date as `YYYY-MM-DD`.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| REQ-JIRA-012 | Must     | Each changed issue gets a meeting comment.           | The comment is the editable note (default "Based on a meeting on <date> at <time>, the following fields of this Jira issue were changed") followed by one plain line per sent change (Story Points, SLA, Forecast Start, Forecast End, Architect, and Rank) with from and to values. Unchanged fields are omitted and there are no wiki bullets. It is posted only after the issue's field update, if any, and its rank move, if any, succeed, including for rank-only issues. A failed field update still runs later rank moves and skips the comment. |
