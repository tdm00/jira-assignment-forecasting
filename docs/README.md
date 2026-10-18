# Jira Gantt Forecaster - Documentation

Jira Gantt Forecaster is a single-file, offline web application used to discuss
work priority with product teams. It loads a Jira CSV export together with the
architect staff list, staff vacations and organization closures, then forecasts
when each Jira item will start and finish. Rows can be reordered and estimates
edited, and the Gantt chart updates instantly.

## Requirements by category

| #   | Document                                                                | Prefix                  |
| --- | ----------------------------------------------------------------------- | ----------------------- |
| 01  | [Overview and scope](requirements/01-overview-and-scope.md)             | `REQ-OVR`               |
| 02  | [Data import](requirements/02-data-import.md)                           | `REQ-IMP`               |
| 03  | [Staff management](requirements/03-staff-management.md)                 | `REQ-STF`               |
| 04  | [Availability and vacations](requirements/04-availability-vacations.md) | `REQ-VAC`               |
| 05  | [Organization closures](requirements/05-organization-closures.md)       | `REQ-CLS`               |
| 06  | [Jira grid](requirements/06-jira-grid.md)                               | `REQ-GRID`              |
| 07  | [Gantt visualization](requirements/07-gantt-visualization.md)           | `REQ-GNT`               |
| 08  | [Scheduling and forecast](requirements/08-scheduling-forecast.md)       | `REQ-SCH`               |
| 09  | [Persistence and export](requirements/09-persistence-and-export.md)     | `REQ-PER`               |
| 10  | [UI/UX and accessibility](requirements/10-ui-ux-and-accessibility.md)   | `REQ-UX`                |
| 11  | [Non-functional](requirements/11-non-functional.md)                     | `REQ-NFR`               |
| 12  | [Testing strategy](requirements/12-testing-strategy.md)                 | `REQ-TST`               |
| 13  | [Build and CI](requirements/13-build-and-ci.md)                         | `REQ-CI`                |
| 14  | [Crew pools and scenarios](requirements/14-crew-pools-and-scenarios.md) | `REQ-POOL`, `REQ-FOCUS` |
| 15  | [Jira update file](requirements/15-jira-update-script.md)               | `REQ-JIRA`              |

Example input files live in [sample-data/](sample-data/).

## Requirement format

Every requirement has:

- **ID** - stable identifier such as `REQ-GRID-003`. Tests reference these IDs
  in their names so coverage can be traced.
- **Priority** - `Must`, `Should` or `Could` (MoSCoW).
- **Description** - what the system shall do.
- **Acceptance criteria** - observable conditions that prove it is met.

## Glossary

| Term                 | Meaning                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Architect            | A staff member who works Jira items. One architect works one item at a time.                     |
| Crew                 | The delivery team assigned to a Jira item. Used for filtering only.                              |
| Rank                 | Jira's lexicographic ordering value (for example `0\|i0001:`). Lower sorts first.                |
| Plan order           | The current working order of items. Starts as Jira rank order and changes when rows are dragged. |
| SLA                  | Number of business days the architect needs to complete an item.                                 |
| Business day         | A weekday (Mon-Fri) that is not an organization closure.                                         |
| Working day          | A business day on which a specific architect is not on vacation.                                 |
| Closure              | A date or date range when the whole organization is closed (for example a bank holiday).         |
| Forecast             | The computed start and end dates for an item.                                                    |
| Crew pool            | The ordered architects (primary, backup 2, backup 3) who may work a crew's items.                |
| Baseline             | A frozen forecast that later changes are compared against.                                       |
| Architect focus      | A view that forecasts one architect's work for chosen crews.                                     |
| Suggested assignment | An architect automatically chosen for an unassigned item.                                        |
