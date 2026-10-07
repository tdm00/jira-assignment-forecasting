# 05 - Organization Closures

Closures are days when the whole organization is closed, such as bank holidays
or company shutdowns. Nobody works on a closure day.

## Requirements

| ID          | Priority | Description                                          | Acceptance criteria                                                                      |
| ----------- | -------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| REQ-CLS-001 | Must     | Closures can be added manually.                      | The Closures panel accepts a name, a start date and an optional end date.                |
| REQ-CLS-002 | Must     | Closures can be imported from CSV.                   | Columns: date (or start date), end date (optional), name (optional).                     |
| REQ-CLS-003 | Must     | Closures can be removed.                             | Removing a closure immediately updates the forecast.                                     |
| REQ-CLS-004 | Must     | The forecast skips closure days for every architect. | An item that would include a closure day ends one business day later.                    |
| REQ-CLS-005 | Must     | Weekends are never working days.                     | Saturdays and Sundays are skipped without needing to be entered as closures.             |
| REQ-CLS-006 | Should   | Closures are visible on the Gantt.                   | Closure days are shaded across all rows and named in the tooltip of the timeline header. |
| REQ-CLS-007 | Should   | Invalid ranges are rejected.                         | An end date before the start date is not saved and an error is shown.                    |
