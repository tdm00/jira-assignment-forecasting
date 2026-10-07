import { sortByRank } from '../core/rank';
import type { JiraItem } from '../core/types';
import { findColumn, normalizeHeader, parseCsv, parseDate, parseNumber } from './csv';
import { JIRA_COLUMNS } from './headers';

export interface JiraParseResult {
  items: JiraItem[];
  skipped: number;
  missingColumns: string[];
}

type Field = keyof typeof JIRA_COLUMNS;

export function parseJiraCsv(text: string): JiraParseResult {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map(normalizeHeader);
  const col = {} as Record<Field, number>;
  const missingColumns: string[] = [];
  for (const field of Object.keys(JIRA_COLUMNS) as Field[]) {
    col[field] = findColumn(headers, [...JIRA_COLUMNS[field]]);
    if (col[field] < 0) missingColumns.push(field);
  }
  if (col.key < 0) throw new Error('Jira CSV must contain an "Issue key" column');

  const get = (row: string[], field: Field) => (col[field] >= 0 ? (row[col[field]] ?? '') : '');
  const seen = new Set<string>();
  const items: JiraItem[] = [];
  let skipped = 0;

  rows.slice(1).forEach((row, i) => {
    const key = get(row, 'key');
    if (!key || seen.has(key)) {
      skipped++;
      return;
    }
    seen.add(key);
    const sp = parseNumber(get(row, 'storyPoints'));
    const sla = parseNumber(get(row, 'slaDays'));
    items.push({
      key,
      summary: get(row, 'summary'),
      crew: get(row, 'crew'),
      architect: get(row, 'architect'),
      architectOverride: null,
      status: get(row, 'status'),
      storyPoints: sp !== null && sp >= 0 ? sp : null,
      slaDays: sla !== null && sla >= 0 ? sla : null,
      startDate: parseDate(get(row, 'startDate')),
      endDate: parseDate(get(row, 'endDate')),
      rank: get(row, 'rank'),
      fileIndex: i,
    });
  });

  return { items: sortByRank(items), skipped, missingColumns };
}
