import { normalizeName } from '../core/scheduler';
import { findColumn, normalizeHeader, parseCsv } from './csv';
import { NAME_COLUMNS, PERSON_COLUMNS } from './headers';

export function parseStaffCsv(text: string): { names: string[]; skipped: number } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { names: [], skipped: 0 };
  const headers = rows[0]!.map(normalizeHeader);
  let col = findColumn(headers, PERSON_COLUMNS);
  if (col < 0) col = findColumn(headers, NAME_COLUMNS);
  const body = col >= 0 ? rows.slice(1) : rows;
  const idx = Math.max(col, 0);
  const seen = new Set<string>();
  const names: string[] = [];
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
  }
  return { names, skipped };
}
