# 01 - Overview and Scope

## Purpose

Product and engineering leads need to agree on the order in which architecture
work is done and to see, live, how reprioritizing changes delivery dates. The
tool turns a Jira export into a capacity-aware forecast that can be rearranged
during a meeting.

## Users

- **Engineering / architecture manager** - prepares the data and runs the session.
- **Product team** - reviews priorities and asks "what if we do this first?".

## In scope

- Importing staff, vacations, organization closures and a Jira CSV.
- A grid of Jira items in rank order with search and filters.
- Drag and drop reordering of items.
- Inline editing of story points and SLA.
- A Gantt chart forecasting architect start/finish dates.
- Saving the working session locally and exporting the result.

## Out of scope

- Writing changes back to Jira.
- Multi-user collaboration or server-side storage.
- Modelling partial allocation (an architect splitting time across items).

## Requirements

| ID          | Priority | Description                                         | Acceptance criteria                                                                                            |
| ----------- | -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| REQ-OVR-001 | Must     | The application is delivered as a single HTML file. | `dist/index.html` is the only build output needed; it references no external scripts, styles, fonts or images. |
| REQ-OVR-002 | Must     | The application runs from the local file system.    | Opening `index.html` with a `file://` URL in a modern browser shows the working app.                           |
| REQ-OVR-003 | Must     | The application works without network access.       | No network requests are made at runtime.                                                                       |
| REQ-OVR-004 | Must     | The forecast updates in real time as data changes.  | Reordering, editing SP/SLA, or changing staff availability updates the Gantt without a reload.                 |
| REQ-OVR-005 | Should   | Sample data can be loaded to demonstrate the tool.  | A "Load sample data" action populates staff, vacations, closures and Jira items.                               |
