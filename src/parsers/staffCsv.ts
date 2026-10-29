import { normalizeName } from '../core/scheduler';
import { findColumn, normalizeHeader, parseCsv } from './csv';
import { NAME_COLUMNS, PERSON_COLUMNS, USERNAME_COLUMNS } from './headers';

export function parseStaffCsv(text: string): {
  names: string[];
  usernames: string[];
  skipped: number;
} {
  const rows = parseCsv(text);
  if (rows.length === 0) return { names: [], usernames: [], skipped: 0 };
  const headers = rows[0]!.map(normalizeHeader);
  let col = findColumn(headers, PERSON_COLUMNS);
  if (col < 0) col = findColumn(headers, NAME_COLUMNS);
  const body = col >= 0 ? rows.slice(1) : rows;
  const idx = Math.max(col, 0);
  const userCol = findColumn(headers, USERNAME_COLUMNS);
  const usernameIdx = col >= 0 && userCol >= 0 && userCol !== idx ? userCol : -1;
  const seen = new Set<string>();
  const names: string[] = [];
  const usernames: string[] = [];
  let skipped = 0;
  for (const row of body) {
    const name = (row[idx] ?? '').replace(/\s+/g, ' ').trim();
    const key = normalizeName(name);
    if (!name || seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    names.push(name);
    usernames.push(usernameIdx >= 0 ? (row[usernameIdx] ?? '').replace(/\s+/g, ' ').trim() : '');
  }
  return { names, usernames, skipped };
}
