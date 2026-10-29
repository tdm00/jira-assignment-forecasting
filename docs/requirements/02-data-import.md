# 02 - Data Import

## Supported files

| Type         | Detected when the header row contains                                                                                                                                                           | Example                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Jira export  | `Issue key` / `Key` **and** `Summary`                                                                                                                                                           | [jira-export.csv](../sample-data/jira-export.csv) |
| Vacations    | a person column (`Staff`, `Architect`, `Person`, `Employee`, `Staff Member`) **and** a date column                                                                                              | [vacations.csv](../sample-data/vacations.csv)     |
| Closures     | a date column (`Date`, `Start Date`, `Start`) and no person column                                                                                                                              | [closures.csv](../sample-data/closures.csv)       |
| Staff list   | a person column or `Name`, with no date column; or a plain list with one name per line. An optional `Jira Username`, `Username`, `Assignee`, or `User Id` column sets each person's Jira login. | [staff.csv](../sample-data/staff.csv)             |
| Crew pools   | a crew column (`Crew`, `Team`, `Squad`), a person column (or `Name`) **and** a `Role` column                                                                                                    | [crew-pools.csv](../sample-data/crew-pools.csv)   |
| Project file | a `.json` file previously exported by the app                                                                                                                                                   | -                                                 |

Header matching ignores case, punctuation and the Jira `Custom field ( ... )` wrapper.

## Jira column mapping

| Field               | Accepted headers                                                                   |
| ------------------- | ---------------------------------------------------------------------------------- |
| Jira key            | `Issue key`, `Key`, `Jira Key`                                                     |
| Summary             | `Summary`, `Task Summary`                                                          |
| Crew                | `Crew`, `Crew Assigned`, `Team`, `Squad`                                           |
| Architect           | `Architect`, `Architect Assigned`, `Solution Architect`, `Assignee`, `Assignee Id` |
| Status              | `Status`                                                                           |
| Story points        | `Story Points`, `Story Point`, `Story Point Estimate`, `Points`, `SP`              |
| SLA (business days) | `SLA`, `SLA Days`, `SLA Days to Complete`, `SLA of Days to Complete`               |
| Start date          | `Start Date`, `Start`, `Target Start`                                              |
| End date            | `End Date`, `End`, `Due Date`, `Due`, `Target End`                                 |
| Rank                | `Rank`                                                                             |

Accepted date formats: `YYYY-MM-DD` (optionally followed by a time), `M/D/YYYY`,
`M/D/YY`, and the Jira format `DD/Mon/YY` (for example `15/Jan/26 9:00 AM`).

## Requirements

| ID          | Priority | Description                                                   | Acceptance criteria                                                                                                                   |
| ----------- | -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-IMP-001 | Must     | Files can be added by dragging them onto the app.             | Dropping one or more files on the drop zone imports each file. The drop zone highlights while a file is dragged over it.              |
| REQ-IMP-002 | Must     | Files can also be added with a file picker.                   | Clicking the drop zone opens a file dialog accepting `.csv`, `.txt` and `.json`.                                                      |
| REQ-IMP-003 | Must     | The file type is detected from its header row.                | Each sample file is recognised as the type listed above.                                                                              |
| REQ-IMP-004 | Must     | Jira columns are mapped using the aliases above.              | A Jira export with `Custom field (Story Points)` maps to story points.                                                                |
| REQ-IMP-005 | Must     | Jira items are sorted by rank on import.                      | Items appear in ascending lexicographic rank order. Items without a rank keep file order after ranked items.                          |
| REQ-IMP-006 | Must     | Invalid rows are skipped and reported.                        | Rows without a Jira key, and rows repeating an earlier key, are skipped. A notification states the number imported and skipped.       |
| REQ-IMP-007 | Must     | Unknown files are rejected with a clear message.              | Dropping an unrecognised file shows an error naming the file. Existing data is unchanged.                                             |
| REQ-IMP-008 | Should   | Re-importing a Jira file replaces the items.                  | Importing a second Jira file replaces all items and resets the plan order to the new file's rank.                                     |
| REQ-IMP-009 | Should   | Staff, vacation and closure imports merge with existing data. | Duplicate staff names (case-insensitive) and duplicate entries are not added twice.                                                   |
| REQ-IMP-010 | Should   | Staff named as architects in Jira can be added in one action. | When Jira architects are not in the staff list, the Staff panel offers "Add N architects from Jira".                                  |
| REQ-IMP-011 | Must     | Quoted CSV fields are parsed correctly.                       | Summaries containing commas, quotes and new lines import intact.                                                                      |
| REQ-IMP-012 | Should   | Crew pool files are imported by staff name.                   | Rows naming a person who is not in the staff list are skipped and reported; valid rows are merged into the crew pools (REQ-POOL-012). |
