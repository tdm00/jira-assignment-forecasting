import { describe, expect, it } from 'vitest';
import { moveItem } from '../../src/core/rank';
import {
  estimateDays,
  resolveArchitect,
  schedule,
  summarize,
  type ScheduleInput,
} from '../../src/core/scheduler';
import { AUTO_ASSIGN, type JiraItem, type StaffMember } from '../../src/core/types';
import { item, testSettings } from '../helpers';

const alice: StaffMember = { id: 'alice', name: 'Alice Chen' };
const bob: StaffMember = { id: 'bob', name: 'Bob Martinez' };
const veterans = { id: 'c1', name: 'Veterans Day', start: '2026-11-11', end: '2026-11-11' };

function run(items: JiraItem[], patch: Partial<ScheduleInput> = {}) {
  return schedule({
    items,
    staff: [alice, bob],
    vacations: [],
    closures: [veterans],
    settings: testSettings(),
    ...patch,
  });
}

describe('estimateDays (REQ-SCH-002, REQ-SCH-003)', () => {
  it('uses SLA when present', () => {
    expect(estimateDays(item({ slaDays: 4, storyPoints: 10 }), 1)).toBe(4);
  });
  it('falls back to story points times days per point', () => {
    expect(estimateDays(item({ slaDays: null, storyPoints: 3 }), 1)).toBe(3);
    expect(estimateDays(item({ slaDays: null, storyPoints: 3 }), 0.5)).toBe(2);
    expect(estimateDays(item({ slaDays: 0, storyPoints: 2 }), 1)).toBe(2);
  });
  it('returns null without any estimate', () => {
    expect(estimateDays(item({ slaDays: null, storyPoints: null }), 1)).toBeNull();
  });
});

describe('resolveArchitect (REQ-STF-006)', () => {
  it('matches names ignoring case and spacing', () => {
    const r = resolveArchitect(item({ architect: '  alice   chen ' }), [alice], true);
    expect(r).toEqual({ kind: 'staff', staff: alice });
  });
  it('honours overrides', () => {
    expect(
      resolveArchitect(
        item({ architect: 'Alice Chen', architectOverride: 'bob' }),
        [alice, bob],
        true,
      ),
    ).toEqual({ kind: 'staff', staff: bob });
    expect(
      resolveArchitect(
        item({ architect: 'Alice Chen', architectOverride: AUTO_ASSIGN }),
        [alice],
        false,
      ),
    ).toEqual({ kind: 'auto' });
  });
  it('reports unknown and missing architects', () => {
    expect(resolveArchitect(item({ architect: 'Zed' }), [alice], true)).toEqual({
      kind: 'unknown',
      name: 'Zed',
    });
    expect(resolveArchitect(item({ architect: '' }), [alice], false)).toEqual({ kind: 'none' });
  });
});

describe('schedule', () => {
  it('matches the documented example (REQ-SCH-004)', () => {
    const a1 = item({ key: 'A-1', architect: 'Alice Chen', slaDays: 3 });
    const a2 = item({ key: 'A-2', architect: 'Alice Chen', slaDays: 2 });
    let r = run([a1, a2]);
    expect(r.get('A-1')).toMatchObject({ start: '2026-11-09', end: '2026-11-12', workingDays: 3 });
    expect(r.get('A-2')).toMatchObject({ start: '2026-11-13', end: '2026-11-16', workingDays: 2 });

    r = run(moveItem([a1, a2], 'A-2', 'A-1'));
    expect(r.get('A-2')).toMatchObject({ start: '2026-11-09', end: '2026-11-10' });
    expect(r.get('A-1')).toMatchObject({ start: '2026-11-12', end: '2026-11-16' });
  });

  it('never overlaps an architect’s items and follows plan order (REQ-SCH-001)', () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      item({
        key: `X-${i}`,
        architect: i % 2 ? 'Bob Martinez' : 'Alice Chen',
        slaDays: 1 + (i % 3),
      }),
    );
    const r = run(items);
    for (const who of ['Alice Chen', 'Bob Martinez']) {
      const mine = items.filter((i) => i.architect === who).map((i) => r.get(i.key)!);
      for (let k = 1; k < mine.length; k++) {
        expect(mine[k]!.start! > mine[k - 1]!.end!).toBe(true);
      }
    }
  });

  it('works architects in parallel', () => {
    const r = run([
      item({ key: 'A', architect: 'Alice Chen', slaDays: 2 }),
      item({ key: 'B', architect: 'Bob Martinez', slaDays: 2 }),
    ]);
    expect(r.get('A')!.start).toBe('2026-11-09');
    expect(r.get('B')!.start).toBe('2026-11-09');
  });

  it('extends work across vacations (REQ-VAC-006)', () => {
    const r = run([item({ key: 'B', architect: 'Bob Martinez', slaDays: 5 })], {
      vacations: [{ id: 'v', staffId: 'bob', start: '2026-11-12', end: '2026-11-13', note: '' }],
    });
    // Mon 9, Tue 10, (Wed 11 closed), (Thu 12 + Fri 13 vacation), Mon 16, Tue 17, Wed 18
    expect(r.get('B')).toMatchObject({ start: '2026-11-09', end: '2026-11-18' });
  });

  it('starts after a vacation that covers the forecast start', () => {
    const r = run([item({ key: 'B', architect: 'Bob Martinez', slaDays: 1 })], {
      vacations: [{ id: 'v', staffId: 'bob', start: '2026-11-09', end: '2026-11-10', note: '' }],
    });
    expect(r.get('B')!.start).toBe('2026-11-12');
  });

  it('moving an item earlier never makes it later (REQ-SCH-005)', () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      item({ key: `M-${i}`, architect: 'Alice Chen', slaDays: 1 + (i % 4) }),
    );
    const before = run(items).get('M-6')!.end!;
    const after = run(moveItem(items, 'M-6', 'M-2')).get('M-6')!.end!;
    expect(after <= before).toBe(true);
  });

  it('assigns unassigned items to the next available architect (REQ-SCH-006)', () => {
    const r = run([
      item({ key: 'A', architect: 'Alice Chen', slaDays: 5 }),
      item({ key: 'U', architect: '', slaDays: 1 }),
    ]);
    expect(r.get('U')).toMatchObject({
      architect: 'Bob Martinez',
      suggested: true,
      start: '2026-11-09',
    });
  });

  it('breaks auto-assign ties by staff order', () => {
    const r = run([item({ key: 'U', architect: '', slaDays: 1 })]);
    expect(r.get('U')!.architect).toBe('Alice Chen');
  });

  it('flags unassigned items when auto-assign is off', () => {
    const r = run([item({ key: 'U', architect: '' })], {
      settings: testSettings({ autoAssign: false }),
    });
    expect(r.get('U')).toMatchObject({
      state: 'unscheduled',
      flags: ['no-architect'],
      start: null,
    });
  });

  it('flags items when there are no staff to auto-assign', () => {
    const r = run([item({ key: 'U', architect: '' })], { staff: [] });
    expect(r.get('U')!.flags).toContain('no-architect');
  });

  it('done items consume no capacity (REQ-SCH-007)', () => {
    const open = item({ key: 'O', architect: 'Alice Chen', slaDays: 2 });
    const done = item({
      key: 'D',
      architect: 'Alice Chen',
      status: 'Done',
      slaDays: 10,
      startDate: '2026-10-01',
      endDate: '2026-10-05',
    });
    const r = run([done, open]);
    expect(r.get('O')!.start).toBe('2026-11-09');
    expect(r.get('D')).toMatchObject({
      state: 'done',
      start: '2026-10-01',
      end: '2026-10-05',
      workingDays: 3,
    });
  });

  it('done items without dates have no bar', () => {
    const r = run([item({ key: 'D', status: 'closed', architect: 'Zed' })]);
    expect(r.get('D')).toMatchObject({ state: 'done', start: null, architect: 'Zed' });
  });

  it('schedules in-progress items first from their Jira start (REQ-SCH-008)', () => {
    const planned = item({ key: 'P', architect: 'Alice Chen', slaDays: 2 });
    const wip = item({
      key: 'W',
      architect: 'Alice Chen',
      status: 'In Progress',
      slaDays: 5,
      startDate: '2026-11-04',
    });
    const r = run([planned, wip]);
    expect(r.get('W')).toMatchObject({
      state: 'in-progress',
      start: '2026-11-04',
      end: '2026-11-10',
    });
    expect(r.get('P')).toMatchObject({ start: '2026-11-12', end: '2026-11-13' });
  });

  it('keeps overdue in-progress work ending no earlier than the forecast start', () => {
    const wip = item({
      key: 'W',
      architect: 'Alice Chen',
      status: 'In Progress',
      slaDays: 2,
      startDate: '2026-10-01',
    });
    const r = run([wip]);
    expect(r.get('W')!.end).toBe('2026-11-09');
  });

  it('flags items without estimates and does not schedule them (REQ-SCH-009)', () => {
    const r = run([item({ key: 'N', architect: 'Alice Chen', slaDays: null, storyPoints: null })]);
    expect(r.get('N')).toMatchObject({ state: 'unscheduled', flags: ['no-estimate'], start: null });
  });

  it('schedules unknown architects separately and flags them', () => {
    const r = run([
      item({ key: 'Z1', architect: 'Zed', slaDays: 2 }),
      item({ key: 'Z2', architect: 'zed', slaDays: 1 }),
    ]);
    expect(r.get('Z1')).toMatchObject({
      flags: ['unknown-architect'],
      start: '2026-11-09',
      staffId: null,
    });
    expect(r.get('Z2')!.start).toBe('2026-11-12');
  });

  it('flags items forecast after their Jira end date', () => {
    const r = run([item({ key: 'L', architect: 'Alice Chen', slaDays: 5, endDate: '2026-11-10' })]);
    expect(r.get('L')!.flags).toContain('late');
  });

  it('is deterministic (REQ-SCH-012)', () => {
    const items = [
      item({ architect: '', slaDays: 2 }),
      item({ architect: 'Bob Martinez', slaDays: 3 }),
    ];
    expect([...run(items).values()]).toEqual([...run(items).values()]);
  });

  it('schedules 500 items for 20 architects quickly (REQ-NFR-004)', () => {
    const staff = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, name: `Person ${i}` }));
    const items = Array.from({ length: 500 }, (_, i) =>
      item({ architect: i % 7 === 0 ? '' : `Person ${i % 20}`, slaDays: 1 + (i % 10) }),
    );
    const vacations = staff.map((s, i) => ({
      id: `v${i}`,
      staffId: s.id,
      start: '2026-12-01',
      end: '2026-12-10',
      note: '',
    }));
    run(items, { staff, vacations });
    const t0 = performance.now();
    run(items, { staff, vacations });
    expect(performance.now() - t0).toBeLessThan(100);
  });
});

describe('summarize (REQ-SCH-010)', () => {
  it('computes totals, finish dates and counts', () => {
    const items = [
      item({ key: 'A', architect: 'Alice Chen', slaDays: 3, storyPoints: 5 }),
      item({
        key: 'B',
        architect: 'Bob Martinez',
        slaDays: 1,
        storyPoints: 2,
        endDate: '2026-11-01',
      }),
      item({ key: 'D', architect: 'Bob Martinez', status: 'Done', storyPoints: 8 }),
    ];
    const s = summarize(items, run(items), [alice, bob]);
    expect(s).toMatchObject({
      totalItems: 3,
      openItems: 2,
      totalPoints: 15,
      openPoints: 7,
      finish: '2026-11-12',
      lateCount: 1,
      flaggedCount: 1,
    });
    expect(s.byArchitect.find((a) => a.architect === 'Alice Chen')).toMatchObject({
      items: 1,
      finish: '2026-11-12',
    });
  });
});
