import { describe, expect, it } from 'vitest';
import { jiraChanges, rankMoves, type JiraChange } from '../../src/core/jiraChanges';
import { moveItem } from '../../src/core/rank';
import { schedule } from '../../src/core/scheduler';
import { AUTO_ASSIGN } from '../../src/core/types';
import { parseJiraCsv } from '../../src/parsers/jiraCsv';
import {
  buildJiraScript,
  commentText,
  defaultNote,
  normalizeBaseUrl,
  planUpdates,
  shellQuote,
  type ScriptSettings,
} from '../../src/state/jiraScript';
import { coerceState } from '../../src/state/persistence';
import { reducer } from '../../src/state/store';
import { fixture, item, testSettings, testState } from '../helpers';

const SETTINGS: ScriptSettings = {
  jiraBaseUrl: 'https://jira.pncint.net',
  storyPointsField: 'customfield_10002',
  slaDaysField: 'customfield_20001',
  architectField: 'customfield_20002',
  architectFieldType: 'user',
  targetStartField: 'customfield_20003',
  targetEndField: 'customfield_20004',
  exportRankChanges: true,
};

const ranked = (keys: string[]) =>
  keys.map((key, i) => item({ key, rank: `0|i${String(i).padStart(4, '0')}:`, fileIndex: i }));

/** Replays rank moves the way Jira applies them, one at a time. */
function applyMoves(order: string[], moves: ReturnType<typeof rankMoves>): string[] {
  const next = [...order];
  for (const m of moves) {
    next.splice(next.indexOf(m.key), 1);
    const anchor = next.indexOf((m.after ?? m.before)!);
    next.splice(m.after ? anchor + 1 : anchor, 0, m.key);
  }
  return next;
}

/** Forecast dates are left out unless asked for, to keep the other cases short. */
function changesFor(state = testState(), dates = false) {
  return jiraChanges({
    items: state.items,
    staff: state.staff,
    scheduled: schedule(state),
    settings: { ...state.settings, exportForecastDates: dates },
  });
}

describe('rank moves (REQ-JIRA-004)', () => {
  it('is empty when the plan keeps Jira rank order', () => {
    expect(rankMoves(ranked(['A', 'B', 'C']))).toEqual([]);
  });

  it('moves only the items that left their place', () => {
    const items = moveItem(ranked(['A', 'B', 'C', 'D', 'E']), 'D', 'B');
    expect(items.map((i) => i.key)).toEqual(['A', 'D', 'B', 'C', 'E']);
    expect(rankMoves(items)).toEqual([{ kind: 'rank', key: 'D', after: 'A' }]);
  });

  it('ranks a new first item before the first unmoved item', () => {
    const items = moveItem(ranked(['A', 'B', 'C']), 'C', 'A');
    expect(rankMoves(items)).toEqual([{ kind: 'rank', key: 'C', before: 'A' }]);
  });

  it('reproduces any plan order when replayed in sequence', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let run = 0; run < 200; run++) {
      const keys = Array.from({ length: 1 + Math.floor(random() * 12) }, (_, i) => `K-${i}`);
      const shuffled = [...ranked(keys)].sort(() => random() - 0.5);
      const moves = rankMoves(shuffled);
      expect(applyMoves(keys, moves)).toEqual(shuffled.map((i) => i.key));
      expect(moves.every((m) => (m.after ?? m.before) !== undefined)).toBe(true);
    }
  });
});

describe('detecting changes (REQ-JIRA-001, REQ-JIRA-002, REQ-JIRA-003)', () => {
  it('keeps the imported Jira estimates on each item', () => {
    const [a1] = parseJiraCsv(fixture('jira.csv')).items;
    expect(a1!.jira).toEqual({ storyPoints: 5, slaDays: 3 });
  });

  it('finds story point and SLA edits and ignores values set back', () => {
    let state = testState({ items: parseJiraCsv(fixture('jira.csv')).items });
    state = reducer(state, { type: 'updateItem', key: 'A-1', patch: { storyPoints: 8 } });
    state = reducer(state, { type: 'updateItem', key: 'A-2', patch: { slaDays: null } });
    state = reducer(state, { type: 'updateItem', key: 'B-1', patch: { slaDays: 9 } });
    state = reducer(state, { type: 'updateItem', key: 'B-1', patch: { slaDays: 5 } });
    expect(changesFor(state)).toEqual([
      { kind: 'storyPoints', key: 'A-1', from: 5, to: 8 },
      { kind: 'slaDays', key: 'A-2', from: 2, to: null },
    ]);
  });

  it('reports no estimate changes for items saved before originals were kept', () => {
    const state = coerceState({
      ...testState(),
      items: [{ ...item({ key: 'OLD-1', storyPoints: 3 }), jira: undefined }],
    });
    expect(changesFor(state)).toEqual([]);
  });

  it('writes architect overrides that differ from Jira', () => {
    let state = testState({
      items: [
        item({ key: 'X-1', architect: 'Alice Chen' }),
        item({ key: 'X-2', architect: 'Bob Martinez' }),
        item({ key: 'X-3', architect: '' }),
      ],
    });
    state = reducer(state, { type: 'addStaff', names: ['Alice Chen', 'Bob Martinez'] });
    const [alice, bob] = state.staff;
    const set = (key: string, architectOverride: string) =>
      (state = reducer(state, { type: 'updateItem', key, patch: { architectOverride } }));
    set('X-1', bob!.id);
    set('X-2', bob!.id);
    set('X-3', AUTO_ASSIGN);
    const changes = changesFor(state);
    expect(changes).toEqual([
      { kind: 'architect', key: 'X-1', from: 'Alice Chen', to: bob },
      { kind: 'architect', key: 'X-3', from: '', to: alice },
    ]);
  });

  it('only writes forecast suggestions when asked to', () => {
    let state = testState({ items: [item({ key: 'S-1', architect: '' })] });
    state = reducer(state, { type: 'addStaff', names: ['Alice Chen'] });
    expect(changesFor(state)).toEqual([]);
    state = { ...state, settings: testSettings({ exportForecastArchitects: true }) };
    expect(changesFor(state)).toEqual([
      { kind: 'architect', key: 'S-1', from: '', to: state.staff[0] },
    ]);
  });

  it('lists field changes before rank moves', () => {
    let state = testState({ items: parseJiraCsv(fixture('jira.csv')).items });
    state = reducer(state, { type: 'moveItem', activeKey: 'U-1', overKey: 'A-1' });
    state = reducer(state, { type: 'updateItem', key: 'B-1', patch: { storyPoints: 2 } });
    expect(changesFor(state).map((c) => c.kind)).toEqual(['storyPoints', 'rank']);
  });

  it('sets target start and end to the forecast where they differ (REQ-JIRA-011)', () => {
    let state = testState({
      items: [
        item({ key: 'D-1', slaDays: 3, startDate: '2026-11-09', endDate: '2026-11-20' }),
        item({ key: 'D-2', slaDays: 2 }),
        item({ key: 'D-3', status: 'Done', startDate: '2026-10-01', endDate: '2026-10-02' }),
        item({ key: 'D-4', slaDays: null, storyPoints: null }),
      ],
    });
    state = reducer(state, { type: 'addStaff', names: ['Alice Chen'] });
    expect(changesFor(state, true)).toEqual([
      { kind: 'targetEnd', key: 'D-1', from: '2026-11-20', to: '2026-11-11' },
      { kind: 'targetStart', key: 'D-2', from: null, to: '2026-11-12' },
      { kind: 'targetEnd', key: 'D-2', from: null, to: '2026-11-13' },
    ]);
    state = { ...state, settings: testSettings({ exportForecastDates: false }) };
    expect(jiraChanges({ ...state, scheduled: schedule(state), settings: state.settings })).toEqual(
      [],
    );
  });

  it('stores Jira usernames on staff', () => {
    let state = reducer(testState(), { type: 'addStaff', names: ['Alice Chen'] });
    const id = state.staff[0]!.id;
    state = reducer(state, { type: 'setStaffUsername', id, username: ' achen ' });
    expect(state.staff[0]!.jiraUsername).toBe('achen');
    state = reducer(state, { type: 'setStaffUsername', id, username: '' });
    expect(state.staff[0]).not.toHaveProperty('jiraUsername');
  });
});

describe('curl script (REQ-JIRA-005 to REQ-JIRA-009, REQ-JIRA-012)', () => {
  const alice = { id: 's1', name: 'Alice Chen', jiraUsername: 'achen' };
  const changes: JiraChange[] = [
    { kind: 'storyPoints', key: 'A-1', from: 5, to: 8 },
    { kind: 'targetEnd', key: 'A-1', from: '2026-11-13', to: '2026-11-16' },
    { kind: 'slaDays', key: 'A-2', from: 2, to: null },
    { kind: 'architect', key: 'B-1', from: 'Bob Martinez', to: alice },
    { kind: 'targetStart', key: 'B-1', from: null, to: '2026-11-09' },
    { kind: 'rank', key: 'U-1', before: 'A-1' },
    { kind: 'rank', key: 'B-1', after: 'U-1' },
  ];
  const now = new Date('2026-10-18T12:00:00Z');
  const note = 'Based on a meeting on October 20, 2026, these fields changed:';
  const commandLines = (text: string) => text.split('\n').filter((l) => l.startsWith('curl '));
  const script = (c = changes, s: Partial<ScriptSettings> = {}, n: string | null = note) =>
    buildJiraScript(
      planUpdates(c, { ...SETTINGS, ...s }),
      { ...SETTINGS, ...s },
      {
        now,
        source: 'jira.csv',
        note: n,
      },
    );

  it('groups field changes into one update per issue', () => {
    const plan = planUpdates(changes, SETTINGS);
    expect(plan.issues.map((i) => [i.key, i.fields])).toEqual([
      ['A-1', { customfield_10002: 8, customfield_20004: '2026-11-16' }],
      ['A-2', { customfield_20001: null }],
      ['B-1', { customfield_20002: { name: 'achen' }, customfield_20003: '2026-11-09' }],
    ]);
    expect(plan.ranks.map((r) => r.key)).toEqual(['U-1', 'B-1']);
    expect(plan.skipped).toEqual([]);
  });

  it('writes one line per issue that updates fields and then comments', () => {
    const lines = commandLines(script());
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line).toContain(`-H "Authorization: Bearer $JIRA_PAT"`);
      expect(line).toContain(`-H 'Content-Type: application/json'`);
    }
    const [update, comment] = lines[0]!.split(' && ');
    expect(update).toBe(
      `curl -sS --fail-with-body -X PUT 'https://jira.pncint.net/rest/api/2/issue/A-1' ` +
        `-H "Authorization: Bearer $JIRA_PAT" -H 'Content-Type: application/json' ` +
        `--data '{"fields":{"customfield_10002":8,"customfield_20004":"2026-11-16"}}' ` +
        `-w 'A-1 Story points: 5 to 8; Target end: 2026-11-13 to 2026-11-16 -> HTTP %{http_code}\\n'`,
    );
    expect(comment).toBe(
      `curl -sS -o /dev/null -X POST 'https://jira.pncint.net/rest/api/2/issue/A-1/comment' ` +
        `-H "Authorization: Bearer $JIRA_PAT" -H 'Content-Type: application/json' ` +
        `--data '${JSON.stringify({
          body: `${note}\n\n* Story points: 5 to 8\n* Target end: 2026-11-13 to 2026-11-16`,
        })}' -w 'A-1 comment added -> HTTP %{http_code}\\n'`,
    );
    expect(lines[1]).toContain(`--data '{"fields":{"customfield_20001":null}}'`);
    expect(lines[1]).toContain(String.raw`* SLA days: 2 to blank`);
    expect(lines[2]).toContain(
      String.raw`* Architect: Bob Martinez to Alice Chen\n* Target start: blank to 2026-11-09`,
    );
    expect(lines[3]).toContain(`'https://jira.pncint.net/rest/agile/1.0/issue/rank'`);
    expect(lines[3]).toContain(`--data '{"issues":["U-1"],"rankBeforeIssue":"A-1"}'`);
    expect(lines[3]).not.toContain('comment');
    expect(lines[4]).toContain(`--data '{"issues":["B-1"],"rankAfterIssue":"U-1"}'`);
  });

  it('leaves the comment out when there is no note', () => {
    const lines = commandLines(script(changes, {}, null));
    expect(lines.some((l) => l.includes('/comment'))).toBe(false);
    const blank = commandLines(script(changes, {}, '  '));
    expect(blank[0]).toContain(
      `{"body":"* Story points: 5 to 8\\n* Target end: 2026-11-13 to 2026-11-16"}`,
    );
  });

  it('builds the comment text and default note', () => {
    const points = { kind: 'storyPoints', key: 'A-1', from: 5, to: 8 } as const;
    expect(commentText(' Note \n', [points])).toBe('Note\n\n* Story points: 5 to 8');
    expect(defaultNote(new Date(2026, 9, 20))).toBe(
      'Based on a meeting on October 20, 2026, the following fields of this Jira issue changed:',
    );
  });

  it('starts with usage notes, the note and a check that the PAT is set', () => {
    const text = script();
    expect(text.split('\n')[0]).toBe('#!/bin/bash');
    expect(text).toContain('# Jira export: jira.csv');
    expect(text).toContain('# 3 issues to update and 2 rank moves, one curl line each.');
    expect(text).toContain(`# Comment note:\n#   ${note}`);
    expect(text).toContain("#   export JIRA_PAT='your-personal-access-token'");
    expect(text).toContain(
      ': "${JIRA_PAT:?Set JIRA_PAT to your Jira personal access token first}"',
    );
    expect(text.indexOf(': "${JIRA_PAT')).toBeLessThan(text.indexOf('\ncurl '));
  });

  it('sends select and text architect fields by name', () => {
    const one = [changes[3]!];
    expect(script(one, { architectFieldType: 'select' })).toContain(
      `{"fields":{"customfield_20002":{"value":"Alice Chen"}}}`,
    );
    expect(script(one, { architectFieldType: 'text' })).toContain(
      `{"fields":{"customfield_20002":"Alice Chen"}}`,
    );
  });

  it('leaves out changes it cannot send and says why', () => {
    const all: JiraChange[] = [
      ...changes,
      { kind: 'architect', key: 'Z-1', from: '', to: { id: 's2', name: 'Bo' } },
    ];
    const settings = {
      ...SETTINGS,
      slaDaysField: ' ',
      targetStartField: '',
      exportRankChanges: false,
    };
    const plan = planUpdates(all, settings);
    expect(plan.issues.map((i) => i.key)).toEqual(['A-1', 'B-1']);
    expect(plan.issues[1]!.changes.map((c) => c.kind)).toEqual(['architect']);
    expect(plan.skipped.map((s) => s.reason)).toEqual([
      'no field id for SLA days in Settings',
      'no field id for Target start in Settings',
      'rank changes are turned off in Settings',
      'rank changes are turned off in Settings',
      'no Jira username for Bo in Settings',
    ]);
    const text = buildJiraScript(plan, settings, { note });
    expect(text).toContain('#   A-2 SLA days: 2 to blank (no field id for SLA days in Settings)');
    expect(commandLines(text)[1]).not.toContain('Target start');
  });

  it('quotes values safely for the shell and curl', () => {
    const obrien = { id: 's3', name: "Pat O'Brien 100%" };
    const text = script([{ kind: 'architect', key: 'Q-1', from: '', to: obrien }], {
      architectFieldType: 'text',
    });
    expect(text).toContain(`--data '{"fields":{"customfield_20002":"Pat O'\\''Brien 100%"}}'`);
    expect(text).toContain(`-w 'Q-1 Architect: unassigned to Pat O'\\''Brien 100%% -> HTTP`);
    expect(shellQuote("it's")).toBe(`'it'\\''s'`);
  });

  it('normalizes the server address', () => {
    expect(normalizeBaseUrl(' jira.pncint.net/ ')).toBe('https://jira.pncint.net');
    expect(normalizeBaseUrl('http://jira.local:8080//')).toBe('http://jira.local:8080');
    expect(normalizeBaseUrl('')).toBe('');
  });

  it('targets jira.pncint.net by default', () => {
    expect(testSettings().jiraBaseUrl).toBe('https://jira.pncint.net');
  });
});

describe('older saved sessions', () => {
  it('get the Jira update defaults', () => {
    const state = coerceState({ staff: [], vacations: [], closures: [], items: [], settings: {} });
    expect(state.settings).toMatchObject({
      jiraBaseUrl: 'https://jira.pncint.net',
      architectFieldType: 'user',
      exportRankChanges: true,
      exportForecastArchitects: false,
      exportForecastDates: true,
      targetStartField: '',
      targetEndField: '',
    });
  });
});
