import { diffDays } from './calendar';
import type { IsoDate, ScheduledItem } from './types';

export interface ReferenceEntry {
  start: IsoDate | null;
  end: IsoDate | null;
  architect: string;
}

/** A frozen forecast that the live forecast is compared against. */
export interface Reference {
  label: string;
  finish: IsoDate | null;
  items: Record<string, ReferenceEntry>;
}

export interface Baseline extends Reference {
  takenAt: string;
}

/** Latest forecast end of open (not done) items. */
export function forecastFinish(scheduled: Map<string, ScheduledItem>): IsoDate | null {
  let finish: IsoDate | null = null;
  for (const s of scheduled.values()) {
    if (s.state !== 'done' && s.end && (!finish || s.end > finish)) finish = s.end;
  }
  return finish;
}

export function makeReference(scheduled: Map<string, ScheduledItem>, label: string): Reference {
  const items: Record<string, ReferenceEntry> = {};
  for (const [key, s] of scheduled) {
    if (s.state === 'done') continue;
    items[key] = { start: s.start, end: s.end, architect: s.architect };
  }
  return { label, finish: forecastFinish(scheduled), items };
}

export function makeBaseline(scheduled: Map<string, ScheduledItem>, now = new Date()): Baseline {
  return { ...makeReference(scheduled, 'baseline'), takenAt: now.toISOString() };
}

/** Calendar days the forecast end moved versus the reference. `null` when not comparable. */
export function endDelta(
  ref: ReferenceEntry | undefined,
  s: ScheduledItem | undefined,
): number | null {
  if (!ref?.end || !s?.end || s.state === 'done') return null;
  return diffDays(ref.end, s.end);
}

export function finishDelta(
  ref: Reference | null,
  scheduled: Map<string, ScheduledItem>,
): number | null {
  const now = forecastFinish(scheduled);
  if (!ref?.finish || !now) return null;
  return diffDays(ref.finish, now);
}

export interface ArchitectChange {
  gained: number;
  lost: number;
}

/** Items that moved to or away from each architect compared with the reference. */
export function architectChanges(
  ref: Reference,
  scheduled: Map<string, ScheduledItem>,
): Map<string, ArchitectChange> {
  const out = new Map<string, ArchitectChange>();
  const bump = (name: string, field: keyof ArchitectChange) => {
    const row = out.get(name) ?? { gained: 0, lost: 0 };
    row[field]++;
    out.set(name, row);
  };
  for (const [key, s] of scheduled) {
    const before = ref.items[key];
    if (!before || s.state === 'done' || s.state === 'unscheduled') continue;
    if (before.architect !== s.architect) {
      bump(s.architect, 'gained');
      bump(before.architect, 'lost');
    }
  }
  return out;
}

export function formatDelta(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return '0d';
  return `${days > 0 ? '+' : '-'}${Math.abs(days)}d`;
}
