import type { JiraItem } from './types';

/** Jira ranks are LexoRank strings: plain code-unit comparison gives the correct order. */
export function compareRank(a: JiraItem, b: JiraItem): number {
  if (a.rank && b.rank) {
    if (a.rank < b.rank) return -1;
    if (a.rank > b.rank) return 1;
  } else if (a.rank) {
    return -1;
  } else if (b.rank) {
    return 1;
  }
  return a.fileIndex - b.fileIndex;
}

export function sortByRank(items: JiraItem[]): JiraItem[] {
  return [...items].sort(compareRank);
}

/** Moves `activeKey` to the position currently held by `overKey`. */
export function moveItem(items: JiraItem[], activeKey: string, overKey: string): JiraItem[] {
  const from = items.findIndex((i) => i.key === activeKey);
  const to = items.findIndex((i) => i.key === overKey);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/**
 * Moves an item one step within the visible subset (for keyboard reordering
 * while filters hide some rows).
 */
export function moveWithinVisible(
  items: JiraItem[],
  visibleKeys: string[],
  key: string,
  delta: -1 | 1,
): JiraItem[] {
  const idx = visibleKeys.indexOf(key);
  const target = visibleKeys[idx + delta];
  if (idx < 0 || target === undefined) return items;
  return moveItem(items, key, target);
}
