import { describe, expect, it } from 'vitest';
import { schedule } from '../../src/core/scheduler';
import { AUTO_ASSIGN } from '../../src/core/types';
import { importFiles, importText } from '../../src/state/importFile';
import {
  APP_ID,
  STORAGE_KEY,
  clearSaved,
  coerceState,
  exportPlanCsv,
  loadState,
  parseProject,
  saveState,
  serializeProject,
} from '../../src/state/persistence';
import { initialState, makeId, reducer, type AppState } from '../../src/state/store';
import { fixture, item, testState } from '../helpers';
import { parseCsv } from '../../src/parsers/csv';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

const withStaff = (s: AppState = testState()) =>
  reducer(s, { type: 'addStaff', names: ['Alice Chen', 'Bob Martinez'] });

describe('reducer', () => {
  it('adds unique, trimmed staff names (REQ-STF-002, REQ-STF-004)', () => {
    let s = withStaff();
    s = reducer(s, { type: 'addStaff', names: ['  alice   CHEN ', '', 'Carla'] });
    expect(s.staff.map((x) => x.name)).toEqual(['Alice Chen', 'Bob Martinez', 'Carla']);
    expect(reducer(s, { type: 'addStaff', names: ['carla'] })).toBe(s);
  });

  it('removing staff removes their vacations and overrides (REQ-STF-005)', () => {
    let s = withStaff();
    const bob = s.staff[1]!.id;
    s = reducer(s, {
      type: 'addVacations',
      vacations: [{ staffId: bob, start: '2026-11-10', end: '2026-11-10', note: '' }],
    });
    s = reducer(s, {
      type: 'setItems',
      items: [item({ key: 'K', architectOverride: bob })],
      fileName: 'j.csv',
    });
    s = reducer(s, { type: 'removeStaff', id: bob });
    expect(s.staff).toHaveLength(1);
    expect(s.vacations).toHaveLength(0);
    expect(s.items[0]!.architectOverride).toBeNull();
  });

  it('dedupes vacations and rejects invalid ranges (REQ-VAC-003)', () => {
    let s = withStaff();
    const id = s.staff[0]!.id;
    const v = { staffId: id, start: '2026-11-10', end: '2026-11-12', note: '' };
    s = reducer(s, {
      type: 'addVacations',
      vacations: [v, v, { ...v, start: '2026-11-20', end: '2026-11-19' }],
    });
    expect(s.vacations).toHaveLength(1);
    s = reducer(s, { type: 'removeVacation', id: s.vacations[0]!.id });
    expect(s.vacations).toHaveLength(0);
  });

  it('dedupes closures and rejects invalid ranges (REQ-CLS-007)', () => {
    let s = testState();
    const c = { name: 'X', start: '2026-11-11', end: '2026-11-11' };
    s = reducer(s, {
      type: 'addClosures',
      closures: [c, c, { name: 'bad', start: '2026-11-11', end: '2026-11-01' }],
    });
    expect(s.closures).toHaveLength(1);
    s = reducer(s, { type: 'removeClosure', id: s.closures[0]!.id });
    expect(s.closures).toHaveLength(0);
  });

  it('reorders, edits and resets items (REQ-GRID-009, REQ-GRID-010, REQ-GRID-014)', () => {
    let s = reducer(testState(), {
      type: 'setItems',
      items: [
        item({ key: 'a', rank: '1' }),
        item({ key: 'b', rank: '2' }),
        item({ key: 'c', rank: '3' }),
      ],
      fileName: null,
    });
    s = reducer(s, { type: 'moveItem', activeKey: 'c', overKey: 'a' });
    expect(s.items.map((i) => i.key)).toEqual(['c', 'a', 'b']);
    s = reducer(s, { type: 'moveWithinVisible', key: 'b', delta: -1, visibleKeys: ['c', 'b'] });
    expect(s.items.map((i) => i.key)).toEqual(['b', 'c', 'a']);
    s = reducer(s, {
      type: 'updateItem',
      key: 'a',
      patch: { slaDays: 9, storyPoints: 1.5, architectOverride: AUTO_ASSIGN },
    });
    expect(s.items.find((i) => i.key === 'a')).toMatchObject({
      slaDays: 9,
      storyPoints: 1.5,
      architectOverride: AUTO_ASSIGN,
    });
    s = reducer(s, { type: 'resetOrder' });
    expect(s.items.map((i) => i.key)).toEqual(['a', 'b', 'c']);
  });

  it('updates settings, replaces and clears state (REQ-PER-006)', () => {
    let s = reducer(withStaff(), { type: 'updateSettings', patch: { daysPerPoint: 2 } });
    expect(s.settings.daysPerPoint).toBe(2);
    s = reducer(s, { type: 'clearAll' });
    expect(s.staff).toEqual([]);
    expect(s.settings.daysPerPoint).toBe(2);
    const other = initialState();
    expect(reducer(s, { type: 'replaceAll', state: other })).toBe(other);
  });

  it('generates unique ids', () => {
    expect(makeId('x')).not.toBe(makeId('x'));
  });
});

describe('persistence (REQ-PER-001..008)', () => {
  it('saves and loads the session', () => {
    const storage = memoryStorage();
    const s = withStaff();
    expect(saveState(s, storage)).toBe(true);
    expect(loadState(storage)).toEqual(s);
    clearSaved(storage);
    expect(loadState(storage)).toBeNull();
  });

  it('survives broken storage', () => {
    const broken = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('quota');
      },
      getItem: () => '{bad json',
    } as Storage;
    expect(saveState(testState(), broken)).toBe(false);
    expect(loadState(broken)).toBeNull();
  });

  it('round-trips project files with version metadata', () => {
    const s = withStaff();
    const text = serializeProject(s, new Date('2026-11-01T00:00:00Z'));
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({
      app: APP_ID,
      version: 1,
      exportedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(parseProject(text)).toEqual(s);
  });

  it('rejects invalid project files', () => {
    expect(() => parseProject('nope')).toThrow(/valid JSON/);
    expect(() => parseProject('{"app":"other"}')).toThrow(/Not a/);
    expect(() => parseProject(JSON.stringify({ app: APP_ID, version: 99, data: {} }))).toThrow(
      /version/,
    );
    expect(() => coerceState({ staff: [] })).toThrow(/vacations/);
    expect(() => coerceState(null)).toThrow();
  });

  it('fills defaults for older data', () => {
    const s = coerceState({ staff: [], vacations: [], closures: [], items: [{ key: 'a' }] });
    expect(s.items[0]).toMatchObject({ architectOverride: null, fileIndex: 0 });
    expect(s.settings.daysPerPoint).toBe(1);
    expect(s.jiraFileName).toBeNull();
  });

  it('uses the expected storage key', () => {
    expect(STORAGE_KEY).toMatch(/jira-gantt-forecaster/);
  });

  it('exports the plan as CSV in plan order (REQ-PER-005)', () => {
    const s = withStaff();
    const items = [
      item({ key: 'B', architect: 'Bob Martinez', slaDays: 2 }),
      item({ key: 'U', architect: '', slaDays: 1, storyPoints: 3 }),
    ];
    const sched = schedule({ ...s, items });
    const rows = parseCsv(exportPlanCsv(items, sched));
    expect(rows[0]).toContain('Forecast Start');
    expect(rows[1]!.slice(0, 2)).toEqual(['1', 'B']);
    expect(rows[2]).toContain('yes');
    expect(rows[2]).toContain('Alice Chen');
  });
});

describe('importText / importFiles', () => {
  it('imports each fixture type', () => {
    let s = testState();
    for (const [name, kind] of [
      ['staff.csv', 'staff'],
      ['closures.csv', 'closure'],
      ['vacations.csv', 'vacation'],
      ['jira.csv', 'jira'],
    ] as const) {
      const r = importText(fixture(name), name, s);
      expect(r.kind).toBe(kind);
      expect(r.level).toBe('success');
      for (const a of r.actions) s = reducer(s, a);
    }
    expect(s.staff).toHaveLength(2);
    expect(s.vacations).toHaveLength(1);
    expect(s.closures).toHaveLength(1);
    expect(s.items).toHaveLength(4);
    expect(s.jiraFileName).toBe('jira.csv');
  });

  it('reports vacations for unknown staff (REQ-VAC-004)', () => {
    const r = importText(fixture('vacations.csv'), 'v.csv', testState());
    expect(r.level).toBe('error');
    expect(r.message).toMatch(/add staff first/);
    const s = withStaff();
    const mixed = importText(
      'Staff,Start\nBob Martinez,2026-11-10\nZed,2026-11-10\nBob Martinez,bad',
      'v.csv',
      s,
    );
    expect(mixed.level).toBe('warning');
    expect(mixed.message).toMatch(
      /1 vacation, skipped 1 invalid row, skipped 1 row for unknown staff/,
    );
  });

  it('reports unknown and empty files (REQ-IMP-007)', () => {
    expect(importText('a,b\n1,2', 'mystery.csv', testState())).toMatchObject({
      level: 'error',
      actions: [],
    });
    expect(importText('Issue key,Summary\n', 'j.csv', testState()).message).toMatch(
      /no Jira items/,
    );
    expect(importText('Date,Name\nxx,y', 'c.csv', testState()).message).toMatch(/no closure/);
    expect(importText('{bad', 'p.json', testState()).message).toMatch(/valid JSON/);
  });

  it('warns about skipped Jira rows', () => {
    const r = importText('Issue key,Summary\nA,x\n,y', 'j.csv', testState());
    expect(r.level).toBe('warning');
    expect(r.message).toMatch(/1 Jira item, skipped 1 row/);
  });

  it('restores project files (REQ-PER-004)', () => {
    const s = withStaff();
    const r = importText(serializeProject(s), 'p.json', testState());
    expect(r.actions[0]).toEqual({ type: 'replaceAll', state: s });
  });

  it('applies staff before vacations when dropped together', () => {
    const { state, results } = importFiles(
      [
        { name: 'vacations.csv', text: fixture('vacations.csv') },
        { name: 'jira.csv', text: fixture('jira.csv') },
        { name: 'staff.csv', text: fixture('staff.csv') },
      ],
      testState(),
    );
    expect(results.map((r) => r.kind)).toEqual(['staff', 'jira', 'vacation']);
    expect(state.vacations).toHaveLength(1);
  });
});

describe('crew pool state (REQ-POOL-001, REQ-POOL-002, REQ-POOL-011..013)', () => {
  const ids = (s: AppState) => s.staff.map((x) => x.id);
  const base = () => {
    let s = reducer(testState(), {
      type: 'addStaff',
      names: ['Alice Chen', 'Bob Martinez', 'Carla Singh'],
    });
    s = reducer(s, {
      type: 'setItems',
      fileName: 'j.csv',
      items: [
        item({ key: 'A', crew: 'Phoenix', architect: 'Alice Chen' }),
        item({ key: 'B', crew: 'phoenix', architect: 'Alice Chen' }),
        item({ key: 'C', crew: 'Phoenix', architect: 'Bob Martinez' }),
        item({ key: 'D', crew: 'Nova', architect: 'Bob Martinez' }),
        item({ key: 'E', crew: 'Nova', architect: 'Zed' }),
        item({ key: 'F', crew: '', architect: 'Alice Chen' }),
      ],
    });
    return s;
  };

  it('puts one person in one slot per crew and frees the previous holder', () => {
    let s = base();
    const [alice, bob, carla] = ids(s) as [string, string, string];
    s = reducer(s, { type: 'setCrewSlot', crew: 'Phoenix', role: 1, staffId: alice });
    s = reducer(s, { type: 'setCrewSlot', crew: 'Phoenix', role: 2, staffId: bob });
    s = reducer(s, { type: 'setCrewSlot', crew: 'Phoenix', role: 3, staffId: carla });
    expect(s.crewAssignments.map((a) => [a.staffId, a.role])).toEqual([
      [alice, 1],
      [bob, 2],
      [carla, 3],
    ]);
    s = reducer(s, { type: 'setCrewSlot', crew: ' phoenix ', role: 1, staffId: bob });
    const roles = Object.fromEntries(s.crewAssignments.map((a) => [a.staffId, a.role]));
    expect(roles).toEqual({ [bob]: 1, [carla]: 3 });
    s = reducer(s, { type: 'setCrewSlot', crew: 'Phoenix', role: 3, staffId: null });
    expect(s.crewAssignments).toHaveLength(1);
    expect(
      reducer(s, { type: 'setCrewSlot', crew: '', role: 1, staffId: alice }).crewAssignments,
    ).toHaveLength(1);
  });

  it('toggles an assignment and sets or clears availableFrom', () => {
    const start = base();
    const alice = ids(start)[0]!;
    let s = reducer(start, { type: 'setCrewSlot', crew: 'Nova', role: 2, staffId: alice });
    s = reducer(s, { type: 'toggleCrewAssignment', crew: 'nova', staffId: alice });
    expect(s.crewAssignments[0]!.enabled).toBe(false);
    s = reducer(s, {
      type: 'setCrewAvailableFrom',
      crew: 'Nova',
      staffId: alice,
      date: '2026-12-01',
    });
    expect(s.crewAssignments[0]!.availableFrom).toBe('2026-12-01');
    s = reducer(s, { type: 'setCrewAvailableFrom', crew: 'Nova', staffId: alice, date: null });
    expect(s.crewAssignments[0]).not.toHaveProperty('availableFrom');
    const untouched = reducer(s, { type: 'toggleCrewAssignment', crew: 'Other', staffId: alice });
    expect(untouched.crewAssignments).toEqual(s.crewAssignments);
  });

  it('seeds each crew primary with its most frequent Jira architect and keeps existing primaries', () => {
    const start = base();
    const [alice, bob] = ids(start) as [string, string];
    let s = reducer(start, { type: 'seedCrewPools' });
    const primaries = Object.fromEntries(
      s.crewAssignments.map((a) => [a.crew.toLowerCase(), a.staffId]),
    );
    expect(primaries).toEqual({ phoenix: alice, nova: bob });
    s = reducer(s, { type: 'setCrewSlot', crew: 'Phoenix', role: 1, staffId: bob });
    s = reducer(s, { type: 'seedCrewPools' });
    expect(s.crewAssignments.find((a) => a.crew === 'Phoenix' && a.role === 1)!.staffId).toBe(bob);
  });

  it('imports crew assignments and removes them with the staff member', () => {
    const start = base();
    const [alice, bob] = ids(start) as [string, string];
    let s = reducer(start, {
      type: 'importCrewAssignments',
      assignments: [
        { crew: 'Phoenix', staffId: alice, role: 1 },
        { crew: 'Phoenix', staffId: bob, role: 2, availableFrom: '2026-11-02' },
      ],
    });
    expect(s.crewAssignments).toHaveLength(2);
    expect(s.crewAssignments[1]).toMatchObject({ enabled: true, availableFrom: '2026-11-02' });
    s = reducer(s, { type: 'removeStaff', id: bob });
    expect(s.crewAssignments.map((a) => a.staffId)).toEqual([alice]);
  });

  it('imports a crew CSV, mapping names and reporting unknown staff', () => {
    const s = base();
    const ok = importText(
      'Crew,Architect,Role\nPhoenix,Alice Chen,1\nPhoenix,bob martinez,2\n',
      'c.csv',
      s,
    );
    expect(ok.kind).toBe('crew');
    expect(ok.level).toBe('success');
    expect(ok.message).toMatch(/2 crew assignments/);
    const mixed = importText(
      'Crew,Architect,Role\nPhoenix,Alice Chen,1\nNova,Zed,2\nNova,Bob Martinez,zzz\n',
      'c.csv',
      s,
    );
    expect(mixed.level).toBe('warning');
    expect(mixed.message).toMatch(/skipped 1 invalid row, skipped 1 row for unknown staff/);
    const none = importText('Crew,Architect,Role\nPhoenix,Zed,1\n', 'c.csv', s);
    expect(none.level).toBe('error');
    expect(none.message).toMatch(/add staff first/);
    expect(importText('Crew,Architect,Role\n', 'c.csv', s).message).toMatch(/no crew assignments/);
    expect(importText('Crew,Architect\nA,B\n', 'c.csv', s, 'crew').level).toBe('error');
  });

  it('sets and clears a baseline, and a new Jira file clears it', () => {
    let s = base();
    const baseline = {
      label: 'baseline',
      finish: '2026-12-01',
      items: {},
      takenAt: '2026-01-01T00:00:00.000Z',
    };
    s = reducer(s, { type: 'setBaseline', baseline });
    expect(s.baseline).toEqual(baseline);
    s = reducer(s, { type: 'clearBaseline' });
    expect(s.baseline).toBeNull();
    s = reducer(s, { type: 'setBaseline', baseline });
    s = reducer(s, { type: 'setItems', items: [item()], fileName: 'again.csv' });
    expect(s.baseline).toBeNull();
  });

  it('persists pools and the baseline, and defaults them for older saves', () => {
    const start = base();
    const alice = ids(start)[0]!;
    const withPools = {
      ...reducer(start, { type: 'setCrewSlot', crew: 'Phoenix', role: 1, staffId: alice }),
      baseline: { label: 'baseline', finish: null, items: {}, takenAt: 'x' },
    };
    const round = parseProject(serializeProject(withPools));
    expect(round.crewAssignments).toEqual(withPools.crewAssignments);
    expect(round.baseline).toEqual(withPools.baseline);

    const old = coerceState({
      staff: [],
      vacations: [],
      closures: [],
      items: [],
      settings: { forecastStart: '2026-01-05' },
    });
    expect(old.crewAssignments).toEqual([]);
    expect(old.baseline).toBeNull();
    expect(old.settings.assignmentMode).toBe('jira');
    expect(old.settings.poolPolicy).toBe('primary-preferred');
    expect(old.settings.backupThresholdDays).toBe(5);
  });

  it('exports how each item was assigned', () => {
    const start = base();
    const alice = ids(start)[0]!;
    const s = reducer(
      reducer(start, { type: 'setCrewSlot', crew: 'Phoenix', role: 1, staffId: alice }),
      {
        type: 'updateSettings',
        patch: { assignmentMode: 'crew-pool', forecastStart: '2026-11-09' },
      },
    );
    const csv = exportPlanCsv(s.items, schedule({ ...s, scope: undefined }));
    expect(csv.split('\n')[0]).toContain('Assigned Via');
    expect(csv).toContain('primary');
  });
});
