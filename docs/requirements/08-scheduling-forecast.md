# 08 - Scheduling and Forecast

## Business rules

1. **Plan order is work order.** Items are worked in plan order (Jira rank,
   then any manual reordering).
2. **One item at a time.** Each architect works on a single item at a time.
   Their next item starts on their first working day after the previous one ends.
3. **Duration is SLA.** An item takes `SLA` working days. If SLA is blank, the
   duration is `ceil(story points x days per point)` (setting, default 1).
   If both are blank the item is not scheduled and is flagged.
4. **Working days.** A working day for an architect is a weekday that is not an
   organization closure and not one of that architect's vacation days.
5. **Forecast start.** No forecast item starts before the forecast start date
   (setting, default today).
6. **In-progress items first.** Items whose status is an in-progress status are
   scheduled before the others for their architect, starting on their Jira
   start date if present (otherwise the forecast start date). Their end date is
   never earlier than the forecast start date.
7. **Done items.** Items whose status is a done status use their Jira dates for
   display and consume no capacity.
8. **Next available architect.** When an item has no architect (or is set to
   Auto) and auto-assign is on, it is given to the staff member who can start
   it the earliest. Ties go to the earlier staff member in the list. The
   assignment is shown as a suggestion.
9. **Unknown architects.** An architect not in the staff list is still
   scheduled (with no vacations) and flagged.
10. **Crew pools (optional).** In `Crew pools` assignment mode the crew's pool
    chooses the architect instead of the Jira field. See
    [14 - Crew pools](14-crew-pools-and-scenarios.md).
11. **Late items.** An item is late when its forecast end is after its Jira end date.

## Example

Staff: Alice. Closure: Wed 2026-11-11. Forecast start: Mon 2026-11-09.

| Plan | Item | SLA | Forecast start | Forecast end                  |
| ---- | ---- | --- | -------------- | ----------------------------- |
| 1    | A-1  | 3   | Mon 11-09      | Thu 11-12 (skips Wed closure) |
| 2    | A-2  | 2   | Fri 11-13      | Mon 11-16 (skips weekend)     |

Dragging A-2 above A-1 gives A-2 Mon 11-09 - Tue 11-10 and A-1 Thu 11-12 - Mon 11-16.

## Requirements

| ID          | Priority | Description                                               | Acceptance criteria                                                                                                              |
| ----------- | -------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| REQ-SCH-001 | Must     | Items are scheduled in plan order per architect.          | An architect's items never overlap and follow plan order.                                                                        |
| REQ-SCH-002 | Must     | Duration uses SLA working days.                           | An item with SLA 5 starting Monday with no closures ends Friday.                                                                 |
| REQ-SCH-003 | Must     | Story points are used when SLA is blank.                  | SLA blank, SP 3, 1 day/point gives 3 working days.                                                                               |
| REQ-SCH-004 | Must     | Weekends, closures and vacations are skipped.             | See the example above.                                                                                                           |
| REQ-SCH-005 | Must     | Reordering changes the forecast.                          | Moving an item earlier never makes its own forecast later.                                                                       |
| REQ-SCH-006 | Must     | Unassigned items go to the next available architect.      | With auto-assign on, the item is given to the staff member with the earliest possible start.                                     |
| REQ-SCH-007 | Must     | Done items consume no capacity.                           | Adding a Done item does not change other items' dates.                                                                           |
| REQ-SCH-008 | Must     | In-progress items are scheduled first.                    | An in-progress item ranked last still starts before the architect's other items.                                                 |
| REQ-SCH-009 | Must     | Items without any estimate are flagged and not scheduled. | They show a "no estimate" warning and no bar.                                                                                    |
| REQ-SCH-010 | Should   | Summary metrics are shown.                                | Overall forecast finish, finish per architect, total story points, and late item count are displayed.                            |
| REQ-SCH-011 | Should   | Scheduling settings are editable.                         | Forecast start date, days per story point, auto-assign, done statuses and in-progress statuses can be changed.                   |
| REQ-SCH-012 | Must     | Scheduling is deterministic.                              | The same inputs always produce the same forecast.                                                                                |
| REQ-SCH-013 | Must     | Pool assignment keeps all other rules.                    | In crew-pool mode, one-at-a-time capacity, vacations, closures, in-progress-first and done-item rules still hold (REQ-POOL-004). |
