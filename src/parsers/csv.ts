import Papa from 'papaparse';
import { isValidIsoDate } from '../core/calendar';
import type { IsoDate } from '../core/types';

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const res = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' });
  return res.data.map((row) => row.map((c) => (c ?? '').trim()));
}

/** Lower-cases, unwraps Jira's `Custom field (...)` and strips punctuation. */
export function normalizeHeader(h: string): string {
  let s = h.trim().toLowerCase();
  const m = /^custom field\s*\((.*)\)$/.exec(s);
  if (m) s = m[1]!;
  return s
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findColumn(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function build(y: number, m: number, d: number): IsoDate | null {
  if (y < 100) y += 2000;
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isValidIsoDate(iso) ? iso : null;
}

/**
 * Accepts `YYYY-MM-DD[ time]`, `M/D/YYYY`, `M/D/YY`, `DD/Mon/YY[ time]` and `DD-Mon-YY`.
 * Slash-separated numeric dates are read as US month/day.
 */
export function parseDate(value: string | undefined): IsoDate | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/-]([A-Za-z]{3})[A-Za-z]*[/-](\d{2,4})/.exec(v);
  if (m) {
    const month = MONTHS.indexOf(m[2]!.toLowerCase());
    return month < 0 ? null : build(Number(m[3]), month + 1, Number(m[1]));
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(v);
  if (m) return build(Number(m[3]), Number(m[1]), Number(m[2]));
  return null;
}

export function parseNumber(value: string | undefined): number | null {
  const v = (value ?? '').replace(/,/g, '').trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
