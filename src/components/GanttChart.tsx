import { memo, type CSSProperties } from 'react';
import { addDays, dayOfWeek, diffDays, maxDate, minDate, toUtc } from '../core/calendar';
import type { ReferenceEntry } from '../core/compare';
import type { Closure, IsoDate, JiraItem, ScheduledItem, Vacation } from '../core/types';
import { formatMedium, monthName } from '../utils/format';
import type { Zoom } from './FilterBar';

export const DAY_WIDTH: Record<Zoom, number> = { day: 28, week: 12, month: 4 };
const MAX_DAYS = 1500;

export interface Timeline {
  start: IsoDate;
  end: IsoDate;
  days: number;
  dayWidth: number;
  width: number;
}

export interface Block {
  left: number;
  width: number;
  title: string;
}

/** Builds a Monday-aligned timeline covering every date plus some padding. */
export function buildTimeline(dates: IsoDate[], forecastStart: IsoDate, zoom: Zoom): Timeline {
  let lo = forecastStart;
  let hi = addDays(forecastStart, 28);
  for (const d of dates) {
    lo = minDate(lo, d);
    hi = maxDate(hi, d);
  }
  // Old history (for example long-finished Done items) should not push the forecast off screen.
  lo = maxDate(addDays(lo, -7), addDays(forecastStart, -14));
  lo = addDays(lo, -((dayOfWeek(lo) + 6) % 7));
  hi = addDays(hi, 14);
  let days = diffDays(lo, hi) + 1;
  if (days > MAX_DAYS) {
    days = MAX_DAYS;
    hi = addDays(lo, days - 1);
  }
  const dayWidth = DAY_WIDTH[zoom];
  return { start: lo, end: hi, days, dayWidth, width: days * dayWidth };
}

export function xOf(t: Timeline, date: IsoDate): number {
  return diffDays(t.start, date) * t.dayWidth;
}

function rangeBlock(t: Timeline, start: IsoDate, end: IsoDate, title: string): Block | null {
  const s = maxDate(start, t.start);
  const e = minDate(end, t.end);
  if (e < s) return null;
  return { left: xOf(t, s), width: (diffDays(s, e) + 1) * t.dayWidth, title };
}

export function closureBlocks(t: Timeline, closures: Closure[]): Block[] {
  return closures.flatMap((c) => {
    const b = rangeBlock(t, c.start, c.end, `Closed: ${c.name}`);
    return b ? [b] : [];
  });
}

export function vacationBlocks(
  t: Timeline,
  vacations: Vacation[],
  nameOf: (staffId: string) => string,
): Map<string, Block[]> {
  const out = new Map<string, Block[]>();
  for (const v of vacations) {
    const b = rangeBlock(
      t,
      v.start,
      v.end,
      `${nameOf(v.staffId)} on vacation${v.note ? `: ${v.note}` : ''}`,
    );
    if (!b) continue;
    const list = out.get(v.staffId) ?? [];
    list.push(b);
    out.set(v.staffId, list);
  }
  return out;
}

export function gridBackground(t: Timeline): CSSProperties {
  const w = t.dayWidth;
  const week = `${7 * w}px 100%`;
  return {
    width: t.width,
    backgroundImage: [
      'linear-gradient(to right, var(--grid-line) 1px, transparent 1px)',
      `linear-gradient(to right, transparent ${5 * w}px, var(--weekend) ${5 * w}px)`,
    ].join(', '),
    backgroundSize: `${week}, ${week}`,
  };
}

export function GanttHeader({ t, closures }: { t: Timeline; closures: Block[] }) {
  const months: { left: number; width: number; label: string }[] = [];
  let cursor = t.start;
  while (cursor <= t.end) {
    const d = new Date(toUtc(cursor));
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10);
    const last = minDate(addDays(next, -1), t.end);
    const width = (diffDays(cursor, last) + 1) * t.dayWidth;
    const label =
      width > 70
        ? `${monthName(d.getUTCMonth())} ${d.getUTCFullYear()}`
        : width > 28
          ? monthName(d.getUTCMonth())
          : '';
    months.push({ left: xOf(t, cursor), width, label });
    cursor = next;
  }

  const ticks: { left: number; label: string; weekend: boolean }[] = [];
  if (t.dayWidth >= 20) {
    for (let i = 0; i < t.days; i++) {
      const d = addDays(t.start, i);
      const dow = dayOfWeek(d);
      ticks.push({
        left: i * t.dayWidth,
        label: String(Number(d.slice(8))),
        weekend: dow === 0 || dow === 6,
      });
    }
  } else {
    for (let i = 0; i < t.days; i += 7) {
      const d = addDays(t.start, i);
      ticks.push({
        left: i * t.dayWidth,
        label: t.dayWidth >= 8 ? String(Number(d.slice(8))) : '',
        weekend: false,
      });
    }
  }

  return (
    <div className="gantt-header" style={{ width: t.width }} data-testid="gantt-header">
      <div className="gantt-header__months">
        {months.map((m) => (
          <div
            key={m.left}
            className="gantt-header__month"
            style={{ left: m.left, width: m.width }}
          >
            {m.label}
          </div>
        ))}
      </div>
      <div className="gantt-header__ticks">
        {ticks.map((tk) => (
          <div
            key={tk.left}
            className={`gantt-header__tick${tk.weekend ? ' is-weekend' : ''}`}
            style={{ left: tk.left, width: t.dayWidth >= 20 ? t.dayWidth : 7 * t.dayWidth }}
          >
            {tk.label}
          </div>
        ))}
        {closures.map((c) => (
          <div
            key={`${c.left}-${c.title}`}
            className="gantt-header__closure"
            style={{ left: c.left, width: c.width }}
            title={c.title}
          />
        ))}
      </div>
    </div>
  );
}

interface CellProps {
  t: Timeline;
  item: JiraItem;
  s: ScheduledItem | undefined;
  color: string;
  closures: Block[];
  vacations: Block[] | undefined;
  forecastStart: IsoDate;
  /** Where the item sat in the comparison forecast, drawn as a thin ghost bar. */
  ghost?: ReferenceEntry;
}

function tooltip(item: JiraItem, s: ScheduledItem): string {
  const lines = [
    `${item.key}: ${item.summary}`,
    `Architect: ${s.architect}${s.suggested ? ' (suggested)' : ''}`,
    `Forecast: ${formatMedium(s.start)} - ${formatMedium(s.end)}`,
    `Working days: ${s.workingDays}`,
  ];
  if (item.dueDate) lines.push(`Due: ${formatMedium(item.dueDate)}`);
  return lines.join('\n');
}

export const GanttCell = memo(function GanttCell({
  t,
  item,
  s,
  color,
  closures,
  vacations,
  forecastStart,
  ghost,
}: CellProps) {
  const hasBar = s && s.start && s.end;
  const classes = ['gantt-bar', `gantt-bar--${s?.state ?? 'planned'}`];
  if (s?.suggested) classes.push('is-suggested');
  if (s?.flags.includes('late')) classes.push('is-late');
  const left = hasBar ? xOf(t, s.start!) : 0;
  const width = hasBar ? (diffDays(s.start!, s.end!) + 1) * t.dayWidth : 0;
  const showGhost =
    !!ghost?.start &&
    !!ghost.end &&
    s?.state !== 'done' &&
    (ghost.start !== s?.start || ghost.end !== s?.end);

  return (
    <div className="gantt-cell" style={gridBackground(t)}>
      {closures.map((c) => (
        <div
          key={`${c.left}-${c.title}`}
          className="gantt-closure"
          style={{ left: c.left, width: c.width }}
          title={c.title}
        />
      ))}
      {vacations?.map((v) => (
        <div
          key={`${v.left}-${v.title}`}
          className="gantt-vacation"
          style={{ left: v.left, width: v.width }}
          title={v.title}
        />
      ))}
      <div className="gantt-today" style={{ left: xOf(t, forecastStart) }} />
      {hasBar && (
        <div
          className={classes.join(' ')}
          style={{ left, width: Math.max(width, 3), ['--bar-color' as string]: color }}
          title={tooltip(item, s)}
          data-testid={`bar-${item.key}`}
          data-start={s.start ?? ''}
          data-end={s.end ?? ''}
        >
          {width > 48 && <span className="gantt-bar__label">{item.key}</span>}
        </div>
      )}
      {showGhost && (
        <div
          className="gantt-ghost"
          style={{
            left: xOf(t, ghost!.start!),
            width: (diffDays(ghost!.start!, ghost!.end!) + 1) * t.dayWidth,
          }}
          title={`Comparison forecast: ${formatMedium(ghost!.start)} - ${formatMedium(ghost!.end)}`}
          data-testid={`ghost-${item.key}`}
        />
      )}
      {item.dueDate && item.dueDate >= t.start && item.dueDate <= t.end && (
        <div
          className="gantt-due"
          data-testid={`gantt-due-${item.key}`}
          style={{ left: xOf(t, item.dueDate) + t.dayWidth / 2 }}
          title={`Due ${formatMedium(item.dueDate)}`}
        />
      )}
    </div>
  );
});
