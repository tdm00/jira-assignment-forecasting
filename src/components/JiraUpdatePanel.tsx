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

type IdSetting =
  'storyPointsField' | 'slaDaysField' | 'architectField' | 'targetStartField' | 'targetEndField';

type NameSetting =
  | 'storyPointsFieldName'
  | 'slaDaysFieldName'
  | 'architectFieldName'
  | 'targetStartFieldName'
  | 'targetEndFieldName';

const FIELD_PAIRS: {
  idKey: IdSetting;
  nameKey: NameSetting;
  label: string;
  placeholder: string;
}[] = [
  {
    idKey: 'storyPointsField',
    nameKey: 'storyPointsFieldName',
    label: 'Story points',
    placeholder: 'customfield_10002',
  },
  {
    idKey: 'slaDaysField',
    nameKey: 'slaDaysFieldName',
    label: 'SLA',
    placeholder: 'customfield_12345',
  },
  {
    idKey: 'architectField',
    nameKey: 'architectFieldName',
    label: 'Architect',
    placeholder: 'customfield_12346',
  },
  {
    idKey: 'targetStartField',
    nameKey: 'targetStartFieldName',
    label: 'Forecast start',
    placeholder: 'customfield_12347',
  },
  {
    idKey: 'targetEndField',
    nameKey: 'targetEndFieldName',
    label: 'Forecast end',
    placeholder: 'customfield_12348 or duedate',
  },
];

export function JiraUpdatePanel({ settings, staff, dispatch }: Props) {
  const update = (patch: Partial<Settings>) => dispatch({ type: 'updateSettings', patch });
  const needsUsernames =
    settings.architectFieldType === 'user' &&
    (settings.architectField.trim() !== '' || settings.architectFieldName.trim() !== '');
  return (
    <section className="panel" aria-labelledby="jira-update-heading">
      <h2 id="jira-update-heading" className="panel__title">
        Jira update file
      </h2>
      <p className="hint">
        <strong>Jira update file</strong> downloads a script with one curl line per issue that
        updates its story points, SLA, the architect shown on the row, and forecast dates, and adds
        a comment with your meeting notes and each change. Plan order is written as rank moves. It
        authenticates with the personal access token in <code>${PAT_VARIABLE}</code>. A filled-in
        field id is used as-is. A blank id is looked up by the field name when the script runs.
      </p>
      <div className="stack-form">
        <label className="field">
          <span>Jira server</span>
          <input
            className="input"
            value={settings.jiraBaseUrl}
            placeholder="https://jira.example.com"
            spellCheck={false}
            data-testid="jira-jiraBaseUrl"
            onChange={(e) => update({ jiraBaseUrl: e.target.value })}
          />
        </label>
        {FIELD_PAIRS.map((f) => (
          <div key={f.idKey} className="field-row">
            <label className="field">
              <span>{f.label} field id</span>
              <input
                className="input"
                value={settings[f.idKey]}
                placeholder={f.placeholder}
                spellCheck={false}
                data-testid={`jira-${f.idKey}`}
                onChange={(e) => update({ [f.idKey]: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{f.label} field name</span>
              <input
                className="input"
                value={settings[f.nameKey]}
                spellCheck={false}
                data-testid={`jira-${f.nameKey}`}
                onChange={(e) => update({ [f.nameKey]: e.target.value })}
              />
            </label>
          </div>
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
            checked={settings.exportForecastDates}
            onChange={(e) => update({ exportForecastDates: e.target.checked })}
          />
          <span>Set target start and end to the forecast dates</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.exportRankChanges}
            onChange={(e) => update({ exportRankChanges: e.target.checked })}
          />
          <span>Include plan order as Jira rank changes</span>
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
          The architect shown on the row is written when the name differs from Jira, including a
          forecast, crew pool, or auto-assign. If a field name is not on the server, that field is
          skipped and the others still update. A missing username is reported and does not block the
          download.
        </p>
      </div>
    </section>
  );
}
