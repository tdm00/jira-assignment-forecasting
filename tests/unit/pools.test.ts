import { describe, expect, it } from 'vitest';
import {
  architectChanges,
  endDelta,
  finishDelta,
  forecastFinish,
  formatDelta,
  makeBaseline,
  makeReference,
} from '../../src/core/compare';
import {
  compareSelections,
  crewStats,
  crewsForArchitect,
  groupByCrew,
  itemsForArchitectCrews,
  itemsInSchedule,
} from '../../src/core/focus';
import { crewKey, poolFor, schedule, type ScheduleInput } from '../../src/core/scheduler';
import {
  AUTO_ASSIGN,
  type CrewAssignment,
  type JiraItem,
  type PoolPolicy,
  type StaffMember,
} from '../../src/core/types';
import { detectFileType } from '../../src/parsers/detectFileType';
import { parseCrewCsv, parseRole } from '../../src/parsers/crewCsv';
import { item, sample, testSettings } from '../helpers';

const alice: StaffMember = { id: 'alice', name: 'Alice Chen' };
const bob: StaffMember = { id: 'bob', name: 'Bob Martinez' };
const carla: StaffMember = { id: 'carla', name: 'Carla Singh' };
const closure = { id: 'c1', name: 'Veterans Day', start: '2026-11-11', end: '2026-11-11' };

const slot = (
  crew: string,
  staffId: string,
  role: 1 | 2 | 3,
  extra: Partial<CrewAssignment> = {},
): CrewAssignment => ({ crew, staffId, role, enabled: true, ...extra });

const work = (crew: string, n: number, patch: Partial<JiraItem> = {}): JiraItem[] =>
  Array.from({ length: n }, (_, i) =>
    item({ key: `${crew}-${i + 1}`, crew, slaDays: 5, storyPoints: 5, ...patch }),
  );

function run(
  items: JiraItem[],
  crewAssignments: CrewAssignment[],
  policy: PoolPolicy = 'primary-preferred',
  extra: Partial<ScheduleInput> = {},
  threshold = 5,
) {
  return schedule({
    items,
    staff: [alice, bob, carla],
    vacations: [],
    closures: [closure],
    crewAssignments,
    settings: testSettings({
      assignmentMode: 'crew-pool',
      poolPolicy: policy,
      backupThresholdDays: threshold,
    }),
    ...extra,
  });
}

const who = (m: ReturnType<typeof run>) => [...m.values()].map((s) => s.architect);

describe('poolFor (REQ-POOL-001)', () => {
  it('returns enabled assignments for the crew ordered by role', () => {
    const pool = poolFor(
      ' phoenix ',
      [
        slot('Phoenix', 'bob', 2),
        slot('Phoenix', 'alice', 1),
        slot('Phoenix', 'carla', 3, { enabled: false }),
        slot('Nova', 'carla', 1),
        slot('Phoenix', 'ghost', 3),
      ],
      [alice, bob, carla],
    );
    expect(pool.map((p) => p.staff.id)).toEqual(['alice', 'bob']);
    expect(poolFor('', [slot('Phoenix', 'alice', 1)], [alice])).toEqual([]);
  });
  it('normalizes crew names', () => {
    expect(crewKey('  Phoenix  Team ')).toBe(crewKey('phoenix team'));
  });
});

describe('crew pool policies (REQ-POOL-003..006)', () => {
  const pool = [slot('Phoenix', 'alice', 1), slot('Phoenix', 'bob', 2)];
  const items = () => work('Phoenix', 3);

  it('primary-only gives everything to the primary', () => {
    const r = run(items(), pool, 'primary-only');
    expect(who(r)).toEqual(['Alice Chen', 'Alice Chen', 'Alice Chen']);
    expect([...r.values()].every((s) => s.assignedVia === 'primary')).toBe(true);
  });

  it('earliest spreads work to the backup as soon as it is free sooner', () => {
    const r = run(items(), pool, 'earliest');
    expect(who(r)).toEqual(['Alice Chen', 'Bob Martinez', 'Alice Chen']);
    expect(r.get('Phoenix-2')).toMatchObject({ assignedVia: 'backup', role: 2 });
    expect(r.get('Phoenix-2')!.start).toBe('2026-11-09');
  });

  it('earliest favours the primary on ties', () => {
    const r = run(work('Phoenix', 1), pool, 'earliest');
    expect(who(r)).toEqual(['Alice Chen']);
  });

  it('primary-preferred only uses the backup when it saves at least the threshold', () => {
    const second = (threshold: number) =>
      run(items(), pool, 'primary-preferred', {}, threshold).get('Phoenix-2')!;
    const saved = second(1);
    expect(saved.architect).toBe('Bob Martinez');
    const gap = 5;
    expect(second(gap).architect).toBe('Bob Martinez');
    expect(second(gap + 2).architect).toBe('Alice Chen');
  });

  it('a backup finishes the crew sooner than primary-only', () => {
    const only = run(items(), pool, 'primary-only');
    const earliest = run(items(), pool, 'earliest');
    expect(forecastFinish(earliest)! < forecastFinish(only)!).toBe(true);
  });

  it('adding a backup never delays the finish', () => {
    for (const policy of ['primary-only', 'primary-preferred', 'earliest'] as const) {
      const without = run(items(), [pool[0]!], policy);
      const withBackup = run(items(), pool, policy);
      expect(forecastFinish(withBackup)! <= forecastFinish(without)!).toBe(true);
    }
  });

  it('respects availableFrom for a backup', () => {
    const later = [
      slot('Phoenix', 'alice', 1),
      slot('Phoenix', 'bob', 2, { availableFrom: '2026-12-01' }),
    ];
    const r = run(items(), later, 'earliest');
    expect(r.get('Phoenix-2')!.architect).toBe('Alice Chen');
    const lateItems = work('Phoenix', 8);
    const r2 = run(lateItems, later, 'earliest');
    const bobItems = [...r2.values()].filter((s) => s.architect === 'Bob Martinez');
    expect(bobItems.length).toBeGreaterThan(0);
    expect(bobItems.every((s) => s.start! >= '2026-12-01')).toBe(true);
    const scoped = run(lateItems, later, 'earliest', {
      scope: { staffId: 'bob', crews: ['Phoenix'] },
    });
    expect([...scoped.values()].every((s) => s.start! >= '2026-12-01')).toBe(true);
  });

  it('ignores disabled backups', () => {
    const off = [slot('Phoenix', 'alice', 1), slot('Phoenix', 'bob', 2, { enabled: false })];
    expect(who(run(items(), off, 'earliest'))).toEqual(
      who(run(items(), [off[0]!], 'primary-only')),
    );
  });

  it('promotes the next enabled role when the primary is disabled', () => {
    const r = run(
      work('Phoenix', 1),
      [slot('Phoenix', 'alice', 1, { enabled: false }), slot('Phoenix', 'bob', 2)],
      'primary-only',
    );
    expect(r.get('Phoenix-1')).toMatchObject({ architect: 'Bob Martinez', assignedVia: 'primary' });
  });

  it('a person can be primary for one crew and backup for another', () => {
    const shared = [slot('Phoenix', 'alice', 1), slot('Nova', 'bob', 1), slot('Nova', 'alice', 2)];
    const r = run([...work('Phoenix', 2), ...work('Nova', 2)], shared, 'earliest');
    const aliceItems = [...r.values()].filter((s) => s.architect === 'Alice Chen');
    for (const s of aliceItems) expect(s.end! >= s.start!).toBe(true);
    const sorted = [...aliceItems].sort((a, b) => a.start!.localeCompare(b.start!));
    for (let i = 1; i < sorted.length; i++)
      expect(sorted[i]!.start! > sorted[i - 1]!.end!).toBe(true);
  });

  it('flags a crew with no pool and falls back to auto-assign', () => {
    const r = run(work('Orphan', 1), pool, 'primary-only');
    const s = r.get('Orphan-1')!;
    expect(s.flags).toContain('no-crew-pool');
    expect(s.suggested).toBe(true);
  });

  it('crew-pool mode ignores the Jira architect', () => {
    const r = run(work('Phoenix', 1, { architect: 'Carla Singh' }), pool, 'primary-only');
    expect(r.get('Phoenix-1')).toMatchObject({ architect: 'Alice Chen', assignedVia: 'primary' });
  });

  it('manual overrides win over pools', () => {
    const r = run(work('Phoenix', 1, { architectOverride: 'carla' }), pool, 'primary-only');
    expect(r.get('Phoenix-1')).toMatchObject({ architect: 'Carla Singh', assignedVia: 'override' });
    const auto = run(work('Phoenix', 1, { architectOverride: AUTO_ASSIGN }), pool, 'primary-only');
    expect(auto.get('Phoenix-1')!.assignedVia).toBe('auto');
  });

  it('in-progress items stay with their Jira architect', () => {
    const r = run(
      work('Phoenix', 1, {
        status: 'In Progress',
        architect: 'Bob Martinez',
        startDate: '2026-11-09',
      }),
      pool,
      'primary-only',
    );
    expect(r.get('Phoenix-1')).toMatchObject({ architect: 'Bob Martinez', assignedVia: 'jira' });
  });

  it('jira mode ignores crew pools entirely', () => {
    const r = schedule({
      items: work('Phoenix', 2, { architect: 'Carla Singh' }),
      staff: [alice, bob, carla],
      vacations: [],
      closures: [],
      crewAssignments: pool,
      settings: testSettings({ assignmentMode: 'jira' }),
    });
    expect(who(r)).toEqual(['Carla Singh', 'Carla Singh']);
    expect([...r.values()][0]!.assignedVia).toBe('jira');
  });

  it('done items keep their recorded architect and use no capacity', () => {
    const r = run(
      [
        ...work('Phoenix', 1, {
          status: 'Done',
          architect: 'Bob Martinez',
          startDate: '2026-10-01',
          endDate: '2026-10-05',
        }),
        ...work('Nova', 1),
      ],
      [...pool, slot('Nova', 'alice', 1)],
      'primary-only',
    );
    expect(r.get('Phoenix-1')!.assignedVia).toBe('jira');
    expect(r.get('Nova-1')!.start).toBe('2026-11-09');
  });
});

describe('architect scope (REQ-FOCUS-002..004)', () => {
  const pool = [
    slot('Phoenix', 'alice', 1),
    slot('Nova', 'alice', 1),
    slot('Nova', 'bob', 2),
    slot('Atlas', 'bob', 1),
  ];
  const ordered = () => {
    const p = work('Phoenix', 2);
    const n = work('Nova', 2);
    const a = work('Atlas', 2);
    return [p[0]!, n[0]!, a[0]!, p[1]!, n[1]!, a[1]!];
  };

  it('schedules only the selected architect and crews', () => {
    const r = run(ordered(), pool, 'primary-only', {
      scope: { staffId: 'alice', crews: ['Phoenix'] },
    });
    expect([...r.keys()].sort()).toEqual(['Phoenix-1', 'Phoenix-2']);
    expect(who(r)).toEqual(['Alice Chen', 'Alice Chen']);
    expect(r.get('Phoenix-1')!.start).toBe('2026-11-09');
  });

  it('adding a crew interleaves by rank and never finishes earlier', () => {
    const one = run(ordered(), pool, 'primary-only', {
      scope: { staffId: 'alice', crews: ['Phoenix'] },
    });
    const two = run(ordered(), pool, 'primary-only', {
      scope: { staffId: 'alice', crews: ['Phoenix', 'Nova'] },
    });
    expect(two.size).toBe(4);
    const order = [...two.values()]
      .sort((a, b) => a.start!.localeCompare(b.start!))
      .map((s) => s.key);
    expect(order).toEqual(['Phoenix-1', 'Nova-1', 'Phoenix-2', 'Nova-2']);
    expect(two.get('Phoenix-2')!.end! > one.get('Phoenix-2')!.end!).toBe(true);
    expect(forecastFinish(two)! >= forecastFinish(one)!).toBe(true);
  });

  it('keeps assignments from the team-wide plan', () => {
    const items = [...work('Nova', 3)];
    const team = run(items, pool, 'earliest');
    const bobKeys = [...team.values()]
      .filter((s) => s.architect === 'Bob Martinez')
      .map((s) => s.key);
    expect(bobKeys.length).toBeGreaterThan(0);
    const scoped = run(items, pool, 'earliest', { scope: { staffId: 'bob', crews: ['Nova'] } });
    expect([...scoped.keys()].sort()).toEqual(bobKeys.sort());
  });

  it('all crews in scope equals the architect slice of the team plan when nobody else competes', () => {
    const items = ordered().filter((i) => !i.key.startsWith('Atlas'));
    const team = run(
      items,
      [slot('Phoenix', 'alice', 1), slot('Nova', 'alice', 1)],
      'primary-only',
    );
    const scoped = run(
      items,
      [slot('Phoenix', 'alice', 1), slot('Nova', 'alice', 1)],
      'primary-only',
      {
        scope: { staffId: 'alice', crews: ['Phoenix', 'Nova'] },
      },
    );
    for (const [k, v] of scoped)
      expect([v.start, v.end]).toEqual([team.get(k)!.start, team.get(k)!.end]);
  });

  it('ignores other architects capacity inside the scope', () => {
    const items = [...work('Nova', 2), ...work('Atlas', 2)];
    const team = run(items, pool, 'primary-only');
    const scoped = run(items, pool, 'primary-only', {
      scope: { staffId: 'bob', crews: ['Atlas'] },
    });
    expect(scoped.size).toBe(2);
    expect(scoped.get('Atlas-1')!.start).toBe(team.get('Atlas-1')!.start);
  });

  it('copies assignment details back from the team plan', () => {
    const items = work('Nova', 3);
    const scoped = run(items, pool, 'earliest', { scope: { staffId: 'bob', crews: ['Nova'] } });
    for (const s of scoped.values()) expect(s.assignedVia).toBe('backup');
  });
});

describe('baseline comparison (REQ-POOL-008..010)', () => {
  const pool = [slot('Phoenix', 'alice', 1), slot('Phoenix', 'bob', 2)];
  const items = () => work('Phoenix', 3);

  it('summarizes a schedule as a reference', () => {
    const r = run(items(), pool, 'primary-only');
    const ref = makeReference(r, 'x');
    expect(ref.finish).toBe(forecastFinish(r));
    expect(Object.keys(ref.items)).toHaveLength(3);
    const b = makeBaseline(r, new Date('2026-01-02T03:04:05Z'));
    expect(b.takenAt).toBe('2026-01-02T03:04:05.000Z');
    expect(b.label).toBe('baseline');
  });

  it('excludes done items and finds no finish for empty schedules', () => {
    const r = run(
      work('Phoenix', 1, { status: 'Done', startDate: '2026-10-01', endDate: '2026-10-02' }),
      pool,
    );
    expect(forecastFinish(r)).toBeNull();
    expect(Object.keys(makeReference(r, 'x').items)).toHaveLength(0);
  });

  it('computes per-item and overall deltas when a backup is added', () => {
    const base = makeBaseline(run(items(), [pool[0]!], 'earliest'));
    const now = run(items(), pool, 'earliest');
    expect(finishDelta(base, now)!).toBeLessThan(0);
    expect(endDelta(base.items['Phoenix-2'], now.get('Phoenix-2'))!).toBeLessThan(0);
    expect(endDelta(base.items['Phoenix-1'], now.get('Phoenix-1'))).toBe(0);
    expect(endDelta(undefined, now.get('Phoenix-1'))).toBeNull();
    expect(finishDelta(null, now)).toBeNull();
    const changes = architectChanges(base, now);
    expect(changes.get('Bob Martinez')).toEqual({ gained: 1, lost: 0 });
    expect(changes.get('Alice Chen')).toEqual({ gained: 0, lost: 1 });
  });

  it('formats deltas', () => {
    expect(formatDelta(null)).toBe('');
    expect(formatDelta(0)).toBe('0d');
    expect(formatDelta(6)).toBe('+6d');
    expect(formatDelta(-3)).toBe('-3d');
  });
});

describe('focus helpers (REQ-FOCUS-001..006)', () => {
  const pool = [
    slot('Phoenix', 'alice', 1),
    slot('Nova', 'alice', 1),
    slot('Atlas', 'bob', 1),
    slot('Atlas', 'alice', 2),
  ];
  const mixed = () => {
    const p = work('Phoenix', 2);
    const n = work('Nova', 2);
    const a = work('Atlas', 1);
    return [p[0]!, n[0]!, a[0]!, p[1]!, n[1]!];
  };

  it('lists the architect crews with roles and workload', () => {
    const items = mixed();
    const full = run(items, pool, 'primary-only');
    const chips = crewsForArchitect(items, full, pool, 'alice');
    expect(chips.map((c) => [c.name, c.role, c.items, c.points])).toEqual(
      [
        ['Atlas', 2, 0, 0],
        ['Nova', 1, 2, 10],
        ['Phoenix', 1, 2, 10],
      ].sort(
        (a, b) =>
          Number(a[1]) - Number(b[1]) ||
          Number(b[2]) - Number(a[2]) ||
          String(a[0]).localeCompare(String(b[0])),
      ),
    );
  });

  it('includes crews worked via Jira with no pool and the no-crew bucket', () => {
    const items = [
      item({ key: 'X', crew: '', architect: 'Alice Chen', slaDays: 1, storyPoints: 2 }),
    ];
    const full = schedule({
      items,
      staff: [alice],
      vacations: [],
      closures: [],
      settings: testSettings(),
    });
    const chips = crewsForArchitect(items, full, [], 'alice');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ key: '', name: '(No crew)', items: 1, points: 2 });
  });

  it('selects items for an architect and crews', () => {
    const items = mixed();
    const full = run(items, pool, 'primary-only');
    expect(itemsForArchitectCrews(items, full, 'alice', ['phoenix']).map((i) => i.key)).toEqual([
      'Phoenix-1',
      'Phoenix-2',
    ]);
    const scoped = run(items, pool, 'primary-only', {
      scope: { staffId: 'alice', crews: ['Phoenix'] },
    });
    expect(itemsInSchedule(items, scoped)).toHaveLength(2);
  });

  it('computes per-crew stats and groups by crew', () => {
    const items = mixed();
    const full = run(items, pool, 'primary-only');
    const stats = crewStats(items, full);
    expect(stats.map((s) => [s.name, s.items, s.points])).toEqual([
      ['Phoenix', 2, 10],
      ['Nova', 2, 10],
      ['Atlas', 1, 5],
    ]);
    expect(stats.every((s) => s.finish)).toBe(true);
    expect(groupByCrew(items).map((i) => i.key)).toEqual([
      'Phoenix-1',
      'Phoenix-2',
      'Nova-1',
      'Nova-2',
      'Atlas-1',
    ]);
  });

  it('describes how a crew selection change moves finishes', () => {
    const items = mixed();
    const sel = (crews: string[]) =>
      run(items, pool, 'primary-only', { scope: { staffId: 'alice', crews } });
    const before = sel(['Phoenix']);
    const after = sel(['Phoenix', 'Nova']);
    const nameOf = (k: string) => k.toUpperCase();
    const change = compareSelections(
      crewStats(items, before),
      crewStats(items, after),
      ['phoenix'],
      ['phoenix', 'nova'],
      nameOf,
    );
    expect(change.description).toBe('Adding NOVA');
    expect(change.crews.find((c) => c.name === 'Phoenix')!.days).toBeGreaterThan(0);
    expect(change.combined).toBeGreaterThan(0);

    const removed = compareSelections([], [], ['a', 'b'], ['a'], nameOf);
    expect(removed.description).toBe('Removing B');
    expect(removed.combined).toBeNull();
    expect(compareSelections([], [], ['a'], ['b', 'c', 'd'], nameOf).description).toBe(
      'Adding B, C and D and Removing A',
    );
    expect(compareSelections([], [], ['a'], ['a'], nameOf).description).toBe(
      'Crew selection changed',
    );
  });
});

describe('crew CSV (REQ-POOL-012)', () => {
  it('parses roles in several spellings', () => {
    expect(parseRole('1')).toBe(1);
    expect(parseRole(' Primary ')).toBe(1);
    expect(parseRole('Backup')).toBe(2);
    expect(parseRole('backup 2')).toBe(3);
    expect(parseRole('9')).toBeNull();
    expect(parseRole(undefined)).toBeNull();
  });

  it('parses the sample file and counts skipped rows', () => {
    const parsed = parseCrewCsv(sample('crew-pools.csv'));
    expect(parsed.assignments).toHaveLength(8);
    expect(parsed.assignments.find((a) => a.staffName === 'Erin Walsh')).toMatchObject({
      crew: 'Orion',
      role: 2,
      availableFrom: '2026-11-02',
    });
    const bad = parseCrewCsv('Crew,Architect,Role\nPhoenix,Alice,1\n,Bob,2\nNova,Carla,zzz\n');
    expect(bad.assignments).toHaveLength(1);
    expect(bad.skipped).toBe(2);
  });

  it('requires the key columns', () => {
    expect(() => parseCrewCsv('Crew,Architect\nA,B\n')).toThrow(/Crew, Architect and Role/);
  });

  it('is detected apart from vacations, closures and Jira exports', () => {
    expect(detectFileType(sample('crew-pools.csv'))).toBe('crew');
    expect(detectFileType('Name,Date\nHoliday,2026-12-25\n')).not.toBe('crew');
  });
});
