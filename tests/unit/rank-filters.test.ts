import { describe, expect, it } from 'vitest';
import {
  NO_CREW,
  applyFilters,
  architectOf,
  distinctSorted,
  emptyFilters,
  isFiltered,
} from '../../src/core/filters';
import { moveItem, moveWithinVisible, sortByRank } from '../../src/core/rank';
import { UNASSIGNED } from '../../src/core/scheduler';
import type { ScheduledItem } from '../../src/core/types';
import { item } from '../helpers';

const keys = (xs: { key: string }[]) => xs.map((x) => x.key);

describe('rank helpers', () => {
  const a = item({ key: 'a', rank: '0|b' });
  const b = item({ key: 'b', rank: '0|a' });
  const c = item({ key: 'c', rank: '' });

  it('sorts by rank', () => {
    expect(keys(sortByRank([a, c, b]))).toEqual(['b', 'a', 'c']);
  });

  it('moves an item to another item’s position (REQ-GRID-007)', () => {
    expect(keys(moveItem([a, b, c], 'c', 'a'))).toEqual(['c', 'a', 'b']);
    expect(keys(moveItem([a, b, c], 'a', 'c'))).toEqual(['b', 'c', 'a']);
    const same = [a, b, c];
    expect(moveItem(same, 'a', 'a')).toBe(same);
    expect(moveItem(same, 'x', 'a')).toBe(same);
  });

  it('moves within the visible subset (REQ-GRID-008, REQ-GRID-011)', () => {
    const d = item({ key: 'd' });
    const all = [a, b, c, d];
    expect(keys(moveWithinVisible(all, ['a', 'c', 'd'], 'c', -1))).toEqual(['c', 'a', 'b', 'd']);
    expect(keys(moveWithinVisible(all, ['a', 'c', 'd'], 'c', 1))).toEqual(['a', 'b', 'd', 'c']);
    expect(moveWithinVisible(all, ['a', 'c'], 'a', -1)).toBe(all);
  });
});

describe('filters', () => {
  const items = [
    item({ key: 'PAY-1', summary: 'Payments gateway', crew: 'Phoenix', architect: 'Alice' }),
    item({ key: 'ID-2', summary: 'Identity SSO', crew: 'Atlas', architect: 'Bob' }),
    item({ key: 'LED-3', summary: 'Ledger payments batch', crew: '', architect: '' }),
  ];
  const scheduled = new Map<string, ScheduledItem>([
    [
      'LED-3',
      {
        key: 'LED-3',
        architect: 'Bob',
        staffId: 'b',
        suggested: true,
        assignedVia: 'auto',
        state: 'planned',
        start: null,
        end: null,
        workingDays: 0,
        flags: [],
      },
    ],
  ]);

  it('searches summary and key case-insensitively (REQ-GRID-002)', () => {
    expect(keys(applyFilters(items, scheduled, { ...emptyFilters, search: 'PAYMENTS' }))).toEqual([
      'PAY-1',
      'LED-3',
    ]);
    expect(keys(applyFilters(items, scheduled, { ...emptyFilters, search: 'id-2' }))).toEqual([
      'ID-2',
    ]);
  });

  it('filters by one or more architects using the forecast architect (REQ-GRID-003)', () => {
    expect(keys(applyFilters(items, scheduled, { ...emptyFilters, architects: ['Bob'] }))).toEqual([
      'ID-2',
      'LED-3',
    ]);
    expect(
      keys(applyFilters(items, scheduled, { ...emptyFilters, architects: ['Alice', 'Bob'] })),
    ).toHaveLength(3);
  });

  it('filters by one or more crews (REQ-GRID-004)', () => {
    expect(
      keys(applyFilters(items, scheduled, { ...emptyFilters, crews: ['Atlas', NO_CREW] })),
    ).toEqual(['ID-2', 'LED-3']);
  });

  it('combines filters with AND (REQ-GRID-005)', () => {
    expect(
      keys(applyFilters(items, scheduled, { search: 'payments', architects: ['Bob'], crews: [] })),
    ).toEqual(['LED-3']);
  });

  it('reports whether filters are active', () => {
    expect(isFiltered(emptyFilters)).toBe(false);
    expect(isFiltered({ ...emptyFilters, search: ' x ' })).toBe(true);
    expect(isFiltered({ ...emptyFilters, crews: ['A'] })).toBe(true);
  });

  it('labels unassigned items and sorts distinct values', () => {
    expect(architectOf(items[2]!)).toBe(UNASSIGNED);
    expect(distinctSorted(['b', 'a', 'b'])).toEqual(['a', 'b']);
  });
});
