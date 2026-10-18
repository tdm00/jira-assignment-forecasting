import { useState, type Dispatch } from 'react';
import type { NamedText } from '../state/importFile';
import type { Action, AppState } from '../state/store';
import { CrewPanel } from './CrewPanel';
import { DataPanel } from './DataPanel';
import { HolidayPanel } from './HolidayPanel';
import { JiraUpdatePanel } from './JiraUpdatePanel';
import { SettingsPanel } from './SettingsPanel';
import { StaffPanel } from './StaffPanel';
import { VacationPanel } from './VacationPanel';

export type SidebarTab = 'data' | 'staff' | 'crews' | 'vacations' | 'closures' | 'settings';

const TABS: { id: SidebarTab; label: string }[] = [
  { id: 'data', label: 'Data' },
  { id: 'staff', label: 'Staff' },
  { id: 'crews', label: 'Crews' },
  { id: 'vacations', label: 'Vacations' },
  { id: 'closures', label: 'Closures' },
  { id: 'settings', label: 'Settings' },
];

interface Props {
  state: AppState;
  dispatch: Dispatch<Action>;
  onFiles: (files: NamedText[]) => void;
  onLoadSample: () => void;
}

export function Sidebar({ state, dispatch, onFiles, onLoadSample }: Props) {
  const [tab, setTab] = useState<SidebarTab>(state.staff.length ? 'data' : 'staff');
  return (
    <aside className="sidebar" aria-label="Data and settings">
      <div className="tabs" role="tablist" aria-label="Sidebar sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`tabpanel-${t.id}`}
            className={`tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        className="sidebar__body"
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'data' && (
          <DataPanel state={state} onFiles={onFiles} onLoadSample={onLoadSample} />
        )}
        {tab === 'staff' && <StaffPanel state={state} dispatch={dispatch} />}
        {tab === 'crews' && <CrewPanel state={state} dispatch={dispatch} />}
        {tab === 'vacations' && <VacationPanel state={state} dispatch={dispatch} />}
        {tab === 'closures' && <HolidayPanel state={state} dispatch={dispatch} />}
        {tab === 'settings' && (
          <>
            <SettingsPanel settings={state.settings} dispatch={dispatch} />
            <JiraUpdatePanel settings={state.settings} staff={state.staff} dispatch={dispatch} />
          </>
        )}
      </div>
    </aside>
  );
}
