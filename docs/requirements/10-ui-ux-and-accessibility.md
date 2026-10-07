# 10 - UI/UX and Accessibility

## Layout

- **Header** - app name, project actions (import, export, clear), theme toggle.
- **Sidebar** - tabbed panels: Data (drop zone and loaded files), Staff,
  Vacations, Closures, Settings.
- **Main area** - summary cards, filter bar, and the combined grid and Gantt.

## Requirements

| ID         | Priority | Description                                     | Acceptance criteria                                                                                            |
| ---------- | -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| REQ-UX-001 | Must     | The interface is visually appealing and modern. | Consistent spacing, rounded cards, a cohesive colour palette and clear typography using a system font stack.   |
| REQ-UX-002 | Must     | An empty state guides the user.                 | With no Jira data, the main area shows a large drop zone, the expected files, and a "Load sample data" button. |
| REQ-UX-003 | Should   | Light and dark themes are available.            | The theme follows the OS preference by default and can be toggled; the choice is remembered.                   |
| REQ-UX-004 | Must     | Actions give feedback.                          | Imports, errors and exports show a short notification (toast).                                                 |
| REQ-UX-005 | Must     | Controls are keyboard accessible.               | All buttons, inputs and the drag handle can be reached and used with the keyboard; focus is visible.           |
| REQ-UX-006 | Should   | Controls have accessible names.                 | Icon-only buttons have `aria-label`s; the grid uses table semantics.                                           |
| REQ-UX-007 | Should   | Colour is not the only signal.                  | Warnings use icons and text in tooltips as well as colour.                                                     |
| REQ-UX-008 | Should   | The layout adapts to the window.                | The sidebar can be collapsed; the grid and Gantt scroll within the main area with a sticky header.             |
| REQ-UX-009 | Could    | Motion is reduced when requested.               | Animations are disabled with `prefers-reduced-motion`.                                                         |
