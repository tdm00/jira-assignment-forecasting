import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDownIcon } from './icons';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  colorFor?: (option: string) => string | undefined;
}

export function MultiSelect({ label, options, selected, onChange, colorFor }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);

  return (
    <div className="multiselect" ref={root}>
      <button
        type="button"
        className={`btn btn--outline${selected.length ? ' is-active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        {selected.length > 0 && <span className="count-badge">{selected.length}</span>}
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="popover" id={id} role="group" aria-label={`${label} filter`}>
          {options.length === 0 && <p className="hint">No values</p>}
          {options.map((opt) => (
            <label key={opt} className="check popover__option">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              {colorFor && <span className="dot" style={{ background: colorFor(opt) }} />}
              <span>{opt}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange([])}>
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
