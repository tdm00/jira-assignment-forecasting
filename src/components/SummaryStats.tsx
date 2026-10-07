import type { ForecastSummary } from '../core/scheduler';
import type { StaffMember } from '../core/types';
import { staffColor } from '../utils/colors';
import { formatMedium, formatShort } from '../utils/format';

interface Props {
  summary: ForecastSummary;
  staff: StaffMember[];
}

export function SummaryStats({ summary, staff }: Props) {
  const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const cards = [
    { label: 'Forecast finish', value: formatMedium(summary.finish), testId: 'stat-finish' },
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
      label: 'Late vs Jira end',
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
          </div>
        ))}
      </div>
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
