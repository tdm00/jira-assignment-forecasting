import type { AppState } from '../state/store';
import type { NamedText } from '../state/importFile';
import { DropZone } from './DropZone';
import { CheckIcon, FileIcon } from './icons';

interface Props {
  state: AppState;
  onFiles: (files: NamedText[]) => void;
  onLoadSample: () => void;
}

export function DataChecklist({ state }: { state: AppState }) {
  const rows = [
    {
      label: 'Staff list',
      done: state.staff.length > 0,
      detail: `${state.staff.length} staff`,
    },
    {
      label: 'Vacations',
      done: state.vacations.length > 0,
      detail: `${state.vacations.length} entries`,
    },
    {
      label: 'Organization closures',
      done: state.closures.length > 0,
      detail: `${state.closures.length} entries`,
    },
    {
      label: 'Jira CSV',
      done: state.items.length > 0,
      detail: state.jiraFileName
        ? `${state.items.length} items - ${state.jiraFileName}`
        : `${state.items.length} items`,
    },
  ];
  return (
    <ul className="checklist" aria-label="Loaded data">
      {rows.map((r) => (
        <li key={r.label} className={r.done ? 'is-done' : ''}>
          <span className="checklist__icon">
            {r.done ? <CheckIcon size={14} /> : <FileIcon size={14} />}
          </span>
          <span className="checklist__label">{r.label}</span>
          <span className="checklist__detail">{r.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function DataPanel({ state, onFiles, onLoadSample }: Props) {
  return (
    <section className="panel" aria-labelledby="data-heading">
      <h2 id="data-heading" className="panel__title">
        Data files
      </h2>
      <DropZone onFiles={onFiles} />
      <DataChecklist state={state} />
      <p className="hint">
        The file type is detected from its header row. You can drop several files at once. Data
        stays in this browser.
      </p>
      <button type="button" className="btn btn--soft btn--block" onClick={onLoadSample}>
        Load sample data
      </button>
    </section>
  );
}
