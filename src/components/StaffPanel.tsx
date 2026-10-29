import { useMemo, useState, type Dispatch } from 'react';
import { findStaffMember, normalizeName } from '../core/scheduler';
import type { Action, AppState } from '../state/store';
import { staffColor } from '../utils/colors';
import { TrashIcon, UserIcon } from './icons';

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function StaffPanel({ state, dispatch }: Props) {
  const [name, setName] = useState('');
  const { staff, items, vacations } = state;

  const missingFromJira = useMemo(() => {
    const out = new Map<string, string>();
    for (const i of items) {
      const n = i.architect.trim();
      if (n && !findStaffMember(staff, n)) out.set(normalizeName(n), n);
    }
    return [...out.values()];
  }, [staff, items]);

  const add = () => {
    if (!name.trim()) return;
    dispatch({ type: 'addStaff', names: [name] });
    setName('');
  };

  return (
    <section className="panel" aria-labelledby="staff-heading">
      <h2 id="staff-heading" className="panel__title">
        Staff <span className="count-badge">{staff.length}</span>
      </h2>
      {staff.length === 0 && (
        <p className="hint">
          Add the architects who can be assigned to Jira work. Type a name below or drop a staff CSV
          (one name per line).
        </p>
      )}
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="sr-only" htmlFor="staff-name">
          Staff name
        </label>
        <input
          id="staff-name"
          className="input"
          placeholder="Staff member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {missingFromJira.length > 0 && (
        <button
          type="button"
          className="btn btn--soft btn--block"
          onClick={() => dispatch({ type: 'addStaff', names: missingFromJira })}
          title={missingFromJira.join(', ')}
        >
          <UserIcon /> Add {missingFromJira.length} architect
          {missingFromJira.length === 1 ? '' : 's'} from Jira
        </button>
      )}
      <ul className="list" aria-label="Staff members">
        {staff.map((s) => {
          const vacCount = vacations.filter((v) => v.staffId === s.id).length;
          return (
            <li key={s.id} className="list__item">
              <span className="dot" style={{ background: staffColor(staff, s.id) }} />
              <span className="list__main">
                {s.name}
                <input
                  className="input staff-username"
                  value={s.jiraUsername ?? ''}
                  placeholder="Jira username"
                  spellCheck={false}
                  aria-label={`Jira username for ${s.name}`}
                  onChange={(e) =>
                    dispatch({ type: 'setStaffUsername', id: s.id, username: e.target.value })
                  }
                />
              </span>
              {vacCount > 0 && (
                <span className="chip" title="Vacations">
                  {vacCount} vac
                </span>
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${s.name}`}
                onClick={() => dispatch({ type: 'removeStaff', id: s.id })}
              >
                <TrashIcon />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
