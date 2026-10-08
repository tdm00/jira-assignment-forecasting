import type { IsoDate, PoolRole } from '../core/types';
import { findColumn, normalizeHeader, parseCsv, parseDate } from './csv';
import {
  AVAILABLE_FROM_COLUMNS,
  CREW_COLUMNS,
  NAME_COLUMNS,
  PERSON_COLUMNS,
  ROLE_COLUMNS,
} from './headers';

export interface ParsedCrewAssignment {
  crew: string;
  staffName: string;
  role: PoolRole;
  availableFrom?: IsoDate;
}

const ROLE_WORDS: Record<string, PoolRole> = {
  primary: 1,
  lead: 1,
  main: 1,
  secondary: 2,
  backup: 2,
  'backup 1': 2,
  'backup 2': 3,
  tertiary: 3,
};

export function parseRole(value: string | undefined): PoolRole | null {
  const v = (value ?? '').trim().toLowerCase();
  if (v === '1' || v === '2' || v === '3') return Number(v) as PoolRole;
  return ROLE_WORDS[v] ?? null;
}

export function parseCrewCsv(text: string): {
  assignments: ParsedCrewAssignment[];
  skipped: number;
} {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map(normalizeHeader);
  let personCol = findColumn(headers, PERSON_COLUMNS);
  if (personCol < 0) personCol = findColumn(headers, NAME_COLUMNS);
  const crewCol = findColumn(headers, CREW_COLUMNS);
  const roleCol = findColumn(headers, ROLE_COLUMNS);
  const fromCol = findColumn(headers, AVAILABLE_FROM_COLUMNS);
  if (personCol < 0 || crewCol < 0 || roleCol < 0) {
    throw new Error('Crew CSV needs Crew, Architect and Role columns');
  }
  const assignments: ParsedCrewAssignment[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const crew = (row[crewCol] ?? '').trim();
    const staffName = (row[personCol] ?? '').trim();
    const role = parseRole(row[roleCol]);
    if (!crew || !staffName || !role) {
      skipped++;
      continue;
    }
    const availableFrom = fromCol >= 0 ? parseDate(row[fromCol]) : null;
    assignments.push({ crew, staffName, role, ...(availableFrom ? { availableFrom } : {}) });
  }
  return { assignments, skipped };
}
