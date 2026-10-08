import { diffDays } from './calendar';
import { NO_CREW } from './filters';
import { crewKey } from './scheduler';
import type { CrewAssignment, IsoDate, JiraItem, PoolRole, ScheduledItem } from './types';

export interface CrewChip {
  /** Normalized crew name; the empty string is "no crew". */
  key: string;
  name: string;
  role?: PoolRole;
  /** Open items the architect works for this crew in the team-wide plan. */
  items: number;
  points: number;
}

/**
 * Crews an architect supports: the crews in their pool assignments plus every
 * crew whose items the team-wide plan gives them.
 */
export function crewsForArchitect(
  items: JiraItem[],
  full: Map<string, ScheduledItem>,
  assignments: CrewAssignment[],
  staffId: string,
): CrewChip[] {
  const chips = new Map<string, CrewChip>();
  const ensure = (name: string): CrewChip => {
    const key = crewKey(name);
    let chip = chips.get(key);
    if (!chip) {
      chip = { key, name: key ? name.trim() : NO_CREW, items: 0, points: 0 };
      chips.set(key, chip);
    }
    return chip;
  };
  for (const a of assignments) {
    if (a.staffId !== staffId) continue;
    const chip = ensure(a.crew);
    chip.role = chip.role && chip.role < a.role ? chip.role : a.role;
  }
  for (const item of items) {
    const s = full.get(item.key);
    if (!s || s.staffId !== staffId || s.state === 'done') continue;
    const chip = ensure(item.crew);
    chip.items++;
    chip.points += item.storyPoints ?? 0;
  }
  return [...chips.values()].sort(
    (a, b) => (a.role ?? 9) - (b.role ?? 9) || b.items - a.items || a.name.localeCompare(b.name),
  );
}

/** Items present in a scheduled map, in plan order. */
export function itemsInSchedule(
  items: JiraItem[],
  scheduled: Map<string, ScheduledItem>,
): JiraItem[] {
  return items.filter((i) => scheduled.has(i.key));
}

/** The architect's items from the team-wide plan, limited to the chosen crews. */
export function itemsForArchitectCrews(
  items: JiraItem[],
  full: Map<string, ScheduledItem>,
  staffId: string,
  crews: string[],
): JiraItem[] {
  const keys = new Set(crews.map(crewKey));
  return items.filter((i) => full.get(i.key)?.staffId === staffId && keys.has(crewKey(i.crew)));
}

export interface CrewStat {
  key: string;
  name: string;
  items: number;
  points: number;
  finish: IsoDate | null;
}

/** Open item counts, story points and finish date per crew, in order of first appearance. */
export function crewStats(items: JiraItem[], scheduled: Map<string, ScheduledItem>): CrewStat[] {
  const out = new Map<string, CrewStat>();
  for (const item of items) {
    const s = scheduled.get(item.key);
    if (!s || s.state === 'done') continue;
    const key = crewKey(item.crew);
    let row = out.get(key);
    if (!row) {
      row = { key, name: key ? item.crew.trim() : NO_CREW, items: 0, points: 0, finish: null };
      out.set(key, row);
    }
    row.items++;
    row.points += item.storyPoints ?? 0;
    if (s.end && (!row.finish || s.end > row.finish)) row.finish = s.end;
  }
  return [...out.values()];
}

/** Stable group-by-crew ordering: crews appear in the order of their top-ranked item. */
export function groupByCrew(items: JiraItem[]): JiraItem[] {
  const order: string[] = [];
  const groups = new Map<string, JiraItem[]>();
  for (const item of items) {
    const key = crewKey(item.crew);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }
  return order.flatMap((k) => groups.get(k)!);
}

export interface SelectionChange {
  description: string;
  crews: { name: string; days: number }[];
  combined: number | null;
}

function joinNames(names: string[]): string {
  return names.length <= 2
    ? names.join(' and ')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** How changing the crew selection moved each remaining crew's finish and the combined finish. */
export function compareSelections(
  before: CrewStat[],
  after: CrewStat[],
  prevKeys: string[],
  nextKeys: string[],
  nameOf: (key: string) => string,
): SelectionChange {
  const added = nextKeys.filter((k) => !prevKeys.includes(k)).map(nameOf);
  const removed = prevKeys.filter((k) => !nextKeys.includes(k)).map(nameOf);
  const parts: string[] = [];
  if (added.length) parts.push(`Adding ${joinNames(added)}`);
  if (removed.length) parts.push(`Removing ${joinNames(removed)}`);
  const crews = after.flatMap((a) => {
    const b = before.find((x) => x.key === a.key);
    return b?.finish && a.finish ? [{ name: a.name, days: diffDays(b.finish, a.finish) }] : [];
  });
  const latest = (rows: CrewStat[]) =>
    rows.reduce<IsoDate | null>((m, r) => (r.finish && (!m || r.finish > m) ? r.finish : m), null);
  const [fb, fa] = [latest(before), latest(after)];
  return {
    description: parts.join(' and ') || 'Crew selection changed',
    crews,
    combined: fb && fa ? diffDays(fb, fa) : null,
  };
}
