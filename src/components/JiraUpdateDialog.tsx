import { useEffect, useId, useRef, useState } from 'react';
import { commentText, commentedIssues, type UpdatePlan } from '../state/jiraScript';

interface Props {
  plan: UpdatePlan;
  defaultNote: string;
  onCancel: () => void;
  onConfirm: (note: string | null) => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function JiraUpdateDialog({ plan, defaultNote, onCancel, onConfirm }: Props) {
  const [note, setNote] = useState(defaultNote);
  const [addComment, setAddComment] = useState(true);
  const area = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const example = commentedIssues(plan)[0];

  useEffect(() => {
    area.current?.focus();
    area.current?.select();
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        <h2 id={titleId} className="modal__title">
          Create Jira update file
        </h2>
        <p className="hint" data-testid="update-summary">
          {plural(plan.issues.length, 'issue')} will be updated
          {plan.ranks.length ? ` and ${plural(plan.ranks.length, 'rank move')} made` : ''}.
          {plan.skipped.length
            ? ` ${plural(plan.skipped.length, 'change')} cannot be sent yet (see Settings > Jira update file).`
            : ''}
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={addComment}
            onChange={(e) => setAddComment(e.target.checked)}
          />
          <span>Add a comment to each updated issue</span>
        </label>
        <label className="field">
          <span>Meeting notes</span>
          <textarea
            ref={area}
            className="input modal__notes"
            rows={4}
            value={note}
            disabled={!addComment}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {addComment && example && (
          <div className="field">
            <span>Comment on {example.key}</span>
            <pre className="modal__preview" data-testid="comment-preview">
              {commentText(note, example.changes)}
            </pre>
          </div>
        )}
        <div className="modal__actions">
          <button type="button" className="btn btn--soft" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onConfirm(addComment ? note : null)}
          >
            Download update file
          </button>
        </div>
      </div>
    </div>
  );
}
