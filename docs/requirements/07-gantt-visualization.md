# 07 - Gantt Visualization

## Requirements

| ID          | Priority | Description                                              | Acceptance criteria                                                                                                                  |
| ----------- | -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| REQ-GNT-001 | Must     | Each item has a bar from forecast start to forecast end. | Bar left edge is at the start date and right edge at the end of the end date.                                                        |
| REQ-GNT-002 | Must     | Bars align with grid rows.                               | Each bar is on the same row as its item; reordering moves the bar with the row.                                                      |
| REQ-GNT-003 | Must     | The Gantt updates in real time.                          | Reorder, SP/SLA edits, availability and setting changes re-render bars without reload.                                               |
| REQ-GNT-004 | Must     | The timeline shows dates.                                | A header shows months and week starts (or days when zoomed in).                                                                      |
| REQ-GNT-005 | Must     | Non-working days are visible.                            | Weekends and closures are shaded; vacations are hatched on the affected rows.                                                        |
| REQ-GNT-006 | Should   | Bars are coloured by architect.                          | Colours match the staff legend.                                                                                                      |
| REQ-GNT-007 | Should   | Item state is distinguishable.                           | Done items are muted, in-progress items are striped, suggested assignments have a dashed outline, and late items have a red outline. |
| REQ-GNT-008 | Should   | A marker shows the due date.                             | A diamond marks the due date when present. The timeline includes that date so the marker stays in view.                              |
| REQ-GNT-009 | Should   | A line marks the forecast start date.                    | A vertical line labelled with the forecast start date is drawn.                                                                      |
| REQ-GNT-010 | Should   | The timeline can be zoomed.                              | Day, week and month zoom levels change the pixels per day.                                                                           |
| REQ-GNT-011 | Should   | Hovering a bar shows details.                            | Tooltip shows key, summary, architect, dates, and working days.                                                                      |
