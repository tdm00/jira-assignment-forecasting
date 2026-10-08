import type { CrewChip, CrewStat, SelectionChange } from '../core/focus';
import type { StaffMember } from '../core/types';
import { staffColor } from '../utils/colors';
import { formatMedium } from '../utils/format';
import { formatDelta } from '../core/compare';

export type ViewMode = 'team' | 'focus';
export type FocusScope = 'selected' | 'all';

export function ViewSwitch({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="segmented view-switch" role="group" aria-label="View">
      {(
        [
          ['team', 'Team'],
          ['focus', 'Architect focus'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={view === id ? 'is-active' : ''}
          aria-pressed={view === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

interface Props {
  staff: StaffMember[];
  staffId: string;
  onStaff: (id: string) => void;
  chips: CrewChip[];
  selected: string[];
  onToggle: (key: string) => void;
  onAddAll: () => void;
  scope: FocusScope;
  onScope: (s: FocusScope) => void;
  group: boolean;
  onGroup: (g: boolean) => void;
  stats: CrewStat[];
  change: SelectionChange | null;
  onClearChange: () => void;
}

const ROLE_LABEL = { 1: 'primary', 2: 'backup 2', 3: 'backup 3' } as const;

export function ArchitectFocusBar(p: Props) {
  const combined = p.stats.reduce<string | null>(
    (m, c) => (c.finish && (!m || c.finish > m) ? c.finish : m),
    null,
  );
  return (
    <section className="focus-bar" aria-label="Architect focus" data-testid="focus-bar">
      <div className="focus-bar__row">
        <label className="focus-bar__field">
          <span>Architect</span>
          <select
            className="input"
            value={p.staffId}
            aria-label="Focus architect"
            onChange={(e) => p.onStaff(e.target.value)}
          >
            {p.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <span className="dot dot--lg" style={{ background: staffColor(p.staff, p.staffId) }} />
        <div className="focus-bar__chips" role="group" aria-label="Crews to include">
          {p.chips.length === 0 && <span className="hint">This architect has no crews yet.</span>}
          {p.chips.map((c) => {
            const on = p.selected.includes(c.key);
            return (
              <button
                key={c.key || 'none'}
                type="button"
                className={`crew-chip${on ? ' is-on' : ''}`}
                aria-pressed={on}
                data-testid={`chip-${c.key || 'none'}`}
                onClick={() => p.onToggle(c.key)}
                title={
                  on ? 'Click to remove this crew from the forecast' : 'Click to add this crew'
                }
              >
                <span className="crew-chip__name">{c.name}</span>
                {c.role && <span className="crew-chip__role">{ROLE_LABEL[c.role]}</span>}
                <span className="crew-chip__meta">
                  {c.items} items, {c.points} pts
                </span>
              </button>
            );
          })}
          {p.chips.length > 1 && p.selected.length < p.chips.length && (
            <button type="button" className="btn btn--soft btn--sm" onClick={p.onAddAll}>
              Add all crews
            </button>
          )}
        </div>
      </div>
      <div className="focus-bar__row">
        <div className="segmented" role="group" aria-label="Forecast scope">
          <button
            type="button"
            className={p.scope === 'selected' ? 'is-active' : ''}
            aria-pressed={p.scope === 'selected'}
            onClick={() => p.onScope('selected')}
            title="Forecast as if the architect only worked the selected crews"
          >
            Selected crews only
          </button>
          <button
            type="button"
            className={p.scope === 'all' ? 'is-active' : ''}
            aria-pressed={p.scope === 'all'}
            onClick={() => p.onScope('all')}
            title="Show the selected crews with the architect's full workload"
          >
            All work
          </button>
        </div>
        <label className="check check--inline">
          <input type="checkbox" checked={p.group} onChange={(e) => p.onGroup(e.target.checked)} />
          <span>Group by crew</span>
        </label>
        <ul className="focus-bar__stats" aria-label="Finish by crew">
          {p.stats.map((c) => (
            <li key={c.key || 'none'} data-testid={`crew-finish-${c.key || 'none'}`}>
              <strong>{c.name}</strong> {c.items} items, {c.points} pts, done{' '}
              {c.finish ? formatMedium(c.finish) : '-'}
            </li>
          ))}
          {p.stats.length > 1 && (
            <li className="focus-bar__combined" data-testid="crew-finish-combined">
              <strong>Combined</strong> done {combined ? formatMedium(combined) : '-'}
            </li>
          )}
        </ul>
      </div>
      {p.change && (
        <div className="focus-bar__change" role="status" data-testid="selection-change">
          <strong>{p.change.description}:</strong>
          {p.change.crews.map((c) => (
            <span
              key={c.name}
              className={`delta ${c.days > 0 ? 'delta--later' : c.days < 0 ? 'delta--earlier' : 'delta--same'}`}
            >
              {c.name} finish {formatDelta(c.days)}
            </span>
          ))}
          {p.change.combined !== null && (
            <span
              className={`delta ${p.change.combined > 0 ? 'delta--later' : p.change.combined < 0 ? 'delta--earlier' : 'delta--same'}`}
            >
              combined {formatDelta(p.change.combined)}
            </span>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={p.onClearChange}>
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}
