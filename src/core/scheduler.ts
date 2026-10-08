import { WorkCalendar, addDays, maxDate } from './calendar';
import {
  AUTO_ASSIGN,
  type AssignedVia,
  type Closure,
  type CrewAssignment,
  type FlagCode,
  type IsoDate,
  type JiraItem,
  type PoolRole,
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

export interface ScheduleScope {
  staffId: string;
  /** Normalized crew names (see `crewKey`). */
  crews: string[];
}

export interface ScheduleInput {
  items: JiraItem[];
  staff: StaffMember[];
  vacations: Vacation[];
  closures: Closure[];
  settings: Settings;
  crewAssignments?: CrewAssignment[];
  /**
   * Forecast one architect as if they only worked these crews. Assignments are
   * decided by the team-wide plan first, then that architect's items are
   * scheduled on their own calendar.
   */
  scope?: ScheduleScope;
}

/** Normalized crew name. Items without a crew use the empty string. */
export function crewKey(crew: string): string {
  return normalizeName(crew);
}

export function poolFor(
  crew: string,
  assignments: CrewAssignment[],
  staff: StaffMember[],
): { staff: StaffMember; assignment: CrewAssignment }[] {
  const key = crewKey(crew);
  if (!key) return [];
  return assignments
    .filter((a) => a.enabled && crewKey(a.crew) === key)
    .sort((a, b) => a.role - b.role)
    .flatMap((assignment) => {
      const member = staff.find((s) => s.id === assignment.staffId);
      return member ? [{ staff: member, assignment }] : [];
    });
}

/**
 * Forecasts start/end dates for every item. Items are worked in array order,
 * each architect works one item at a time, and only working days count.
 */
export function schedule(input: ScheduleInput): Map<string, ScheduledItem> {
  if (input.scope) return scheduleScoped(input, input.scope);
  const { items, staff, vacations, closures, settings } = input;
  const assignments = input.crewAssignments ?? [];
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

  const businessDaysBetween = (from: IsoDate, to: IsoDate): number =>
    from >= to ? 0 : cal.countWorkingDays(from, addDays(to, -1));

  interface Candidate {
    staff: StaffMember;
    role?: PoolRole;
    start: IsoDate;
  }

  const earliestOf = (cands: Candidate[]): Candidate | null =>
    cands.reduce<Candidate | null>((best, c) => (!best || c.start < best.start ? c : best), null);

  const pickFromPool = (cands: Candidate[]): Candidate | null => {
    const primary = cands[0];
    if (!primary) return null;
    if (settings.poolPolicy === 'earliest') return earliestOf(cands);
    if (settings.poolPolicy === 'primary-preferred') {
      const backup = earliestOf(cands.slice(1));
      if (backup) {
        const gap = businessDaysBetween(backup.start, primary.start);
        if (gap > 0 && gap >= settings.backupThresholdDays) return backup;
      }
    }
    return primary;
  };

  interface Choice {
    resolved: Resolved;
    via: AssignedVia;
    role?: PoolRole;
    suggested: boolean;
    extraFlags: FlagCode[];
  }

  const choose = (item: JiraItem, isInProgress: boolean, base: IsoDate): Choice => {
    const jira = resolveArchitect(item, staff, settings.autoAssign);
    const staffOnly = (): Candidate[] =>
      staff.map((s) => ({ staff: s, start: earliestStart(s.id, s.id, base) }));
    const auto = (extraFlags: FlagCode[] = []): Choice => {
      const best = earliestOf(staffOnly());
      return best
        ? {
            resolved: { kind: 'staff', staff: best.staff },
            via: 'auto',
            suggested: true,
            extraFlags,
          }
        : { resolved: { kind: 'none' }, via: 'none', suggested: false, extraFlags };
    };

    const override = item.architectOverride;
    if (override === AUTO_ASSIGN) return auto();
    if (override && jira.kind === 'staff') {
      return { resolved: jira, via: 'override', suggested: false, extraFlags: [] };
    }

    if (settings.assignmentMode === 'crew-pool') {
      const keepsJiraArchitect = isInProgress && (jira.kind === 'staff' || jira.kind === 'unknown');
      if (!keepsJiraArchitect) {
        const pool = poolFor(item.crew, assignments, staff);
        if (pool.length) {
          const cands = pool.map(({ staff: member, assignment }) => ({
            staff: member,
            role: assignment.role,
            start: earliestStart(
              member.id,
              member.id,
              assignment.availableFrom ? maxDate(base, assignment.availableFrom) : base,
            ),
          }));
          const chosen = pickFromPool(cands)!;
          return {
            resolved: { kind: 'staff', staff: chosen.staff },
            via: chosen === cands[0] ? 'primary' : 'backup',
            role: chosen.role,
            suggested: false,
            extraFlags: [],
          };
        }
        if (jira.kind === 'auto') return auto(['no-crew-pool']);
      }
    }

    if (jira.kind === 'auto') return auto();
    if (jira.kind === 'none')
      return { resolved: jira, via: 'none', suggested: false, extraFlags: [] };
    return { resolved: jira, via: 'jira', suggested: false, extraFlags: [] };
  };

  const nameOf = (r: Resolved): string =>
    r.kind === 'staff' ? r.staff.name : r.kind === 'unknown' ? r.name : UNASSIGNED;

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
        architect: nameOf(resolved),
        staffId,
        suggested: false,
        assignedVia: item.architectOverride && resolved.kind === 'staff' ? 'override' : 'jira',
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
    const days = estimateDays(item, settings.daysPerPoint);
    const base = isInProgress ? (item.startDate ?? forecastStart) : forecastStart;
    const { resolved, via, role, suggested, extraFlags } = choose(item, isInProgress, base);
    const flags: FlagCode[] = [...extraFlags];
    if (resolved.kind === 'unknown') flags.push('unknown-architect');
    if (resolved.kind === 'none') flags.push('no-architect');
    if (days === null) flags.push('no-estimate');

    const architect = nameOf(resolved);
    const staffId = resolved.kind === 'staff' ? resolved.staff.id : null;
    const common = { key: item.key, architect, staffId, suggested, assignedVia: via, role };

    if (resolved.kind === 'none' || days === null) {
      result.set(item.key, {
        ...common,
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
      ...common,
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

function scheduleScoped(input: ScheduleInput, scope: ScheduleScope): Map<string, ScheduledItem> {
  const rest: ScheduleInput = { ...input, scope: undefined };
  const full = schedule(rest);
  const crews = new Set(scope.crews.map(crewKey));
  const mine = input.items.filter(
    (i) => full.get(i.key)?.staffId === scope.staffId && crews.has(crewKey(i.crew)),
  );
  const forced = mine.map((i) => ({ ...i, architectOverride: scope.staffId }));
  const scoped = schedule({ ...rest, items: forced });
  for (const [key, s] of scoped) {
    const f = full.get(key)!;
    const poolFlag: FlagCode[] = f.flags.includes('no-crew-pool') ? ['no-crew-pool'] : [];
    scoped.set(key, {
      ...s,
      suggested: f.suggested,
      assignedVia: f.assignedVia,
      role: f.role,
      flags: [...s.flags, ...poolFlag],
    });
  }
  return scoped;
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
