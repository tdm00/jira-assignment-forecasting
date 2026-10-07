import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DataChecklist } from './components/DataPanel';
import { DropZone } from './components/DropZone';
import { FilterBar, type Zoom } from './components/FilterBar';
import { Header } from './components/Header';
import { JiraGrid } from './components/JiraGrid';
import { Sidebar } from './components/Sidebar';
import { SummaryStats } from './components/SummaryStats';
import { Toasts, type Toast } from './components/Toasts';
import { applyFilters, architectOf, crewOf, distinctSorted, emptyFilters } from './core/filters';
import { schedule, summarize } from './core/scheduler';
import type { Filters } from './core/types';
import { SAMPLE_FILES } from './sample';
import { importFiles, type NamedText } from './state/importFile';
import {
  clearSaved,
  downloadFile,
  exportPlanCsv,
  loadState,
  safeStorage,
  saveState,
  serializeProject,
} from './state/persistence';
import { initialState, reducer, type AppState } from './state/store';
import { staffColor } from './utils/colors';

const THEME_KEY = 'jira-gantt-forecaster:theme';
type Theme = 'light' | 'dark';

function initialTheme(storage: Storage | undefined): Theme {
  try {
    const saved = storage?.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore blocked storage
  }
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

interface Props {
  /** Overrides the saved session; used by tests. */
  initial?: AppState;
  storage?: Storage;
}

export default function App({ initial, storage = safeStorage() }: Props) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => initial ?? loadState(storage) ?? initialState(),
  );
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [zoom, setZoom] = useState<Zoom>('week');
  const [compact, setCompact] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => initialTheme(storage));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const storageWarned = useRef(false);

  const notify = useCallback((message: string, level: Toast['level'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, level }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      level === 'error' ? 8000 : 5000,
    );
  }, []);

  useEffect(() => {
    if (!saveState(state, storage) && !storageWarned.current) {
      storageWarned.current = true;
      notify('Browser storage is unavailable. Export the project to keep your work.', 'warning');
    }
  }, [state, storage, notify]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      storage?.setItem(THEME_KEY, theme);
    } catch {
      // ignore blocked storage
    }
  }, [theme, storage]);

  const scheduled = useMemo(
    () =>
      schedule({
        items: state.items,
        staff: state.staff,
        vacations: state.vacations,
        closures: state.closures,
        settings: state.settings,
      }),
    [state.items, state.staff, state.vacations, state.closures, state.settings],
  );
  const summary = useMemo(
    () => summarize(state.items, scheduled, state.staff),
    [state.items, scheduled, state.staff],
  );
  const visible = useMemo(
    () => applyFilters(state.items, scheduled, filters),
    [state.items, scheduled, filters],
  );
  const architectOptions = useMemo(
    () =>
      distinctSorted([
        ...state.staff.map((s) => s.name),
        ...state.items.map((i) => architectOf(i, scheduled.get(i.key))),
      ]),
    [state.staff, state.items, scheduled],
  );
  const crewOptions = useMemo(() => distinctSorted(state.items.map(crewOf)), [state.items]);

  const handleFiles = useCallback(
    (files: NamedText[]) => {
      const { state: next, results } = importFiles(files, state);
      dispatch({ type: 'replaceAll', state: next });
      for (const r of results) notify(r.message, r.level);
      if (results.some((r) => r.kind === 'jira' || r.kind === 'project')) setFilters(emptyFilters);
    },
    [state, notify],
  );

  const loadSample = () => handleFiles(SAMPLE_FILES);

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div
      className={`app${sidebarOpen ? '' : ' sidebar-collapsed'}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) {
          void Promise.all(
            Array.from(e.dataTransfer.files).map(async (f) => ({
              name: f.name,
              text: await f.text(),
            })),
          ).then(handleFiles);
        }
      }}
    >
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onOpenProject={handleFiles}
        onExportProject={() => {
          downloadFile(`jira-forecast-${stamp}.json`, serializeProject(state), 'application/json');
          notify('Project exported', 'success');
        }}
        onExportCsv={() => {
          downloadFile(
            `jira-forecast-${stamp}.csv`,
            exportPlanCsv(state.items, scheduled),
            'text/csv',
          );
          notify('Plan exported as CSV', 'success');
        }}
        onClear={() => {
          if (window.confirm('Clear all staff, vacations, closures and Jira items?')) {
            dispatch({ type: 'clearAll' });
            clearSaved(storage);
            setFilters(emptyFilters);
            notify('All data cleared', 'info');
          }
        }}
        hasItems={state.items.length > 0}
      />
      <div className="app-body">
        {sidebarOpen && (
          <Sidebar
            state={state}
            dispatch={dispatch}
            onFiles={handleFiles}
            onLoadSample={loadSample}
          />
        )}
        <main className="main">
          {state.items.length === 0 ? (
            <div className="empty-state">
              <h2>Forecast your Jira work</h2>
              <p>
                Add your staff list, vacations and organization closures, then drop a Jira CSV
                export to see a live, capacity-aware Gantt forecast.
              </p>
              <DropZone onFiles={handleFiles} variant="hero" />
              <DataChecklist state={state} />
              <button type="button" className="btn btn--primary btn--lg" onClick={loadSample}>
                Load sample data
              </button>
            </div>
          ) : (
            <>
              <SummaryStats summary={summary} staff={state.staff} />
              <FilterBar
                filters={filters}
                onChange={setFilters}
                architects={architectOptions}
                crews={crewOptions}
                colorFor={(name) => {
                  const s = state.staff.find((x) => x.name === name);
                  return staffColor(state.staff, s?.id ?? null);
                }}
                visibleCount={visible.length}
                totalCount={state.items.length}
                zoom={zoom}
                onZoom={setZoom}
                compact={compact}
                onCompact={setCompact}
                onResetOrder={() => {
                  dispatch({ type: 'resetOrder' });
                  notify('Order reset to Jira rank', 'info');
                }}
              />
              <JiraGrid
                state={state}
                visible={visible}
                scheduled={scheduled}
                dispatch={dispatch}
                zoom={zoom}
                compact={compact}
              />
              <GanttLegend />
            </>
          )}
        </main>
      </div>
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}

function GanttLegend() {
  return (
    <ul className="gantt-legend" aria-label="Gantt legend">
      <li>
        <span className="swatch swatch--planned" /> Forecast
      </li>
      <li>
        <span className="swatch swatch--in-progress" /> In progress
      </li>
      <li>
        <span className="swatch swatch--done" /> Done
      </li>
      <li>
        <span className="swatch swatch--suggested" /> Suggested architect
      </li>
      <li>
        <span className="swatch swatch--late" /> Late vs Jira end
      </li>
      <li>
        <span className="swatch swatch--closure" /> Closure / weekend
      </li>
      <li>
        <span className="swatch swatch--vacation" /> Vacation
      </li>
      <li>
        <span className="swatch swatch--due" /> Jira end date
      </li>
    </ul>
  );
}
