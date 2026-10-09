# 03 - Staff Management

The staff list contains the architects who can be assigned to Jira items. It is
the source of truth for capacity: each staff member can work one item at a time.

## Requirements

| ID          | Priority | Description                                         | Acceptance criteria                                                                                                                                                                          |
| ----------- | -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REQ-STF-001 | Must     | The user is asked to provide the staff list.        | When no staff exist, the Staff panel shows a prompt and an input to add names.                                                                                                               |
| REQ-STF-002 | Must     | Staff members can be added manually.                | Typing a name and pressing Add (or Enter) adds the member. A User ID is optional, alphanumeric, and shown next to the name. Blank names are ignored.                                         |
| REQ-STF-003 | Must     | Staff members can be imported from a file.          | A staff CSV has `Name` (first and last name) and optional `User ID` (the header `ID` also works). A plain list of names still imports. Non-alphanumeric User IDs are skipped.                |
| REQ-STF-004 | Must     | Staff names and User IDs are unique.                | Adding a name or a non-empty User ID that already exists (case-insensitive) does nothing, except that a repeat name fills in a missing User ID.                                              |
| REQ-STF-005 | Must     | Staff members can be removed.                       | Removing a member also removes their vacations. Items assigned to them show an "unknown architect" warning.                                                                                  |
| REQ-STF-006 | Must     | Jira assignees are matched to staff.                | Assignee is matched to a staff User ID first (trim, ignore case). Otherwise the architect name is matched, ignoring case and surrounding whitespace.                                         |
| REQ-STF-007 | Should   | Each staff member has a consistent colour.          | The same colour is used for the person in the staff list, legend and Gantt bars.                                                                                                             |
| REQ-STF-008 | Should   | Staff can be added from the Jira architects column. | See REQ-IMP-010.                                                                                                                                                                             |
| REQ-STF-009 | Should   | Staff can be given crew pool roles.                 | See REQ-POOL-001. An architect may be primary for several crews and backup for others.                                                                                                       |
| REQ-STF-010 | Should   | Staff are listed alphabetically by name.            | The Staff panel and every staff dropdown (grid architect, vacations, crew pools, architect focus) sort by name, ignoring case. The stored order, colours and auto-assign ties are unchanged. |
