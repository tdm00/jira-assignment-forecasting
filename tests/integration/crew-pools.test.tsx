import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import type { AppState } from '../../src/state/store';
import { item, testState } from '../helpers';

const staff = [
  { id: 'alice', name: 'Alice Chen', userId: '' },
  { id: 'bob', name: 'Bob Martinez', userId: '' },
];

function scenario(patch: Partial<AppState> = {}): AppState {
  const mk = (crew: string, n: number) =>
    item({ key: `${crew[0]}-${n}`, crew, slaDays: 5, storyPoints: 5 });
  const base = testState();
  return {
    ...base,
    staff,
    items: [mk('Phoenix', 1), mk('Nova', 1), mk('Phoenix', 2), mk('Nova', 2), mk('Phoenix', 3)],
    crewAssignments: [
      { crew: 'Phoenix', staffId: 'alice', role: 1, enabled: true },
      { crew: 'Nova', staffId: 'alice', role: 1, enabled: true },
    ],
    settings: { ...base.settings, assignmentMode: 'crew-pool', poolPolicy: 'earliest' },
    ...patch,
  };
}

const fend = (key: string) => screen.getByTestId(`fend-${key}`).textContent;
const text = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('crew pools and baseline (REQ-POOL-*)', () => {
  it('adding a backup moves dates and shows deltas against the baseline; removing it restores them', async () => {
    const user = userEvent.setup();
    render(<App initial={scenario()} />);
    const before = ['P-3', 'N-2'].map(fend);
    expect(screen.queryByTestId('delta-P-3')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('set-baseline'));
    expect(screen.getByTestId('finish-delta')).toHaveTextContent('no change vs baseline');

    await user.click(screen.getByRole('tab', { name: 'Crews' }));
    await user.selectOptions(screen.getByLabelText('Backup 2 for Phoenix'), 'Bob Martinez');

    expect(fend('P-3')).not.toBe(before[0]);
    expect(text('delta-P-3')).toMatch(/^-\d+d$/);
    expect(text('finish-delta')).toMatch(/-\d+d/);
    expect(screen.getByTestId('row-P-2').querySelector('[data-label]')).toHaveAttribute(
      'data-label',
      expect.stringMatching(/backup 2/),
    );
    expect(text('changes-Bob Martinez')).toMatch(/\+\d/);

    await user.click(screen.getByLabelText('Backup 2 enabled for Phoenix'));
    expect(['P-3', 'N-2'].map(fend)).toEqual(before);
    expect(text('delta-P-3')).toBe('0d');
    expect(text('finish-delta')).toBe('no change vs baseline');

    await user.click(screen.getByTestId('clear-baseline'));
    expect(screen.queryByTestId('delta-P-3')).not.toBeInTheDocument();
  });

  it('seeds primaries from Jira and switches modes from the Crews tab', async () => {
    const user = userEvent.setup();
    const base = scenario({
      crewAssignments: [],
      items: [
        item({ key: 'X-1', crew: 'Phoenix', architect: 'Bob Martinez', slaDays: 2 }),
        item({ key: 'X-2', crew: 'Phoenix', architect: 'Bob Martinez', slaDays: 2 }),
      ],
    });
    base.settings = { ...base.settings, assignmentMode: 'jira' };
    render(<App initial={base} />);
    await user.click(screen.getByRole('tab', { name: 'Crews' }));
    expect(screen.getByText(/Crew pools are not used yet/)).toBeInTheDocument();
    await user.click(screen.getByTestId('seed-crews'));
    expect(screen.getByLabelText('Primary for Phoenix')).toHaveValue('bob');
    await user.click(screen.getByTestId('use-crew-pools'));
    expect(screen.queryByText(/Crew pools are not used yet/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByTestId('assignment-mode')).toHaveValue('crew-pool');
  });

  it('shows the policy controls only in crew-pool mode', async () => {
    const user = userEvent.setup();
    render(<App initial={scenario()} />);
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByTestId('pool-policy')).toBeInTheDocument();
    await user.selectOptions(screen.getByTestId('pool-policy'), 'primary-preferred');
    expect(screen.getByTestId('backup-threshold')).toBeInTheDocument();
    await user.selectOptions(screen.getByTestId('assignment-mode'), 'jira');
    expect(screen.queryByTestId('pool-policy')).not.toBeInTheDocument();
  });
});

describe('architect focus (REQ-FOCUS-*)', () => {
  async function openFocus() {
    const user = userEvent.setup();
    render(<App initial={scenario()} />);
    await user.click(screen.getByRole('button', { name: 'Architect focus' }));
    return user;
  }
  const rows = () => screen.getAllByTestId(/^row-/).map((r) => r.getAttribute('data-key'));

  it('starts with one crew and adds another to see the combined plan', async () => {
    const user = await openFocus();
    expect(screen.getByLabelText('Focus architect')).toHaveValue('alice');
    expect(screen.getByTestId('chip-nova')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('chip-phoenix')).toHaveAttribute('aria-pressed', 'true');
    const phoenixOnly = rows();
    expect(phoenixOnly.every((k) => k!.startsWith('P-'))).toBe(true);
    expect(fend('P-3')).toBe('Nov 27');

    await user.click(screen.getByTestId('chip-nova'));
    expect(rows()).toHaveLength(5);
    expect(rows()).toEqual(['P-1', 'N-1', 'P-2', 'N-2', 'P-3']);
    expect(fend('P-3')).not.toBe('Nov 27');
    expect(text('selection-change')).toMatch(/Adding Nova/);
    expect(text('selection-change')).toMatch(/Phoenix finish \+\d+d/);
    expect(screen.getByTestId('crew-finish-combined')).toBeInTheDocument();
    expect(screen.getByTestId('finish-delta')).toHaveTextContent(/\+\d+d/);
    expect(screen.getByTestId('ghost-P-3')).toBeInTheDocument();

    await user.click(screen.getByTestId('chip-nova'));
    expect(rows().every((k) => k!.startsWith('P-'))).toBe(true);
    expect(fend('P-3')).toBe('Nov 27');
  });

  it('"All crews" and "All work" show the same dates as the team forecast', async () => {
    const user = await openFocus();
    await user.click(screen.getByRole('button', { name: 'Add all crews' }));
    const scoped = rows().map((k) => [fend(k!)]);
    await user.click(screen.getByRole('button', { name: 'Team' }));
    const rowOrder = rows();
    const teamDates = rowOrder.map((k) => fend(k!));
    expect(rows().map((k) => [fend(k!)])).toEqual(scoped);

    await user.click(screen.getByRole('button', { name: 'Architect focus' }));
    await user.click(screen.getByTestId('chip-nova'));
    const phoenixOnly = rows().map((k) => fend(k!));
    await user.click(screen.getByRole('button', { name: 'All work' }));
    const allWork = rows();
    expect(allWork.every((k) => k!.startsWith('P-'))).toBe(true);
    expect(allWork.map((k) => fend(k!))).toEqual(
      teamDates.filter((_, i) => rowOrder[i]!.startsWith('P-')),
    );
    expect(allWork.map((k) => fend(k!))).not.toEqual(phoenixOnly);
  });

  it('groups by crew and honours another architect with no crews', async () => {
    const user = await openFocus();
    await user.click(screen.getByTestId('chip-nova'));
    await user.click(screen.getByRole('checkbox', { name: 'Group by crew' }));
    expect(rows()).toEqual(['P-1', 'P-2', 'P-3', 'N-1', 'N-2']);
    expect(screen.getByTestId('group-phoenix')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Focus architect'), 'bob');
    expect(screen.getByText('This architect has no crews yet.')).toBeInTheDocument();
  });
});
