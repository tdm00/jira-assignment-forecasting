import type { Closure, IsoDate, Vacation } from './types';

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Dates are stored as UTC midnight so arithmetic never shifts with the local time zone. */
export function toUtc(date: IsoDate): number {
  const m = ISO_RE.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const d = new Date(toUtc(value));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(date: IsoDate): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function isWeekend(date: IsoDate): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b;
}

export function todayIso(now: Date = new Date()): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function expandRange(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Fast lookup of closures and per-person vacations. */
export class WorkCalendar {
  private readonly closed = new Map<IsoDate, string>();
  private readonly away = new Map<string, Set<IsoDate>>();

  constructor(closures: Closure[] = [], vacations: Vacation[] = []) {
    for (const c of closures) {
      for (const d of expandRange(c.start, c.end)) {
        if (!this.closed.has(d)) this.closed.set(d, c.name);
      }
    }
    for (const v of vacations) {
      let set = this.away.get(v.staffId);
      if (!set) {
        set = new Set();
        this.away.set(v.staffId, set);
      }
      for (const d of expandRange(v.start, v.end)) set.add(d);
    }
  }

  closureName(date: IsoDate): string | undefined {
    return this.closed.get(date);
  }

  isBusinessDay(date: IsoDate): boolean {
    return !isWeekend(date) && !this.closed.has(date);
  }

  isOnVacation(staffId: string | null, date: IsoDate): boolean {
    return staffId !== null && (this.away.get(staffId)?.has(date) ?? false);
  }

  isWorkingDay(date: IsoDate, staffId: string | null = null): boolean {
    return this.isBusinessDay(date) && !this.isOnVacation(staffId, date);
  }

  /** First working day on or after `date`. */
  nextWorkingDay(date: IsoDate, staffId: string | null = null): IsoDate {
    let d = date;
    // A safety cap prevents an infinite loop if someone is on vacation forever.
    for (let i = 0; i < 3660; i++) {
      if (this.isWorkingDay(d, staffId)) return d;
      d = addDays(d, 1);
    }
    return d;
  }

  /**
   * Returns the last day of a block of `days` working days that starts on the
   * first working day on or after `start`.
   */
  addWorkingDays(start: IsoDate, days: number, staffId: string | null = null): IsoDate {
    let d = this.nextWorkingDay(start, staffId);
    for (let remaining = Math.max(1, days) - 1; remaining > 0; remaining--) {
      d = this.nextWorkingDay(addDays(d, 1), staffId);
    }
    return d;
  }

  countWorkingDays(start: IsoDate, end: IsoDate, staffId: string | null = null): number {
    let n = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) if (this.isWorkingDay(d, staffId)) n++;
    return n;
  }
}
