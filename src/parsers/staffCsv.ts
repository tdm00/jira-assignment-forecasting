import { normalizeEmployeeId, normalizeName } from '../core/scheduler';
import { findColumn, normalizeHeader, parseCsv } from './csv';
import { EMPLOYEE_ID_COLUMNS, NAME_COLUMNS, PERSON_COLUMNS } from './headers';

export interface ParsedStaff {
  name: string;
  employeeId: string;
}

export function parseStaffCsv(text: string): { people: ParsedStaff[]; skipped: number } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { people: [], skipped: 0 };
  const headers = rows[0]!.map(normalizeHeader);
  let col = findColumn(headers, PERSON_COLUMNS);
  if (col < 0) col = findColumn(headers, NAME_COLUMNS);
  const idCol = findColumn(headers, EMPLOYEE_ID_COLUMNS);
  const body = col >= 0 || idCol >= 0 ? rows.slice(1) : rows;
  const idx = Math.max(col, 0);
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const people: ParsedStaff[] = [];
  let skipped = 0;
  for (const row of body) {
    const name = (row[idx] ?? '').replace(/\s+/g, ' ').trim();
    const employeeId = idCol >= 0 ? (row[idCol] ?? '').trim() : '';
    const nameKey = normalizeName(name);
    const idKey = normalizeEmployeeId(employeeId);
    if (!name || seenNames.has(nameKey) || (idKey && seenIds.has(idKey))) {
      skipped++;
      continue;
    }
    seenNames.add(nameKey);
    if (idKey) seenIds.add(idKey);
    people.push({ name, employeeId });
  }
  return { people, skipped };
}
