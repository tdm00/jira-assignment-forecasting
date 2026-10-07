import { WorkCalendar, addDays, maxDate } from './calendar';
import {
  AUTO_ASSIGN,
  type Closure,
  type FlagCode,
  type IsoDate,
  type JiraItem,
  type ScheduledItem,
  type Settings,
  type StaffMember,
  type Vacation,
} from './types';

export const UNASSIGNED = '(Unassigned)';

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function statusIn(status: string, list: string[]): boolean {
  const s = normalizeName(status);
  return list.some((x) => normalizeName(x) === s);
}

export function estimateDays(item: JiraItem, daysPerPoint: number): number | null {
  if (item.slaDays !== null && item.slaDays > 0) return Math.ceil(item.slaDays);
  if (item.storyPoints !== null && item.storyPoints > 0 && daysPerPoint > 0) {
    return Math.max(1, Math.ceil(item.storyPoints * daysPerPoint));
  }
  return null;
}

type Resolved =
  | { kind: 'staff'; staff: StaffMember }
  | { kind: 'unknown'; name: string }
  | { kind: 'auto' }
  | { kind: 'none' };

export function resolveArchitect(
  item: JiraItem,
  staff: StaffMember[],
  autoAssign: boolean,
): Resolved {
  if (item.architectOverride === AUTO_ASSIGN) return { kind: 'auto' };
  if (item.architectOverride) {
    const s = staff.find((x) => x.id === item.architectOverride);
    if (s) return { kind: 'staff', staff: s };
  }
  const name = item.architect.trim();
  if (!name) return autoAssign ? { kind: 'auto' } : { kind: 'none' };
  const key = normalizeName(name);
  const s = staff.find((x) => normalizeName(x.name) === key);
  return s ? { kind: 'staff', staff: s } : { kind: 'unknown', name };
}

export interface ScheduleInput {
  items: JiraItem[];
  staff: StaffMember[];
  vacations: Vacation[];
  closures: Closure[];
  settings: Settings;
}

/**
 * Forecasts start/end dates for every item. Items are worked in array order,
 * each architect works one item at a time, and only working days count.
 */
export function schedule(input: ScheduleInput): Map<string, ScheduledItem> {
  const { items, staff, vacations, closures, settings } = input;
  const cal = new WorkCalendar(closures, vacations);
  const forecastStart = settings.forecastStart;
  /** Next free calendar day for each capacity bucket (staff id or unknown name). */
  const free = new Map<string, IsoDate>();
  const result = new Map<string, ScheduledItem>();

  const capKey = (r: Resolved): string =>
    r.kind === 'staff' ? r.staff.id : r.kind === 'unknown' ? `?${normalizeName(r.name)}` : '';

  const earliestStart = (key: string, staffId: string | null, base: IsoDate): IsoDate => {
    const busy = free.get(key);
    return cal.nextWorkingDay(busy ? maxDate(base, busy) : base, staffId);
  };

  const inProgress: JiraItem[] = [];
  const planned: JiraItem[] = [];

  for (const item of items) {
    const resolved = resolveArchitect(item, staff, settings.autoAssign);
    if (statusIn(item.status, settings.doneStatuses)) {
      const start = item.startDate ?? item.endDate;
      const end = item.endDate ?? item.startDate;
      const staffId = resolved.kind === 'staff' ? resolved.staff.id : null;
      result.set(item.key, {
        key: item.key,
        architect:
          resolved.kind === 'staff'
            ? resolved.staff.name
            : resolved.kind === 'unknown'
              ? resolved.name
              : UNASSIGNED,
        staffId,
        suggested: false,
        state: 'done',
        start,
        end,
        workingDays: start && end && start <= end ? cal.countWorkingDays(start, end, staffId) : 0,
        flags: [],
      });
    } else if (statusIn(item.status, settings.inProgressStatuses)) {
      inProgress.push(item);
    } else {
      planned.push(item);
    }
  }

  const place = (item: JiraItem, isInProgress: boolean) => {
    const flags: FlagCode[] = [];
    let resolved = resolveArchitect(item, staff, settings.autoAssign);
    const days = estimateDays(item, settings.daysPerPoint);
    const base = isInProgress ? (item.startDate ?? forecastStart) : forecastStart;
    let suggested = false;

    if (resolved.kind === 'auto') {
      let best: { staff: StaffMember; start: IsoDate } | null = null;
      for (const s of staff) {
        const start = earliestStart(s.id, s.id, base);
        if (!best || start < best.start) best = { staff: s, start };
      }
      if (best) {
        resolved = { kind: 'staff', staff: best.staff };
        suggested = true;
      } else {
        resolved = { kind: 'none' };
      }
    }

    if (resolved.kind === 'unknown') flags.push('unknown-architect');
    if (resolved.kind === 'none') flags.push('no-architect');
    if (days === null) flags.push('no-estimate');

    const architect =
      resolved.kind === 'staff'
        ? resolved.staff.name
        : resolved.kind === 'unknown'
          ? resolved.name
          : UNASSIGNED;
    const staffId = resolved.kind === 'staff' ? resolved.staff.id : null;

    if (resolved.kind === 'none' || days === null) {
      result.set(item.key, {
        key: item.key,
        architect,
        staffId,
        suggested,
        state: 'unscheduled',
        start: null,
        end: null,
        workingDays: 0,
        flags,
      });
      return;
    }

    const key = capKey(resolved);
    const start = earliestStart(key, staffId, base);
    let end = cal.addWorkingDays(start, days, staffId);
    if (isInProgress && end < forecastStart) end = cal.nextWorkingDay(forecastStart, staffId);
    free.set(key, maxDate(forecastStart, addDays(end, 1)));

    if (item.endDate && end > item.endDate) flags.push('late');

    result.set(item.key, {
      key: item.key,
      architect,
      staffId,
      suggested,
      state: isInProgress ? 'in-progress' : 'planned',
      start,
      end,
      workingDays: cal.countWorkingDays(start, end, staffId),
      flags,
    });
  };

  for (const item of inProgress) place(item, true);
  for (const item of planned) place(item, false);

  return result;
}

export interface ArchitectSummary {
  architect: string;
  staffId: string | null;
  items: number;
  workingDays: number;
  finish: IsoDate | null;
}

export interface ForecastSummary {
  totalItems: number;
  openItems: number;
  totalPoints: number;
  openPoints: number;
  finish: IsoDate | null;
  lateCount: number;
  flaggedCount: number;
  byArchitect: ArchitectSummary[];
}

export function summarize(
  items: JiraItem[],
  scheduled: Map<string, ScheduledItem>,
  staff: StaffMember[],
): ForecastSummary {
  const by = new Map<string, ArchitectSummary>();
  for (const s of staff) {
    by.set(s.name, { architect: s.name, staffId: s.id, items: 0, workingDays: 0, finish: null });
  }
  let totalPoints = 0;
  let openPoints = 0;
  let openItems = 0;
  let finish: IsoDate | null = null;
  let lateCount = 0;
  let flaggedCount = 0;

  for (const item of items) {
    const s = scheduled.get(item.key);
    const sp = item.storyPoints ?? 0;
    totalPoints += sp;
    if (!s) continue;
    if (s.flags.includes('late')) lateCount++;
    if (s.flags.length > 0) flaggedCount++;
    if (s.state === 'done') continue;
    openItems++;
    openPoints += sp;
    if (s.end && (!finish || s.end > finish)) finish = s.end;
    if (s.state === 'unscheduled') continue;
    let row = by.get(s.architect);
    if (!row) {
      row = { architect: s.architect, staffId: s.staffId, items: 0, workingDays: 0, finish: null };
      by.set(s.architect, row);
    }
    row.items++;
    row.workingDays += s.workingDays;
    if (s.end && (!row.finish || s.end > row.finish)) row.finish = s.end;
  }

  return {
    totalItems: items.length,
    openItems,
    totalPoints,
    openPoints,
    finish,
    lateCount,
    flaggedCount,
    byArchitect: [...by.values()],
  };
}
