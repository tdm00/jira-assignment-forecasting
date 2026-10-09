import { useMemo, useState, type Dispatch } from 'react';
import {
  isUserId,
  normalizeUserId,
  peopleMissingFromJira,
  sortStaffByName,
} from '../core/scheduler';
import type { Action, AppState } from '../state/store';
import { staffColor } from '../utils/colors';
import { TrashIcon, UserIcon } from './icons';

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function StaffPanel({ state, dispatch }: Props) {
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const { staff, items, vacations } = state;
  const staffByName = useMemo(() => sortStaffByName(staff), [staff]);

  const missingFromJira = useMemo(() => peopleMissingFromJira(items, staff), [staff, items]);
  const trimmedId = userId.trim();
  const idInvalid = trimmedId !== '' && !isUserId(trimmedId);
  const idInUse =
    trimmedId !== '' &&
    !idInvalid &&
    staff.some((s) => normalizeUserId(s.userId) === normalizeUserId(trimmedId));

  const add = () => {
    if (!name.trim() || idInvalid || idInUse) return;
    dispatch({ type: 'addStaff', people: [{ name, userId: trimmedId }] });
    setName('');
    setUserId('');
  };

  return (
    <section className="panel" aria-labelledby="staff-heading">
      <h2 id="staff-heading" className="panel__title">
        Staff <span className="count-badge">{staff.length}</span>
      </h2>
      {staff.length === 0 && (
        <p className="hint">
          Add the architects who can be assigned to Jira work. Type a name and optional User ID, or
          drop a staff CSV with Name and User ID columns (or one name per line).
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
          className="input"
          aria-label="User ID"
          placeholder="User ID"
          value={userId}
          aria-invalid={idInvalid || idInUse || undefined}
          onChange={(e) => setUserId(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!name.trim() || idInvalid || idInUse}
        >
          Add
        </button>
      </form>
      {idInvalid && <p className="hint">User ID must be alphanumeric.</p>}
      {idInUse && <p className="hint">That User ID is already in use.</p>}
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
        {staffByName.map((s) => {
          const vacCount = vacations.filter((v) => v.staffId === s.id).length;
          return (
            <li key={s.id} className="list__item">
              <span className="dot" style={{ background: staffColor(staff, s.id) }} />
              <span className="list__main">
                <span>{s.name}</span>
                {s.userId && <small>{s.userId}</small>}
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
