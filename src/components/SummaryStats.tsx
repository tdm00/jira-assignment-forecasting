import { formatDelta, type ArchitectChange } from '../core/compare';
import type { ForecastSummary } from '../core/scheduler';
import type { StaffMember } from '../core/types';
import { staffColor } from '../utils/colors';
import { formatMedium, formatShort } from '../utils/format';

export interface CompareInfo {
  label: string;
  finishDelta: number | null;
  onClear?: () => void;
}

export interface BaselineControls {
  active: boolean;
  takenAt?: string;
  onSet: () => void;
  onClear: () => void;
}

interface Props {
  summary: ForecastSummary;
  staff: StaffMember[];
  compare?: CompareInfo | null;
  baseline?: BaselineControls | null;
  changes?: Map<string, ArchitectChange> | null;
}

export function SummaryStats({ summary, staff, compare, baseline, changes }: Props) {
  const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const cards = [
    {
      label: 'Forecast finish',
      value: formatMedium(summary.finish),
      testId: 'stat-finish',
      delta: compare?.finishDelta ?? null,
    },
    {
      label: 'Open items',
      value: `${summary.openItems}`,
      sub: `of ${summary.totalItems}`,
      testId: 'stat-open',
    },
    {
      label: 'Open story points',
      value: fmtPoints(summary.openPoints),
      sub: `of ${fmtPoints(summary.totalPoints)}`,
      testId: 'stat-points',
    },
    {
      label: 'Late vs due date',
      value: String(summary.lateCount),
      tone: summary.lateCount ? 'danger' : 'ok',
      testId: 'stat-late',
    },
    {
      label: 'Items with warnings',
      value: String(summary.flaggedCount),
      tone: summary.flaggedCount ? 'warn' : 'ok',
      testId: 'stat-flagged',
    },
  ];
  const architects = summary.byArchitect.filter((a) => a.items > 0 || a.staffId);

  return (
    <section className="summary" aria-label="Forecast summary">
      <div className="stat-cards">
        {cards.map((c) => (
          <div key={c.label} className={`stat-card${c.tone ? ` stat-card--${c.tone}` : ''}`}>
            <span className="stat-card__label">{c.label}</span>
            <span className="stat-card__value" data-testid={c.testId}>
              {c.value}
              {c.sub && <small> {c.sub}</small>}
            </span>
            {c.delta !== null && c.delta !== undefined && (
              <span
                className={`stat-card__delta delta delta--${c.delta > 0 ? 'later' : c.delta < 0 ? 'earlier' : 'same'}`}
                data-testid="finish-delta"
              >
                {c.delta === 0
                  ? `no change vs ${compare?.label}`
                  : `${formatDelta(c.delta)} vs ${compare?.label}`}
              </span>
            )}
          </div>
        ))}
      </div>
      {(baseline || compare) && (
        <div className="compare-bar" data-testid="compare-bar">
          {baseline && !baseline.active && (
            <>
              <span>Capture the current forecast to compare what-if changes against it.</span>
              <button
                type="button"
                className="btn btn--soft btn--sm"
                data-testid="set-baseline"
                onClick={baseline.onSet}
              >
                Set baseline
              </button>
            </>
          )}
          {baseline?.active && (
            <>
              <span>
                Comparing with the baseline
                {baseline.takenAt
                  ? ` taken ${baseline.takenAt.slice(0, 16).replace('T', ' ')} UTC`
                  : ''}
                .
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                data-testid="clear-baseline"
                onClick={baseline.onClear}
              >
                Clear baseline
              </button>
            </>
          )}
          {!baseline && compare && (
            <>
              <span>Comparing with the {compare.label}.</span>
              {compare.onClear && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  data-testid="clear-compare"
                  onClick={compare.onClear}
                >
                  Stop comparing
                </button>
              )}
            </>
          )}
        </div>
      )}
      {architects.length > 0 && (
        <ul className="legend" aria-label="Architect finish dates">
          {architects.map((a) => (
            <li
              key={a.architect}
              className="legend__item"
              title={`${a.items} items, ${a.workingDays} working days`}
            >
              <span className="dot" style={{ background: staffColor(staff, a.staffId) }} />
              <span className="legend__name">{a.architect}</span>
              <span className="legend__meta">
                {a.finish ? `done ${formatShort(a.finish)}` : 'available'}
              </span>
              {changes?.get(a.architect) && (
                <span className="legend__changes" data-testid={`changes-${a.architect}`}>
                  {changes.get(a.architect)!.gained > 0 && `+${changes.get(a.architect)!.gained}`}
                  {changes.get(a.architect)!.gained > 0 &&
                    changes.get(a.architect)!.lost > 0 &&
                    ' / '}
                  {changes.get(a.architect)!.lost > 0 && `-${changes.get(a.architect)!.lost}`} items
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
