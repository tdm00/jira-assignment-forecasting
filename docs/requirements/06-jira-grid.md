# 06 - Jira Grid

The grid shows one row per Jira item in plan order, next to its Gantt bar.

## Columns

Drag handle, plan position (#), Jira key, summary, crew, architect, status,
story points (editable), SLA days (editable), Jira start, Jira end, Due,
forecast start, forecast end, warnings, and the Gantt timeline. Jira start,
Jira end and Due are hidden together in compact mode.

## Requirements

| ID           | Priority | Description                                     | Acceptance criteria                                                                                           |
| ------------ | -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| REQ-GRID-001 | Must     | Items are shown in plan order.                  | On import, plan order equals Jira rank order. The # column shows the 1-based position.                        |
| REQ-GRID-002 | Must     | The summary can be searched.                    | Typing in Search shows only rows whose summary (or key) contains the text, case-insensitive.                  |
| REQ-GRID-003 | Must     | Rows can be filtered by one or more architects. | Selecting architects shows only their rows. Selecting none shows all.                                         |
| REQ-GRID-004 | Must     | Rows can be filtered by one or more crews.      | Selecting crews shows only their rows. Selecting none shows all.                                              |
| REQ-GRID-005 | Must     | Filters combine.                                | Search, architect and crew filters are applied together (logical AND).                                        |
| REQ-GRID-006 | Must     | Filters do not change the forecast.             | Hidden rows still consume architect capacity. Forecast dates are identical with and without filters.          |
| REQ-GRID-007 | Must     | Rows can be reordered with drag and drop.       | Dragging a row by its handle and dropping it moves the item in the plan order; positions renumber.            |
| REQ-GRID-008 | Must     | Reordering works while filtered.                | Dropping a row on a visible row places it at that row's position in the full plan.                            |
| REQ-GRID-009 | Must     | Story points can be edited.                     | Editing the SP cell updates the value. Non-numeric or negative input is rejected.                             |
| REQ-GRID-010 | Must     | SLA can be edited.                              | Editing the SLA cell updates the value and the Gantt bar length immediately.                                  |
| REQ-GRID-011 | Should   | Rows can be reordered with the keyboard.        | With the drag handle focused, Alt+Arrow Up/Down moves the row one position.                                   |
| REQ-GRID-012 | Should   | The architect can be changed per item.          | The architect cell is a dropdown of staff plus "Auto (next available)".                                       |
| REQ-GRID-013 | Should   | Warnings are shown per row.                     | Icons with tooltips flag: no estimate, unknown architect, no architect, and forecast later than the due date. |
| REQ-GRID-014 | Should   | Plan order can be reset.                        | "Reset to Jira rank" restores rank order.                                                                     |
| REQ-GRID-015 | Should   | Filters can be cleared in one action.           | "Clear filters" resets search and selections.                                                                 |
