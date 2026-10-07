import type { IsoDate } from '../core/types';
import { findColumn, normalizeHeader, parseCsv, parseDate } from './csv';
import {
  CLOSURE_NAME_COLUMNS,
  END_COLUMNS,
  NAME_COLUMNS,
  NOTE_COLUMNS,
  PERSON_COLUMNS,
  START_COLUMNS,
} from './headers';

export interface ParsedRange {
  start: IsoDate;
  end: IsoDate;
}

export interface ParsedVacation extends ParsedRange {
  staffName: string;
  note: string;
}

export interface ParsedClosure extends ParsedRange {
  name: string;
}

function readRange(row: string[], startCol: number, endCol: number): ParsedRange | null {
  const start = parseDate(row[startCol]);
  if (!start) return null;
  const end = endCol >= 0 ? (parseDate(row[endCol]) ?? start) : start;
  if (end < start) return null;
  return { start, end };
}

export function parseVacationCsv(text: string): { vacations: ParsedVacation[]; skipped: number } {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map(normalizeHeader);
  let personCol = findColumn(headers, PERSON_COLUMNS);
  if (personCol < 0) personCol = findColumn(headers, NAME_COLUMNS);
  const startCol = findColumn(headers, START_COLUMNS);
  const endCol = findColumn(headers, END_COLUMNS);
  const noteCol = findColumn(headers, NOTE_COLUMNS);
  if (personCol < 0 || startCol < 0) {
    throw new Error('Vacation CSV needs a staff column and a start date column');
  }
  const vacations: ParsedVacation[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const staffName = (row[personCol] ?? '').trim();
    const range = readRange(row, startCol, endCol);
    if (!staffName || !range) {
      skipped++;
      continue;
    }
    vacations.push({ staffName, note: noteCol >= 0 ? (row[noteCol] ?? '') : '', ...range });
  }
  return { vacations, skipped };
}

export function parseClosureCsv(text: string): { closures: ParsedClosure[]; skipped: number } {
  const rows = parseCsv(text);
  const headers = (rows[0] ?? []).map(normalizeHeader);
  const startCol = findColumn(headers, START_COLUMNS);
  const endCol = findColumn(headers, END_COLUMNS);
  const nameCol = findColumn(headers, CLOSURE_NAME_COLUMNS);
  if (startCol < 0) throw new Error('Closure CSV needs a date column');
  const closures: ParsedClosure[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const range = readRange(row, startCol, endCol);
    if (!range) {
      skipped++;
      continue;
    }
    closures.push({ name: (nameCol >= 0 ? row[nameCol] : '') || 'Closed', ...range });
  }
  return { closures, skipped };
}
