import { useEffect, useState, type Dispatch } from 'react';
import { isValidIsoDate } from '../core/calendar';
import type { AssignmentMode, PoolPolicy, Settings } from '../core/types';
import type { Action } from '../state/store';

interface Props {
  settings: Settings;
  dispatch: Dispatch<Action>;
}

const splitList = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function ListField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string[];
  onCommit: (v: string[]) => void;
}) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => setText(value.join(', ')), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(splitList(text))}
      />
    </label>
  );
}

export function SettingsPanel({ settings, dispatch }: Props) {
  const update = (patch: Partial<Settings>) => dispatch({ type: 'updateSettings', patch });
  return (
    <section className="panel" aria-labelledby="settings-heading">
      <h2 id="settings-heading" className="panel__title">
        Forecast settings
      </h2>
      <div className="stack-form">
        <label className="field">
          <span>Forecast start date</span>
          <input
            className="input"
            type="date"
            value={settings.forecastStart}
            onChange={(e) => {
              if (isValidIsoDate(e.target.value)) update({ forecastStart: e.target.value });
            }}
            data-testid="forecast-start"
          />
        </label>
        <label className="field">
          <span>Days per story point (used when SLA is blank)</span>
          <input
            className="input"
            type="number"
            min={0.1}
            step={0.1}
            value={settings.daysPerPoint}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) update({ daysPerPoint: n });
            }}
          />
        </label>
        <label className="field">
          <span>Who works an item</span>
          <select
            className="input"
            value={settings.assignmentMode}
            data-testid="assignment-mode"
            onChange={(e) => update({ assignmentMode: e.target.value as AssignmentMode })}
          >
            <option value="jira">Architect from the Jira file</option>
            <option value="crew-pool">Crew pools (primary and backups)</option>
          </select>
        </label>
        {settings.assignmentMode === 'crew-pool' && (
          <>
            <label className="field">
              <span>Crew pool policy</span>
              <select
                className="input"
                value={settings.poolPolicy}
                data-testid="pool-policy"
                onChange={(e) => update({ poolPolicy: e.target.value as PoolPolicy })}
              >
                <option value="primary-only">Primary only</option>
                <option value="primary-preferred">
                  Primary preferred, backup when much sooner
                </option>
                <option value="earliest">Earliest available in the pool</option>
              </select>
            </label>
            {settings.poolPolicy === 'primary-preferred' && (
              <label className="field">
                <span>Backup must start this many business days sooner</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={settings.backupThresholdDays}
                  data-testid="backup-threshold"
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value));
                    if (Number.isFinite(n) && n >= 1) update({ backupThresholdDays: n });
                  }}
                />
              </label>
            )}
          </>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={settings.autoAssign}
            onChange={(e) => update({ autoAssign: e.target.checked })}
          />
          <span>Assign unassigned items to the next available architect</span>
        </label>
        <ListField
          label="Done statuses (comma separated)"
          value={settings.doneStatuses}
          onCommit={(v) => update({ doneStatuses: v })}
        />
        <ListField
          label="In-progress statuses (comma separated)"
          value={settings.inProgressStatuses}
          onCommit={(v) => update({ inProgressStatuses: v })}
        />
      </div>
    </section>
  );
}
