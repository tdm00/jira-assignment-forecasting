import { describe, expect, it } from 'vitest';
import { jiraChanges, rankMoves, type JiraChange } from '../../src/core/jiraChanges';
import { moveItem } from '../../src/core/rank';
import { schedule } from '../../src/core/scheduler';
import { AUTO_ASSIGN } from '../../src/core/types';
import { parseJiraCsv } from '../../src/parsers/jiraCsv';
import {
  buildJiraScript,
  normalizeBaseUrl,
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

function changesFor(state = testState()) {
  return jiraChanges({
    items: state.items,
    staff: state.staff,
    scheduled: schedule(state),
    settings: state.settings,
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

  it('stores Jira usernames on staff', () => {
    let state = reducer(testState(), { type: 'addStaff', names: ['Alice Chen'] });
    const id = state.staff[0]!.id;
    state = reducer(state, { type: 'setStaffUsername', id, username: ' achen ' });
    expect(state.staff[0]!.jiraUsername).toBe('achen');
    state = reducer(state, { type: 'setStaffUsername', id, username: '' });
    expect(state.staff[0]).not.toHaveProperty('jiraUsername');
  });
});

describe('curl script (REQ-JIRA-005 to REQ-JIRA-009)', () => {
  const alice = { id: 's1', name: 'Alice Chen', jiraUsername: 'achen' };
  const changes: JiraChange[] = [
    { kind: 'storyPoints', key: 'A-1', from: 5, to: 8 },
    { kind: 'slaDays', key: 'A-2', from: 2, to: null },
    { kind: 'architect', key: 'B-1', from: 'Bob Martinez', to: alice },
    { kind: 'rank', key: 'U-1', before: 'A-1' },
    { kind: 'rank', key: 'B-1', after: 'U-1' },
  ];
  const now = new Date('2026-10-18T12:00:00Z');
  const commandLines = (text: string) => text.split('\n').filter((l) => l.startsWith('curl '));

  it('writes one curl command per change using the PAT variable', () => {
    const script = buildJiraScript(changes, SETTINGS, { now, source: 'jira.csv' });
    expect(script.commands).toBe(5);
    expect(script.skipped).toEqual([]);
    const lines = commandLines(script.text);
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line).toContain(`-H "Authorization: Bearer $JIRA_PAT"`);
      expect(line).toContain(`-H 'Content-Type: application/json'`);
    }
    expect(lines[0]).toBe(
      `curl -sS -X PUT 'https://jira.pncint.net/rest/api/2/issue/A-1' ` +
        `-H "Authorization: Bearer $JIRA_PAT" -H 'Content-Type: application/json' ` +
        `--data '{"fields":{"customfield_10002":8}}' ` +
        `-w 'A-1 story points 5 to 8 -> HTTP %{http_code}\\n'`,
    );
    expect(lines[1]).toContain(`--data '{"fields":{"customfield_20001":null}}'`);
    expect(lines[2]).toContain(`--data '{"fields":{"customfield_20002":{"name":"achen"}}}'`);
    expect(lines[3]).toContain(`'https://jira.pncint.net/rest/agile/1.0/issue/rank'`);
    expect(lines[3]).toContain(`--data '{"issues":["U-1"],"rankBeforeIssue":"A-1"}'`);
    expect(lines[4]).toContain(`--data '{"issues":["B-1"],"rankAfterIssue":"U-1"}'`);
  });

  it('starts with usage notes and a check that the PAT is set', () => {
    const { text } = buildJiraScript(changes, SETTINGS, { now, source: 'jira.csv' });
    const lines = text.split('\n');
    expect(lines[0]).toBe('#!/bin/bash');
    expect(text).toContain('# Jira export: jira.csv');
    expect(text).toContain("#   export JIRA_PAT='your-personal-access-token'");
    expect(text).toContain(
      ': "${JIRA_PAT:?Set JIRA_PAT to your Jira personal access token first}"',
    );
    expect(text.indexOf(': "${JIRA_PAT')).toBeLessThan(text.indexOf('\ncurl '));
  });

  it('sends select and text architect fields by name', () => {
    const one = [changes[2]!];
    const select = buildJiraScript(one, { ...SETTINGS, architectFieldType: 'select' });
    expect(select.text).toContain(`{"fields":{"customfield_20002":{"value":"Alice Chen"}}}`);
    const text = buildJiraScript(one, { ...SETTINGS, architectFieldType: 'text' });
    expect(text.text).toContain(`{"fields":{"customfield_20002":"Alice Chen"}}`);
  });

  it('leaves out changes it cannot send and says why', () => {
    const script = buildJiraScript(
      [...changes, { kind: 'architect', key: 'Z-1', from: '', to: { id: 's2', name: 'Bo' } }],
      { ...SETTINGS, slaDaysField: ' ', exportRankChanges: false },
    );
    expect(script.commands).toBe(2);
    expect(script.skipped.map((s) => s.reason)).toEqual([
      'no SLA days field id in Settings',
      'rank changes are turned off in Settings',
      'rank changes are turned off in Settings',
      'no Jira username for Bo in Settings',
    ]);
    expect(script.text).toContain('#   A-2 SLA days 2 to blank: no SLA days field id in Settings');
  });

  it('quotes values safely for the shell and curl', () => {
    const obrien = { id: 's3', name: "Pat O'Brien 100%" };
    const { text } = buildJiraScript([{ kind: 'architect', key: 'Q-1', from: '', to: obrien }], {
      ...SETTINGS,
      architectFieldType: 'text',
    });
    expect(text).toContain(`--data '{"fields":{"customfield_20002":"Pat O'\\''Brien 100%"}}'`);
    expect(text).toContain(`-w 'Q-1 architect unassigned to Pat O'\\''Brien 100%% -> HTTP`);
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
    });
  });
});
