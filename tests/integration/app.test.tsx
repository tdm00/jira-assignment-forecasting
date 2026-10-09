import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { STORAGE_KEY } from '../../src/state/persistence';
import { fixture, item, testState } from '../helpers';

const csv = (name: string) => new File([fixture(name)], name, { type: 'text/csv' });
const ALL = ['staff.csv', 'closures.csv', 'vacations.csv', 'jira.csv'];

const fend = (key: string) => screen.getByTestId(`fend-${key}`).textContent;
const fstart = (key: string) => screen.getByTestId(`fstart-${key}`).textContent;
const rowKeys = () => screen.getAllByTestId(/^row-/).map((r) => r.getAttribute('data-key'));

async function setup(files = ALL) {
  const user = userEvent.setup();
  render(<App initial={testState()} />);
  await user.upload(screen.getByTestId('file-input'), files.map(csv));
  await screen.findByTestId('row-A-1');
  return user;
}

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('empty state (REQ-UX-002, REQ-OVR-005)', () => {
  it('guides the user and loads sample data', async () => {
    const user = userEvent.setup();
    render(<App initial={testState()} />);
    expect(screen.getByText('Forecast your Jira work')).toBeInTheDocument();
    expect(screen.getByTestId('dropzone-hero')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Load sample data' })[0]!);
    expect(await screen.findAllByTestId(/^row-/)).toHaveLength(20);
    expect(screen.getByText(/imported 20 Jira items/)).toBeInTheDocument();
  });

  it('asks for the staff list first (REQ-STF-001)', () => {
    render(<App initial={testState()} />);
    expect(screen.getByRole('tab', { name: 'Staff' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Add the architects who can be assigned/)).toBeInTheDocument();
  });
});

describe('importing files', () => {
  it('imports all file types and forecasts in rank order (REQ-IMP-001, REQ-GRID-001, REQ-SCH-004)', async () => {
    await setup();
    expect(rowKeys()).toEqual(['A-1', 'A-2', 'B-1', 'U-1']);
    expect([fstart('A-1'), fend('A-1')]).toEqual(['Nov 9', 'Nov 12']);
    expect([fstart('A-2'), fend('A-2')]).toEqual(['Nov 13', 'Nov 16']);
    expect([fstart('B-1'), fend('B-1')]).toEqual(['Nov 9', 'Nov 18']);
    expect([fstart('U-1'), fend('U-1')]).toEqual(['Nov 17', 'Nov 17']);
    expect(screen.getByText(/loaded 2 staff members/)).toBeInTheDocument();
    expect(screen.getByText(/loaded 1 vacation$/)).toBeInTheDocument();
  });

  it('shows suggestions and late warnings (REQ-SCH-006, REQ-GRID-013)', async () => {
    await setup();
    const u1 = screen.getByTestId('row-U-1');
    expect(within(u1).getByTitle(/Suggested/)).toHaveTextContent('Alice Chen');
    const a2 = screen.getByTestId('row-A-2');
    expect(within(a2).getByRole('img', { name: /after the due date/ })).toBeInTheDocument();
    expect(
      within(a2).getByRole('img', { name: 'Forecast finishes after the due date Nov 13' }),
    ).toHaveAttribute('title', 'Forecast finishes after the due date Nov 13');
    expect(screen.getByTestId('gantt-due-A-2')).toBeInTheDocument();
    expect(screen.getByTestId('stat-late')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-finish')).toHaveTextContent('Nov 18, 2026');
  });

  it('accepts files dropped on the drop zone (REQ-IMP-001)', async () => {
    render(<App initial={testState()} />);
    fireEvent.drop(screen.getByTestId('dropzone-hero'), {
      dataTransfer: { files: [csv('staff.csv'), csv('jira.csv')] },
    });
    expect(await screen.findByTestId('row-B-1')).toBeInTheDocument();
  });

  it('rejects unrecognised files with a message (REQ-IMP-007)', async () => {
    const user = userEvent.setup();
    render(<App initial={testState()} />);
    await user.upload(
      screen.getByTestId('file-input'),
      new File(['foo,bar\n1,2'], 'mystery.csv', { type: 'text/csv' }),
    );
    expect(await screen.findByText(/mystery.csv: unrecognised file/)).toBeInTheDocument();
  });
});

describe('grid editing (REQ-GRID-009, REQ-GRID-010, REQ-GNT-003)', () => {
  it('updates the forecast in real time when SLA changes', async () => {
    const user = await setup();
    const sla = screen.getByLabelText('SLA days for A-1');
    await user.clear(sla);
    await user.type(sla, '1');
    expect(fend('A-1')).toBe('Nov 9');
    expect([fstart('A-2'), fend('A-2')]).toEqual(['Nov 10', 'Nov 12']);
    expect(screen.getByTestId('bar-A-2')).toHaveAttribute('data-end', '2026-11-12');
  });

  it('falls back to story points when SLA is cleared and flags missing estimates', async () => {
    const user = await setup();
    await user.clear(screen.getByLabelText('SLA days for A-1'));
    expect(fend('A-1')).toBe('Nov 16');
    await user.clear(screen.getByLabelText('Story points for A-1'));
    expect(fend('A-1')).toBe('');
    expect(
      within(screen.getByTestId('row-A-1')).getByRole('img', { name: /No SLA or story point/ }),
    ).toBeInTheDocument();
  });

  it('changes the architect for an item (REQ-GRID-012)', async () => {
    const user = await setup();
    await user.selectOptions(screen.getByLabelText('Architect for U-1'), 'Bob Martinez');
    expect(fstart('U-1')).toBe('Nov 19');
  });
});

describe('search and filters', () => {
  it('searches the summary (REQ-GRID-002)', async () => {
    const user = await setup();
    await user.type(screen.getByLabelText('Search summary'), 'bravo');
    expect(rowKeys()).toEqual(['B-1']);
    expect(screen.getByText('1 of 4 items')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(rowKeys()).toHaveLength(4);
  });

  it('filters by architects without changing the forecast (REQ-GRID-003, REQ-GRID-006)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Architects/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Bob Martinez' }));
    expect(rowKeys()).toEqual(['B-1']);
    expect(fend('B-1')).toBe('Nov 18');
    await user.click(screen.getByRole('checkbox', { name: 'Alice Chen' }));
    expect(rowKeys()).toEqual(['A-1', 'A-2', 'B-1', 'U-1']);
  });

  it('updates the stats to the visible rows without changing the forecast (REQ-GRID-017)', async () => {
    const user = await setup();
    expect(screen.queryByTestId('stats-filtered')).not.toBeInTheDocument();
    expect(screen.getByTestId('stat-open')).toHaveTextContent('4 of 4');
    expect(screen.getByTestId('stat-late')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-finish')).toHaveTextContent('Nov 18, 2026');

    await user.type(screen.getByLabelText('Search summary'), 'bravo');
    expect(rowKeys()).toEqual(['B-1']);
    expect(screen.getByTestId('stats-filtered')).toHaveTextContent(
      'Filtered: showing stats for 1 of 4 items',
    );
    expect(screen.getByTestId('stat-open')).toHaveTextContent('1 of 1');
    expect(screen.getByTestId('stat-late')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-finish')).toHaveTextContent('Nov 18, 2026');
    expect(fend('B-1')).toBe('Nov 18');
    // Only architects with matching rows are listed while filtering.
    const legend = screen.getByRole('list', { name: 'Architect finish dates' });
    expect(within(legend).getByText('Bob Martinez')).toBeInTheDocument();
    expect(within(legend).queryByText('Alice Chen')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search summary'));
    await user.type(screen.getByLabelText('Search summary'), 'alpha');
    expect(screen.getByTestId('stat-open')).toHaveTextContent('2 of 2');
    expect(screen.getByTestId('stat-late')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-finish')).toHaveTextContent('Nov 16, 2026');

    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(screen.queryByTestId('stats-filtered')).not.toBeInTheDocument();
    expect(screen.getByTestId('stat-open')).toHaveTextContent('4 of 4');
    expect(screen.getByTestId('stat-finish')).toHaveTextContent('Nov 18, 2026');
  });

  it('filters by crews (REQ-GRID-004, REQ-GRID-005)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Crews/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Atlas' }));
    expect(rowKeys()).toEqual(['B-1', 'U-1']);
    await user.type(screen.getByLabelText('Search summary'), 'spike');
    expect(rowKeys()).toEqual(['U-1']);
  });

  it('filters by status as soon as it is picked, without changing the forecast (REQ-GRID-016, REQ-GRID-006)', async () => {
    const user = userEvent.setup();
    render(<App initial={testState()} />);
    const jira = [
      'Summary,Issue key,Status,Custom field (Architect),Custom field (Story Points),Custom field (SLA Days),Custom field (Rank)',
      'Alpha,S-1,To Do,Alice Chen,5,3,0|i0001:',
      'Beta,S-2,In Progress,Alice Chen,3,2,0|i0002:',
      'Gamma,S-3,Cancelled,Alice Chen,3,2,0|i0003:',
      'Delta,S-4,in progress,Bob Martinez,1,1,0|i0004:',
    ].join('\n');
    await user.upload(screen.getByTestId('file-input'), [
      csv('staff.csv'),
      new File([jira], 'status.csv', { type: 'text/csv' }),
    ]);
    await screen.findByTestId('row-S-1');
    const before = [fstart('S-2'), fend('S-2'), fstart('S-4'), fend('S-4')];

    await user.click(screen.getByRole('button', { name: /Status/ }));
    await user.click(screen.getByRole('checkbox', { name: 'In Progress' }));
    expect(rowKeys()).toEqual(['S-2', 'S-4']);
    expect([fstart('S-2'), fend('S-2'), fstart('S-4'), fend('S-4')]).toEqual(before);

    await user.click(screen.getByRole('checkbox', { name: 'To Do' }));
    expect(rowKeys()).toEqual(['S-1', 'S-2', 'S-4']);

    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(rowKeys()).toEqual(['S-1', 'S-2', 'S-3', 'S-4']);
    expect([fstart('S-2'), fend('S-2')]).toEqual(before.slice(0, 2));
  });
});

describe('reordering', () => {
  it('moves rows with Alt+Arrow keys and re-forecasts (REQ-GRID-011, REQ-SCH-005)', async () => {
    const user = await setup();
    screen.getByTestId('handle-A-2').focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(rowKeys()).toEqual(['A-2', 'A-1', 'B-1', 'U-1']);
    expect(within(screen.getByTestId('row-A-2')).getByTestId('position')).toHaveTextContent('1');
    expect([fstart('A-2'), fend('A-2')]).toEqual(['Nov 9', 'Nov 10']);
    expect([fstart('A-1'), fend('A-1')]).toEqual(['Nov 12', 'Nov 16']);
  });

  it('moves within the filtered rows (REQ-GRID-008)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Crews/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Atlas' }));
    screen.getByTestId('handle-U-1').focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(rowKeys()).toEqual(['U-1', 'B-1']);
    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(rowKeys()).toEqual(['A-1', 'A-2', 'U-1', 'B-1']);
  });

  it('resets to Jira rank (REQ-GRID-014)', async () => {
    const user = await setup();
    screen.getByTestId('handle-B-1').focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(rowKeys()[1]).toBe('B-1');
    await user.click(screen.getByRole('button', { name: /Reset to Jira rank/ }));
    expect(rowKeys()).toEqual(['A-1', 'A-2', 'B-1', 'U-1']);
  });
});

describe('staff, vacations and closures', () => {
  it('adds and removes staff (REQ-STF-002, REQ-STF-005)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('tab', { name: 'Staff' }));
    await user.type(screen.getByLabelText('Staff name'), 'Carla Singh{Enter}');
    const list = screen.getByRole('list', { name: 'Staff members' });
    expect(within(list).getByText('Carla Singh')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Bob Martinez' }));
    expect(within(list).queryByText('Bob Martinez')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('row-B-1')).getByRole('img', { name: /not in the staff list/ }),
    ).toBeInTheDocument();
  });

  it('offers to add architects found in Jira (REQ-IMP-010)', async () => {
    const user = await setup(['jira.csv']);
    await user.click(screen.getByRole('tab', { name: 'Staff' }));
    await user.click(screen.getByRole('button', { name: /Add 2 architects from Jira/ }));
    expect(screen.getByRole('list', { name: 'Staff members' }).children).toHaveLength(2);
  });

  it('adds a vacation that pushes the forecast (REQ-VAC-001, REQ-VAC-006)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('tab', { name: 'Vacations' }));
    fireEvent.change(screen.getByLabelText('Vacation start'), { target: { value: '2026-11-09' } });
    fireEvent.change(screen.getByLabelText('Vacation end'), { target: { value: '2026-11-10' } });
    await user.click(screen.getByRole('button', { name: 'Add vacation' }));
    expect(fend('A-1')).toBe('Nov 16');
    await user.click(screen.getByRole('button', { name: /Remove vacation for Alice Chen/ }));
    expect(fend('A-1')).toBe('Nov 12');
  });

  it('validates vacation ranges (REQ-VAC-003)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('tab', { name: 'Vacations' }));
    await user.click(screen.getByRole('button', { name: 'Add vacation' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/start date/);
    fireEvent.change(screen.getByLabelText('Vacation start'), { target: { value: '2026-11-10' } });
    fireEvent.change(screen.getByLabelText('Vacation end'), { target: { value: '2026-11-09' } });
    await user.click(screen.getByRole('button', { name: 'Add vacation' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/on or after/);
  });

  it('adds and removes closures (REQ-CLS-001, REQ-CLS-003)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('tab', { name: 'Closures' }));
    await user.type(screen.getByLabelText('Closure name'), 'Shutdown');
    fireEvent.change(screen.getByLabelText('Closure date'), { target: { value: '2026-11-10' } });
    await user.click(screen.getByRole('button', { name: 'Add closure' }));
    expect(fend('A-1')).toBe('Nov 13');
    await user.click(screen.getByRole('button', { name: 'Remove closure Shutdown' }));
    expect(fend('A-1')).toBe('Nov 12');
  });

  it('changes forecast settings (REQ-SCH-011)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    fireEvent.change(screen.getByTestId('forecast-start'), { target: { value: '2026-11-16' } });
    expect(fstart('A-1')).toBe('Nov 16');
    await user.click(screen.getByRole('checkbox', { name: /next available architect/ }));
    expect(fend('U-1')).toBe('');
  });
});

describe('persistence and export', () => {
  it('restores the session after a reload (REQ-PER-001, REQ-PER-002)', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.upload(screen.getByTestId('file-input'), ALL.map(csv));
    await screen.findByTestId('row-A-1');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('A-1');
    first.unmount();
    render(<App />);
    expect(screen.getAllByTestId(/^row-/)).toHaveLength(4);
  });

  it('exports project JSON and CSV (REQ-PER-003, REQ-PER-005)', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return 'blob:test';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Export project/ }));
    await user.click(screen.getByRole('button', { name: /Export CSV/ }));
    expect(click).toHaveBeenCalledTimes(2);
    const project = JSON.parse(await created[0]!.text());
    expect(project.app).toBe('jira-gantt-forecaster');
    expect(project.data.items).toHaveLength(4);
    expect(await created[1]!.text()).toContain('Forecast End');
  });

  it('opens an exported project file (REQ-PER-004)', async () => {
    const user = userEvent.setup();
    const state = testState({ staff: [{ id: 's1', name: 'Zara', userId: '' }] });
    const json = JSON.stringify({ app: 'jira-gantt-forecaster', version: 1, data: state });
    render(<App initial={testState()} />);
    await user.upload(
      screen.getByTestId('project-input'),
      new File([json], 'p.json', { type: 'application/json' }),
    );
    await user.click(screen.getByRole('tab', { name: 'Staff' }));
    expect(await screen.findByText('Zara')).toBeInTheDocument();
  });

  it('clears all data after confirmation (REQ-PER-006)', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: /Clear all/ }));
    expect(screen.getByText('Forecast your Jira work')).toBeInTheDocument();
  });
});

describe('theme and layout (REQ-UX-003, REQ-UX-008)', () => {
  it('toggles the theme and sidebar', async () => {
    const user = userEvent.setup();
    render(<App initial={testState()} />);
    const before = document.documentElement.dataset.theme;
    await user.click(screen.getByRole('button', { name: /Switch to (dark|light) theme/ }));
    expect(document.documentElement.dataset.theme).not.toBe(before);
    await user.click(screen.getByRole('button', { name: 'Hide sidebar' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('dismisses notifications (REQ-UX-004)', async () => {
    const user = await setup(['staff.csv', 'jira.csv']);
    const toasts = screen.getAllByTestId('toast');
    expect(toasts).toHaveLength(2);
    await user.click(within(toasts[0]!).getByRole('button', { name: 'Dismiss' }));
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
  });
});

describe('staff sorted by name (REQ-STF-010)', () => {
  it('lists staff alphabetically in the grid dropdown and the Staff panel', async () => {
    const user = userEvent.setup();
    const staff = [
      { id: 's1', name: 'Zed Young', userId: '' },
      { id: 's2', name: 'Alice Chen', userId: '' },
      { id: 's3', name: 'Mike Ross', userId: '' },
    ];
    render(
      <App
        initial={testState({
          staff,
          items: [item({ key: 'X-1', summary: 'Sorted', architect: 'Mike Ross', slaDays: 1 })],
        })}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'Staff' }));

    const options = within(screen.getByLabelText('Architect for X-1'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options.slice(2)).toEqual(['Alice Chen', 'Mike Ross', 'Zed Young']);

    const names = ['Alice Chen', 'Mike Ross', 'Zed Young'];
    const listed = within(screen.getByRole('list', { name: 'Staff members' }))
      .getAllByRole('listitem')
      .map((li) => names.find((n) => li.textContent?.includes(n)));
    expect(listed).toEqual(names);
  });
});

describe('help (REQ-UX-010)', () => {
  it('opens from the header and explains baseline, exports, crew pools and seeding', async () => {
    const user = userEvent.setup();
    render(<App initial={testState()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Help/ }));
    const dialog = screen.getByRole('dialog', { name: 'Help' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    for (const title of [
      'Set baseline',
      'Export project, Open project and Export CSV',
      'Crew pools',
      'Seed primaries from Jira',
    ]) {
      expect(within(dialog).getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(within(dialog).getByText(/never changes a primary you already chose/)).toBeVisible();

    // Topic links scroll to a section and keep the dialog open.
    await user.click(within(dialog).getByRole('button', { name: 'Seed primaries from Jira' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes with Escape, the close button or a click outside, and returns focus', async () => {
    const user = userEvent.setup();
    render(<App initial={testState()} />);
    const open = screen.getByRole('button', { name: /Help/ });

    await user.click(open);
    expect(screen.getByRole('button', { name: 'Close help' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(open).toHaveFocus();

    await user.click(open);
    await user.click(screen.getByRole('button', { name: 'Close help' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(open);
    await user.click(screen.getByTestId('help-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps Tab focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(<App initial={testState()} />);
    await user.click(screen.getByRole('button', { name: /Help/ }));
    const dialog = screen.getByRole('dialog');
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 14; i++) await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });
});

describe('zoom', () => {
  it('changes the timeline scale (REQ-GNT-010)', async () => {
    const user = await setup();
    const bar = () => screen.getByTestId('bar-A-1').style.width;
    const week = bar();
    await user.click(screen.getByRole('button', { name: 'Day' }));
    expect(parseFloat(bar())).toBeGreaterThan(parseFloat(week));
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(parseFloat(bar())).toBeLessThan(parseFloat(week));
  });
});
