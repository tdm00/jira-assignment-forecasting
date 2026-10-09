import { UNASSIGNED } from './scheduler';
import type { Filters, JiraItem, ScheduledItem } from './types';

export const NO_CREW = '(No crew)';

export const NO_STATUS = '(No status)';

export const emptyFilters: Filters = { search: '', architects: [], crews: [], statuses: [] };

export function statusOf(item: JiraItem): string {
  return item.status.trim() || NO_STATUS;
}

/** Distinct statuses, sorted, treating spellings that differ only in case as one. */
export function statusOptions(items: JiraItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    const status = statusOf(item);
    const key = status.toLowerCase();
    if (!seen.has(key)) seen.set(key, status);
  }
  return distinctSorted(seen.values());
}

export function crewOf(item: JiraItem): string {
  return item.crew.trim() || NO_CREW;
}

export function architectOf(item: JiraItem, scheduled?: ScheduledItem): string {
  return scheduled?.architect ?? (item.architect.trim() || UNASSIGNED);
}

export function isFiltered(f: Filters): boolean {
  return (
    f.search.trim() !== '' || f.architects.length > 0 || f.crews.length > 0 || f.statuses.length > 0
  );
}

export function applyFilters(
  items: JiraItem[],
  scheduled: Map<string, ScheduledItem>,
  f: Filters,
): JiraItem[] {
  const q = f.search.trim().toLowerCase();
  const archs = new Set(f.architects);
  const crews = new Set(f.crews);
  const statuses = new Set(f.statuses.map((s) => s.toLowerCase()));
  return items.filter((item) => {
    if (q && !item.summary.toLowerCase().includes(q) && !item.key.toLowerCase().includes(q)) {
      return false;
    }
    if (archs.size && !archs.has(architectOf(item, scheduled.get(item.key)))) return false;
    if (crews.size && !crews.has(crewOf(item))) return false;
    if (statuses.size && !statuses.has(statusOf(item).toLowerCase())) return false;
    return true;
  });
}

export function distinctSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
