import { findColumn, normalizeHeader, parseCsv } from './csv';
import { JIRA_COLUMNS, NAME_COLUMNS, PERSON_COLUMNS, START_COLUMNS } from './headers';

export type FileKind = 'jira' | 'staff' | 'vacation' | 'closure' | 'project' | 'unknown';

const has = (headers: string[], aliases: readonly string[]) =>
  findColumn(headers, [...aliases]) >= 0;

export function detectFromRows(rows: string[][]): FileKind {
  const first = rows[0];
  if (!first) return 'unknown';
  const headers = first.map(normalizeHeader);
  if (has(headers, JIRA_COLUMNS.key) && has(headers, JIRA_COLUMNS.summary)) return 'jira';
  const person = has(headers, PERSON_COLUMNS);
  const date = has(headers, START_COLUMNS);
  if (person && date) return 'vacation';
  if (date) return 'closure';
  if (person || has(headers, NAME_COLUMNS)) return 'staff';
  // A plain list of names, one per line, with no header.
  if (rows.every((r) => r.filter(Boolean).length === 1)) return 'staff';
  return 'unknown';
}

export function detectFileType(text: string, fileName = ''): FileKind {
  const trimmed = text.trimStart();
  if (fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('{')) return 'project';
  return detectFromRows(parseCsv(text));
}
