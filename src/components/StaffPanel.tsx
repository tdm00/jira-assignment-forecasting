import { useMemo, useState, type Dispatch } from 'react';
import { normalizeEmployeeId, peopleMissingFromJira } from '../core/scheduler';
import type { Action, AppState } from '../state/store';
import { staffColor } from '../utils/colors';
import { TrashIcon, UserIcon } from './icons';

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function StaffPanel({ state, dispatch }: Props) {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const { staff, items, vacations } = state;

  const missingFromJira = useMemo(() => peopleMissingFromJira(items, staff), [staff, items]);
  const idInUse =
    employeeId.trim() !== '' &&
    staff.some((s) => normalizeEmployeeId(s.employeeId) === normalizeEmployeeId(employeeId));

  const add = () => {
    if (!name.trim() || idInUse) return;
    dispatch({ type: 'addStaff', people: [{ name, employeeId }] });
    setName('');
    setEmployeeId('');
  };

  return (
    <section className="panel" aria-labelledby="staff-heading">
      <h2 id="staff-heading" className="panel__title">
        Staff <span className="count-badge">{staff.length}</span>
      </h2>
      {staff.length === 0 && (
        <p className="hint">
          Add the architects who can be assigned to Jira work. Type a name below or drop a staff CSV
          (one name per line). An employee id is optional.
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
        <input
          className="input input--id"
          aria-label="Employee ID"
          placeholder="Employee ID"
          value={employeeId}
          aria-invalid={idInUse || undefined}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={!name.trim() || idInUse}>
          Add
        </button>
      </form>
      {idInUse && <p className="hint">That employee ID is already in use.</p>}
      {missingFromJira.length > 0 && (
        <button
          type="button"
          className="btn btn--soft btn--block"
          onClick={() => dispatch({ type: 'addStaff', people: missingFromJira })}
          title={missingFromJira.map((p) => p.name).join(', ')}
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
                <span>{s.name}</span>
                {s.employeeId && <small>{s.employeeId}</small>}
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
