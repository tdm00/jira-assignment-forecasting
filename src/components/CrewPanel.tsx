import { useMemo, type Dispatch } from 'react';
import { distinctSorted } from '../core/filters';
import { crewKey } from '../core/scheduler';
import type { CrewAssignment, PoolRole } from '../core/types';
import type { Action, AppState } from '../state/store';
import { staffColor } from '../utils/colors';

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const SLOTS: { role: PoolRole; label: string }[] = [
  { role: 1, label: 'Primary' },
  { role: 2, label: 'Backup 2' },
  { role: 3, label: 'Backup 3' },
];

/** Crew names from the Jira items and the pool assignments, using the first spelling seen. */
export function listCrews(state: AppState): string[] {
  const seen = new Map<string, string>();
  for (const name of [
    ...state.items.map((i) => i.crew),
    ...state.crewAssignments.map((a) => a.crew),
  ]) {
    const key = crewKey(name);
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }
  return distinctSorted(seen.values());
}

export function CrewPanel({ state, dispatch }: Props) {
  const { staff, crewAssignments, settings } = state;
  const crews = useMemo(() => listCrews(state), [state]);
  const slot = (crew: string, role: PoolRole): CrewAssignment | undefined =>
    crewAssignments.find((a) => crewKey(a.crew) === crewKey(crew) && a.role === role);

  return (
    <section className="panel" aria-labelledby="crews-heading">
      <h2 id="crews-heading" className="panel__title">
        Crew pools <span className="count-badge">{crews.length}</span>
      </h2>
      <p className="hint">
        Give each crew a primary architect, then try a backup 2 or 3 to see how extra capacity
        changes the forecast. An architect can be primary for several crews.
      </p>
      {settings.assignmentMode !== 'crew-pool' && (
        <div className="notice" role="status">
          <span>Crew pools are not used yet. The forecast follows the Jira architect.</span>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            data-testid="use-crew-pools"
            onClick={() =>
              dispatch({ type: 'updateSettings', patch: { assignmentMode: 'crew-pool' } })
            }
          >
            Use crew pools
          </button>
        </div>
      )}
      <button
        type="button"
        className="btn btn--soft btn--block"
        data-testid="seed-crews"
        disabled={staff.length === 0 || state.items.length === 0}
        onClick={() => dispatch({ type: 'seedCrewPools' })}
        title="Make each crew's most frequent Jira architect its primary"
      >
        Seed primaries from Jira
      </button>
      {crews.length === 0 && (
        <p className="hint">Import a Jira CSV (or a crew pool CSV) to list the crews.</p>
      )}
      <ul className="crew-list" aria-label="Crew pools">
        {crews.map((crew) => (
          <li key={crew} className="crew-card" data-testid={`crew-${crew}`}>
            <h3 className="crew-card__name">{crew}</h3>
            {SLOTS.map(({ role, label }) => {
              const current = slot(crew, role);
              return (
                <div key={role} className="crew-slot">
                  <label className="crew-slot__label" htmlFor={`slot-${crew}-${role}`}>
                    {label}
                  </label>
                  <select
                    id={`slot-${crew}-${role}`}
                    className="input crew-slot__select"
                    aria-label={`${label} for ${crew}`}
                    value={current?.staffId ?? ''}
                    onChange={(e) =>
                      dispatch({ type: 'setCrewSlot', crew, role, staffId: e.target.value || null })
                    }
                  >
                    <option value="">None</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {current && (
                    <>
                      <span
                        className="dot"
                        style={{ background: staffColor(staff, current.staffId) }}
                      />
                      <label
                        className="check crew-slot__on"
                        title="Include this slot in the forecast"
                      >
                        <input
                          type="checkbox"
                          aria-label={`${label} enabled for ${crew}`}
                          checked={current.enabled}
                          onChange={() =>
                            dispatch({
                              type: 'toggleCrewAssignment',
                              crew,
                              staffId: current.staffId,
                            })
                          }
                        />
                        <span>on</span>
                      </label>
                      {role > 1 && (
                        <input
                          className="input crew-slot__date"
                          type="date"
                          aria-label={`${label} available from for ${crew}`}
                          title="Available from"
                          value={current.availableFrom ?? ''}
                          onChange={(e) =>
                            dispatch({
                              type: 'setCrewAvailableFrom',
                              crew,
                              staffId: current.staffId,
                              date: e.target.value || null,
                            })
                          }
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}
