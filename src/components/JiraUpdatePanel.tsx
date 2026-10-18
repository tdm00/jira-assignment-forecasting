import type { Dispatch } from 'react';
import { sortStaffByName } from '../core/filters';
import type { ArchitectFieldType, Settings, StaffMember } from '../core/types';
import { PAT_VARIABLE } from '../state/jiraScript';
import type { Action } from '../state/store';

interface Props {
  settings: Settings;
  staff: StaffMember[];
  dispatch: Dispatch<Action>;
}

type TextSetting = 'jiraBaseUrl' | 'storyPointsField' | 'slaDaysField' | 'architectField';

const TEXT_FIELDS: { key: TextSetting; label: string; placeholder: string }[] = [
  { key: 'jiraBaseUrl', label: 'Jira server', placeholder: 'https://jira.example.com' },
  { key: 'storyPointsField', label: 'Story points field id', placeholder: 'customfield_10002' },
  { key: 'slaDaysField', label: 'SLA days field id', placeholder: 'customfield_12345' },
  { key: 'architectField', label: 'Architect field id', placeholder: 'customfield_12346' },
];

export function JiraUpdatePanel({ settings, staff, dispatch }: Props) {
  const update = (patch: Partial<Settings>) => dispatch({ type: 'updateSettings', patch });
  const needsUsernames = settings.architectFieldType === 'user' && settings.architectField.trim();
  return (
    <section className="panel" aria-labelledby="jira-update-heading">
      <h2 id="jira-update-heading" className="panel__title">
        Jira update script
      </h2>
      <p className="hint">
        <strong>Export Jira updates</strong> downloads a script with one curl command per change
        (story points, SLA, architect and plan order). It authenticates with the personal access
        token in <code>${PAT_VARIABLE}</code>. Changes for a blank field id are left out.
      </p>
      <div className="stack-form">
        {TEXT_FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            <input
              className="input"
              value={settings[f.key]}
              placeholder={f.placeholder}
              spellCheck={false}
              data-testid={`jira-${f.key}`}
              onChange={(e) => update({ [f.key]: e.target.value })}
            />
          </label>
        ))}
        <label className="field">
          <span>Architect field type</span>
          <select
            className="input"
            value={settings.architectFieldType}
            data-testid="jira-architectFieldType"
            onChange={(e) => update({ architectFieldType: e.target.value as ArchitectFieldType })}
          >
            <option value="user">User picker (Jira username)</option>
            <option value="select">Select list (architect name)</option>
            <option value="text">Text (architect name)</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.exportRankChanges}
            onChange={(e) => update({ exportRankChanges: e.target.checked })}
          />
          <span>Include plan order as Jira rank changes</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.exportForecastArchitects}
            onChange={(e) => update({ exportForecastArchitects: e.target.checked })}
          />
          <span>Also write architects chosen by crew pools or auto-assign</span>
        </label>
        {needsUsernames && staff.length > 0 && (
          <fieldset className="username-list">
            <legend>Jira usernames</legend>
            {sortStaffByName(staff).map((m) => (
              <label key={m.id} className="username-row">
                <span>{m.name}</span>
                <input
                  className="input"
                  value={m.jiraUsername ?? ''}
                  placeholder="username"
                  spellCheck={false}
                  aria-label={`Jira username for ${m.name}`}
                  onChange={(e) =>
                    dispatch({ type: 'setStaffUsername', id: m.id, username: e.target.value })
                  }
                />
              </label>
            ))}
          </fieldset>
        )}
        <p className="hint">
          Find field ids by opening <code>/rest/api/2/field</code> on your Jira server.
        </p>
      </div>
    </section>
  );
}
