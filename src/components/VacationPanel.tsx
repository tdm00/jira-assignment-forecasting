import { useState, type Dispatch } from 'react';
import { sortStaffByName } from '../core/filters';
import type { Action, AppState } from '../state/store';
import { staffColor } from '../utils/colors';
import { formatRange } from '../utils/format';
import { TrashIcon } from './icons';

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function VacationPanel({ state, dispatch }: Props) {
  const { staff, vacations } = state;
  const [staffId, setStaffId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const sortedStaff = sortStaffByName(staff);
  const selected = staffId || sortedStaff[0]?.id || '';
  const sorted = [...vacations].sort((a, b) => a.start.localeCompare(b.start));
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? 'Unknown';

  const submit = () => {
    if (!selected || !start) {
      setError('Choose a staff member and a start date.');
      return;
    }
    const last = end || start;
    if (last < start) {
      setError('End date must be on or after the start date.');
      return;
    }
    dispatch({
      type: 'addVacations',
      vacations: [{ staffId: selected, start, end: last, note: note.trim() }],
    });
    setStart('');
    setEnd('');
    setNote('');
    setError('');
  };

  return (
    <section className="panel" aria-labelledby="vac-heading">
      <h2 id="vac-heading" className="panel__title">
        Vacations <span className="count-badge">{vacations.length}</span>
      </h2>
      {staff.length === 0 ? (
        <p className="hint">Add staff members first, then record when they are unavailable.</p>
      ) : (
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="field">
            <span>Staff member</span>
            <select className="input" value={selected} onChange={(e) => setStaffId(e.target.value)}>
              {sortedStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <label className="field">
              <span>From</span>
              <input
                className="input"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                aria-label="Vacation start"
              />
            </label>
            <label className="field">
              <span>To</span>
              <input
                className="input"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                aria-label="Vacation end"
              />
            </label>
          </div>
          <label className="field">
            <span>Note (optional)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn--primary">
            Add vacation
          </button>
        </form>
      )}
      <ul className="list" aria-label="Vacations">
        {sorted.map((v) => (
          <li key={v.id} className="list__item">
            <span className="dot" style={{ background: staffColor(staff, v.staffId) }} />
            <span className="list__main">
              <strong>{nameOf(v.staffId)}</strong>
              <small>
                {formatRange(v.start, v.end)}
                {v.note ? ` - ${v.note}` : ''}
              </small>
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove vacation for ${nameOf(v.staffId)} starting ${v.start}`}
              onClick={() => dispatch({ type: 'removeVacation', id: v.id })}
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
