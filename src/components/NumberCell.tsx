import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  step?: number;
  testId?: string;
}

/** Numeric input that commits on every valid keystroke so the forecast updates live. */
export function NumberCell({ value, onChange, label, step = 1, testId }: Props) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(value === null ? '' : String(value));
      setInvalid(false);
    }
  }, [value]);

  return (
    <input
      className={`cell-input${invalid ? ' is-invalid' : ''}`}
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      value={text}
      aria-label={label}
      aria-invalid={invalid || undefined}
      data-testid={testId}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(value === null ? '' : String(value));
        setInvalid(false);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === '') {
          setInvalid(false);
          onChange(null);
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) {
          setInvalid(false);
          onChange(n);
        } else {
          setInvalid(true);
        }
      }}
    />
  );
}
