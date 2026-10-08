# 14 - Crew Pools, What-if Scenarios and Architect Focus

Today an architect usually supports one to four crews. When an item has no
architect the forecast simply picks the next free person. This document adds
three related capabilities:

1. **Crew pools** - each crew has an ordered pool of architects (primary, then
   backup 2 and backup 3) so you can make an architect available to take on a
   second or third crew and see how the forecast changes.
2. **Baseline comparison** - freeze a forecast and see how every change moves
   dates, in the grid, on the Gantt chart and in the summary.
3. **Architect focus** - forecast one architect's work for one crew, then add
   the architect's other crews to see everything together.

## Concepts

| Term            | Meaning                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Crew pool       | The architects who may work a crew's items, each with a role: 1 = primary, 2 = backup 2, 3 = backup 3.             |
| Assignment mode | `Jira architect` (default, the original behaviour) or `Crew pools` (the pool decides who works each item).         |
| Pool policy     | How the pool picks an architect: `Primary only`, `Primary, backup if much sooner`, or `Earliest available`.        |
| Backup gap      | Business days a backup must start before the primary to be chosen by `Primary, backup if much sooner` (default 5). |
| Available from  | A date before which a pool member cannot start that crew's work (for example when they roll off another project).  |
| Baseline        | A frozen copy of the forecast used as the comparison reference.                                                    |
| Scope           | In architect focus, whether the plan shows only the selected crews (`Selected crews only`) or the full workload.   |

## Assignment rules (crew-pool mode)

1. An explicit per-item override (an architect picked in the grid, or Auto) always wins.
2. An in-progress item that already has a Jira architect stays with that architect.
3. Otherwise the item's crew pool is used. Only enabled slots take part. If the
   primary is disabled, the next enabled role acts as the primary.
4. The policy then chooses from the pool, evaluating candidates in plan order and
   using each member's earliest possible start (their current workload, vacations,
   closures and `available from` date):
   - **Primary only** - always the primary.
   - **Primary, backup if much sooner** - the earliest backup when it can start at
     least the backup gap sooner than the primary, otherwise the primary.
   - **Earliest available** - whoever can start first; ties go to the lower role.
5. A crew with no pool falls back to the next available architect and the item
   is flagged `no crew pool`.
6. Done items keep their Jira architect and consume no capacity.

An architect may be primary for several crews and backup for others. All of that
work shares one calendar, so one architect still works one item at a time.

## Requirements - crew pools

| ID           | Priority | Description                                                     | Acceptance criteria                                                                                                  |
| ------------ | -------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| REQ-POOL-001 | Must     | Each crew has a pool with primary, backup 2 and backup 3 slots. | The Crews tab lists every crew with three role selectors. A person holds at most one role per crew.                  |
| REQ-POOL-002 | Must     | A slot can be switched on or off without losing it.             | Unticking a slot returns the forecast to what it was without that person; ticking it restores the change.            |
| REQ-POOL-003 | Must     | The assignment mode is selectable.                              | `Jira architect` keeps current behaviour exactly; `Crew pools` uses the pools. Settings and the Crews tab expose it. |
| REQ-POOL-004 | Must     | Pools never break capacity.                                     | An architect's items, across all crews, never overlap.                                                               |
| REQ-POOL-005 | Must     | Pool policy is selectable.                                      | The three policies in the rules above are available and produce the described results.                               |
| REQ-POOL-006 | Should   | The backup gap is configurable.                                 | With the backup policy, a backup is used only when it saves at least the configured business days.                   |
| REQ-POOL-007 | Should   | A slot can have an available-from date.                         | The member starts that crew's work on or after the date, in both the team and architect-focus forecasts.             |
| REQ-POOL-008 | Must     | A baseline can be set and cleared.                              | "Set baseline" freezes the current forecast; "Clear baseline" removes it. A new Jira import clears it.               |
| REQ-POOL-009 | Must     | Changes against the baseline are visible per item and overall.  | The grid shows a delta in calendar days for each item, the summary shows the finish delta and items gained/lost.     |
| REQ-POOL-010 | Should   | The baseline is shown on the Gantt chart.                       | A dotted ghost bar shows each item's baseline dates when they differ.                                                |
| REQ-POOL-011 | Should   | Pools can be seeded from Jira.                                  | "Seed primaries from Jira" makes each crew's most frequent Jira architect its primary and keeps existing primaries.  |
| REQ-POOL-012 | Should   | Pools can be imported from a CSV file.                          | A file with `Crew`, `Architect`, `Role` and optional `Available From` columns is detected and merged.                |
| REQ-POOL-013 | Must     | Pools and baseline are saved with the project.                  | They survive reload and project export/import; older saves load with empty pools and no baseline.                    |
| REQ-POOL-014 | Should   | How an item was assigned is visible.                            | The grid labels items `backup N`, `crew pool` or `suggested`; the CSV export has an `Assigned Via` column.           |
| REQ-POOL-015 | Must     | Removing staff removes their pool slots.                        | Removing a staff member deletes their assignments in every crew.                                                     |

### Crew pool CSV

| Crew    | Architect  | Role | Available From |
| ------- | ---------- | ---- | -------------- |
| Phoenix | Alice Chen | 1    |                |
| Phoenix | Bob M.     | 2    | 2026-11-02     |

`Role` accepts `1`, `2`, `3`, `primary`, `backup`, `backup 2`. Example:
[crew-pools.csv](../sample-data/crew-pools.csv).

## Requirements - architect focus

Architect focus is a second view next to the team view. Pick an architect and
the plan shows only that architect's work. One crew is selected to start with;
adding crews interleaves their items by rank on the architect's single calendar.

How it is calculated: the team-wide plan is computed first so assignments (who is
primary or backup for each item) stay the same as in the team view. The selected
architect's items in the chosen crews are then scheduled alone, as if the architect
only worked those crews. Selecting more crews adds their items; the finish dates
can only get later or stay the same.

| ID            | Priority | Description                                                         | Acceptance criteria                                                                                                                |
| ------------- | -------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| REQ-FOCUS-001 | Must     | Users can switch between the team view and architect focus.         | A `Team` / `Architect focus` switch is above the grid. Filters, search and drag-reorder work in both.                              |
| REQ-FOCUS-002 | Must     | One architect can be forecast for one crew.                         | Choosing an architect selects their first crew; only that crew's items for that architect appear, scheduled on their own calendar. |
| REQ-FOCUS-003 | Must     | The architect's other crews can be added and removed with chips.    | Each chip shows the crew, the architect's role and open items and points. Toggling a chip updates grid and Gantt immediately.      |
| REQ-FOCUS-004 | Must     | Adding a crew shows the effect.                                     | A message names the added crew and the change in each crew's finish and the combined finish; ghost bars show the previous dates.   |
| REQ-FOCUS-005 | Should   | "Add all crews" selects every crew of the architect.                | One click selects all chips.                                                                                                       |
| REQ-FOCUS-006 | Should   | Scope can be `Selected crews only` or `All work`.                   | `All work` shows the selected crews' items with dates from the architect's full workload (matching the team forecast).             |
| REQ-FOCUS-007 | Should   | Per-crew and combined finish dates are shown.                       | The focus bar lists items, points and finish date per selected crew plus a combined finish.                                        |
| REQ-FOCUS-008 | Could    | Rows can be grouped by crew.                                        | `Group by crew` inserts a header row per crew; plan order is kept inside each group.                                               |
| REQ-FOCUS-009 | Should   | Export follows the view.                                            | CSV export in architect focus contains only the shown items and names the architect in the file name.                              |
| REQ-FOCUS-010 | Should   | Crews come from pools and from the work the architect already does. | The chips include crews in the architect's pools plus crews whose items the team plan gives them, with a no-crew bucket if needed. |

## Suggested workflow

1. Load staff, Jira, vacations and closures; on the Crews tab choose **Seed primaries from Jira** and **Use crew pools**.
2. Click **Set baseline** in the summary.
3. Give a crew a Backup 2 (optionally with an available-from date) and watch deltas and the finish change.
4. Open **Architect focus**, pick the architect, and toggle the crew chips to see one crew alone, then the whole load.
