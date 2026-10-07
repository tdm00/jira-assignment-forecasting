import { XIcon } from './icons';

export interface Toast {
  id: number;
  message: string;
  level: 'success' | 'warning' | 'error' | 'info';
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.level}`} data-testid="toast">
          <span>{t.message}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Dismiss"
            onClick={() => onDismiss(t.id)}
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
