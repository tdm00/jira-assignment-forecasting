# 04 - Availability and Vacations

Vacations are periods when a single staff member is unavailable. They reduce
that person's working days and push their forecast out.

## Requirements

| ID          | Priority | Description                                | Acceptance criteria                                                                                                     |
| ----------- | -------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| REQ-VAC-001 | Must     | Vacations can be added for a staff member. | The Vacations panel lets the user choose a staff member, start date, optional end date and note.                        |
| REQ-VAC-002 | Must     | A vacation covers whole days, inclusive.   | A vacation from Mon to Wed removes three working days. A missing end date means a single day.                           |
| REQ-VAC-003 | Must     | Invalid ranges are rejected.               | An end date before the start date is not saved and an error is shown.                                                   |
| REQ-VAC-004 | Must     | Vacations can be imported from CSV.        | Columns: staff name, start date, end date (optional), note (optional). Rows for unknown staff are skipped and reported. |
| REQ-VAC-005 | Must     | Vacations can be removed.                  | Removing a vacation immediately updates the forecast.                                                                   |
| REQ-VAC-006 | Must     | The forecast skips vacation days.          | An item spanning a vacation is extended by the number of vacation working days.                                         |
| REQ-VAC-007 | Should   | Vacations are visible on the Gantt.        | Vacation days are drawn as hatched blocks on each row assigned to that person.                                          |
| REQ-VAC-008 | Should   | Vacations are listed in date order.        | The panel lists vacations sorted by start date, grouped visually by staff colour.                                       |
