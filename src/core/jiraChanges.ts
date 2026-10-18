import { sortByRank } from './rank';
import { normalizeName } from './scheduler';
import {
  AUTO_ASSIGN,
  type IsoDate,
  type JiraItem,
  type ScheduledItem,
  type Settings,
  type StaffMember,
} from './types';

export type RankChange = { kind: 'rank'; key: string; after?: string; before?: string };

export type FieldChange =
  | { kind: 'storyPoints' | 'slaDays'; key: string; from: number | null; to: number | null }
  | { kind: 'architect'; key: string; from: string; to: StaffMember }
  | { kind: 'targetStart' | 'targetEnd'; key: string; from: IsoDate | null; to: IsoDate };

export type JiraChange = FieldChange | RankChange;

export interface ChangeInput {
  items: JiraItem[];
  staff: StaffMember[];
  scheduled: Map<string, ScheduledItem>;
  settings: Pick<Settings, 'exportForecastArchitects' | 'exportForecastDates'>;
}

function targetArchitect(
  item: JiraItem,
  s: ScheduledItem | undefined,
  staff: StaffMember[],
  forecast: boolean,
): StaffMember | undefined {
  const override = item.architectOverride;
  if (override && override !== AUTO_ASSIGN) return staff.find((m) => m.id === override);
  if (override === AUTO_ASSIGN || forecast) {
    if (!s?.staffId || s.state === 'done') return undefined;
    return staff.find((m) => m.id === s.staffId);
  }
  return undefined;
}

/** Indexes (into `seq`) of one longest strictly increasing subsequence. */
function longestIncreasing(seq: number[]): Set<number> {
  const tails: number[] = [];
  const prev = new Array<number>(seq.length).fill(-1);
  seq.forEach((v, i) => {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (seq[tails[mid]!]! < v) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1]!;
    tails[lo] = i;
  });
  const keep = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1]! : -1; i >= 0; i = prev[i]!) keep.add(i);
  return keep;
}

/**
 * The fewest single-issue rank moves that turn Jira rank order into plan order.
 * Items on a longest common ordering stay put; each other item, taken in plan
 * order, is ranked right after its new predecessor (or before the first
 * unmoved item when it is now first), so the moves must run in sequence.
 */
export function rankMoves(items: JiraItem[]): RankChange[] {
  const original = new Map(sortByRank(items).map((item, idx) => [item.key, idx]));
  const stable = longestIncreasing(items.map((i) => original.get(i.key)!));
  const firstStable = items.find((_, idx) => stable.has(idx))?.key;
  const moves: RankChange[] = [];
  items.forEach((item, idx) => {
    if (stable.has(idx)) return;
    moves.push(
      idx === 0
        ? { kind: 'rank', key: item.key, before: firstStable }
        : { kind: 'rank', key: item.key, after: items[idx - 1]!.key },
    );
  });
  return moves;
}

/**
 * Edits made in the app that differ from the imported Jira data, plus forecast
 * dates that differ from Jira's start and end. Field changes come first in plan order.
 */
export function jiraChanges({ items, staff, scheduled, settings }: ChangeInput): JiraChange[] {
  const changes: JiraChange[] = [];
  for (const item of items) {
    if (item.jira) {
      if (item.storyPoints !== item.jira.storyPoints) {
        changes.push({
          kind: 'storyPoints',
          key: item.key,
          from: item.jira.storyPoints,
          to: item.storyPoints,
        });
      }
      if (item.slaDays !== item.jira.slaDays) {
        changes.push({ kind: 'slaDays', key: item.key, from: item.jira.slaDays, to: item.slaDays });
      }
    }
    const s = scheduled.get(item.key);
    const to = targetArchitect(item, s, staff, settings.exportForecastArchitects);
    if (to && normalizeName(to.name) !== normalizeName(item.architect)) {
      changes.push({ kind: 'architect', key: item.key, from: item.architect.trim(), to });
    }
    const open = s?.state === 'planned' || s?.state === 'in-progress';
    if (settings.exportForecastDates && open && s.start && s.end) {
      if (s.start !== item.startDate) {
        changes.push({ kind: 'targetStart', key: item.key, from: item.startDate, to: s.start });
      }
      if (s.end !== item.endDate) {
        changes.push({ kind: 'targetEnd', key: item.key, from: item.endDate, to: s.end });
      }
    }
  }
  return [...changes, ...rankMoves(items)];
}
