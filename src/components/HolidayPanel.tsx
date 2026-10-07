import { useState, type Dispatch } from 'react';
import type { Action, AppState } from '../state/store';
import { formatRange } from '../utils/format';
import { CalendarIcon, TrashIcon } from './icons';

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
}

export function HolidayPanel({ state, dispatch }: Props) {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const sorted = [...state.closures].sort((a, b) => a.start.localeCompare(b.start));

  const submit = () => {
    if (!start) {
      setError('Choose a date.');
      return;
    }
    const last = end || start;
    if (last < start) {
      setError('End date must be on or after the start date.');
      return;
    }
    dispatch({
      type: 'addClosures',
      closures: [{ name: name.trim() || 'Closed', start, end: last }],
    });
    setName('');
    setStart('');
    setEnd('');
    setError('');
  };

  return (
    <section className="panel" aria-labelledby="cls-heading">
      <h2 id="cls-heading" className="panel__title">
        Closures <span className="count-badge">{state.closures.length}</span>
      </h2>
      <p className="hint">Days the whole organization is closed, such as bank holidays.</p>
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            placeholder="e.g. Thanksgiving"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Closure name"
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input
              className="input"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-label="Closure date"
            />
          </label>
          <label className="field">
            <span>Until (optional)</span>
            <input
              className="input"
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              aria-label="Closure end"
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary">
          Add closure
        </button>
      </form>
      <ul className="list" aria-label="Closures">
        {sorted.map((c) => (
          <li key={c.id} className="list__item">
            <CalendarIcon className="muted" />
            <span className="list__main">
              <strong>{c.name}</strong>
              <small>{formatRange(c.start, c.end)}</small>
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove closure ${c.name}`}
              onClick={() => dispatch({ type: 'removeClosure', id: c.id })}
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
