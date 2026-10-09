import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ArchitectFocusBar,
  ViewSwitch,
  type FocusScope,
  type ViewMode,
} from './components/ArchitectFocusBar';
import { DataChecklist } from './components/DataPanel';
import { DropZone } from './components/DropZone';
import { FilterBar, type Zoom } from './components/FilterBar';
import { Header } from './components/Header';
import { JiraGrid } from './components/JiraGrid';
import { Sidebar } from './components/Sidebar';
import { SummaryStats } from './components/SummaryStats';
import { Toasts, type Toast } from './components/Toasts';
import {
  architectChanges,
  finishDelta,
  makeBaseline,
  makeReference,
  pickScheduled,
  restrictReference,
  type Reference,
} from './core/compare';
import {
  applyFilters,
  architectOf,
  crewOf,
  distinctSorted,
  emptyFilters,
  isFiltered,
  statusOptions,
} from './core/filters';
import {
  compareSelections,
  crewStats,
  crewsForArchitect,
  groupByCrew,
  itemsForArchitectCrews,
  itemsInSchedule,
} from './core/focus';
import { schedule, summarize, type ScheduleInput } from './core/scheduler';
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

interface FocusState {
  staffId: string | null;
  /** Normalized crew names; `null` starts with the architect's first crew only. */
  crews: string[] | null;
  scope: FocusScope;
  group: boolean;
  /** The crew selection before the latest toggle, used for the what-if comparison. */
  prevCrews: string[] | null;
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
  const [compact, setCompact] = useState(true);
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

  const [view, setView] = useState<ViewMode>('team');
  const [focus, setFocus] = useState<FocusState>({
    staffId: null,
    crews: null,
    scope: 'selected',
    group: false,
    prevCrews: null,
  });

  const scheduleInput = useMemo<ScheduleInput>(
    () => ({
      items: state.items,
      staff: state.staff,
      vacations: state.vacations,
      closures: state.closures,
      settings: state.settings,
      crewAssignments: state.crewAssignments,
    }),
    [
      state.items,
      state.staff,
      state.vacations,
      state.closures,
      state.settings,
      state.crewAssignments,
    ],
  );
  const fullScheduled = useMemo(() => schedule(scheduleInput), [scheduleInput]);

  const focusStaffId = useMemo(() => {
    if (view !== 'focus') return null;
    const chosen = state.staff.find((s) => s.id === focus.staffId);
    if (chosen) return chosen.id;
    const busy = state.staff.find((s) =>
      [...fullScheduled.values()].some((x) => x.staffId === s.id && x.state !== 'done'),
    );
    return (busy ?? state.staff[0])?.id ?? null;
  }, [view, focus.staffId, state.staff, fullScheduled]);
  const focusActive = focusStaffId !== null;
  const scoped = focusActive && focus.scope === 'selected';

  const chips = useMemo(
    () =>
      focusStaffId
        ? crewsForArchitect(state.items, fullScheduled, state.crewAssignments, focusStaffId)
        : [],
    [focusStaffId, state.items, fullScheduled, state.crewAssignments],
  );
  const selectedKeys = useMemo(() => {
    const valid = chips.map((c) => c.key);
    return focus.crews ? focus.crews.filter((k) => valid.includes(k)) : valid.slice(0, 1);
  }, [chips, focus.crews]);

  const scheduled = useMemo(
    () =>
      scoped && focusStaffId
        ? schedule({ ...scheduleInput, scope: { staffId: focusStaffId, crews: selectedKeys } })
        : fullScheduled,
    [scoped, focusStaffId, selectedKeys, scheduleInput, fullScheduled],
  );
  const focusItems = useMemo(() => {
    if (!focusActive || !focusStaffId) return state.items;
    return scoped
      ? itemsInSchedule(state.items, scheduled)
      : itemsForArchitectCrews(state.items, fullScheduled, focusStaffId, selectedKeys);
  }, [focusActive, focusStaffId, scoped, state.items, scheduled, fullScheduled, selectedKeys]);

  // Filters only choose which rows are shown and counted. The forecast above is not affected.
  const filteredItems = useMemo(
    () => applyFilters(focusItems, scheduled, filters),
    [focusItems, scheduled, filters],
  );
  const filtering = isFiltered(filters);
  const summary = useMemo(
    () =>
      summarize(
        filteredItems,
        scheduled,
        focusActive ? state.staff.filter((s) => s.id === focusStaffId) : state.staff,
      ),
    [filteredItems, scheduled, focusActive, focusStaffId, state.staff],
  );
  const visible = useMemo(
    () => (focusActive && focus.group ? groupByCrew(filteredItems) : filteredItems),
    [filteredItems, focusActive, focus.group],
  );

  const previous = useMemo(
    () =>
      scoped && focusStaffId && focus.prevCrews
        ? schedule({ ...scheduleInput, scope: { staffId: focusStaffId, crews: focus.prevCrews } })
        : null,
    [scoped, focusStaffId, focus.prevCrews, scheduleInput],
  );
  const reference = useMemo<Reference | null>(() => {
    if (scoped) return previous ? makeReference(previous, 'previous crew selection') : null;
    return state.baseline;
  }, [scoped, previous, state.baseline]);
  // The comparison is limited to the same rows as the stats, on both sides.
  const statsScheduled = useMemo(
    () =>
      filtering
        ? pickScheduled(
            scheduled,
            filteredItems.map((i) => i.key),
          )
        : scheduled,
    [filtering, scheduled, filteredItems],
  );
  const statsReference = useMemo(
    () =>
      filtering && reference
        ? restrictReference(
            reference,
            filteredItems.map((i) => i.key),
          )
        : reference,
    [filtering, reference, filteredItems],
  );
  const changes = useMemo(
    () =>
      statsReference && !focusActive ? architectChanges(statsReference, statsScheduled) : null,
    [statsReference, focusActive, statsScheduled],
  );
  const selectionChange = useMemo(() => {
    if (!previous || !focus.prevCrews) return null;
    const nameOf = (key: string) => chips.find((c) => c.key === key)?.name ?? (key || '(No crew)');
    return compareSelections(
      crewStats(itemsInSchedule(state.items, previous), previous),
      crewStats(focusItems, scheduled),
      focus.prevCrews,
      selectedKeys,
      nameOf,
    );
  }, [previous, focus.prevCrews, chips, state.items, focusItems, scheduled, selectedKeys]);
  const focusStats = useMemo(() => crewStats(focusItems, scheduled), [focusItems, scheduled]);

  const toggleCrew = (key: string) => {
    const next = selectedKeys.includes(key)
      ? selectedKeys.filter((k) => k !== key)
      : [...selectedKeys, key];
    setFocus((f) => ({ ...f, prevCrews: selectedKeys, crews: next }));
  };

  const architectOptions = useMemo(
    () =>
      distinctSorted([
        ...state.staff.map((s) => s.name),
        ...state.items.map((i) => architectOf(i, scheduled.get(i.key))),
      ]),
    [state.staff, state.items, scheduled],
  );
  const crewOptions = useMemo(() => distinctSorted(state.items.map(crewOf)), [state.items]);
  const statusChoices = useMemo(() => statusOptions(state.items), [state.items]);

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
          const who = focusActive
            ? `-${(state.staff.find((m) => m.id === focusStaffId)?.name ?? 'architect')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')}`
            : '';
          downloadFile(
            `jira-forecast${who}-${stamp}.csv`,
            exportPlanCsv(focusItems, scheduled),
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
              <SummaryStats
                summary={summary}
                staff={state.staff}
                changes={changes}
                filtered={
                  filtering ? { shown: filteredItems.length, total: focusItems.length } : null
                }
                compare={
                  reference
                    ? {
                        label: reference.label,
                        finishDelta: finishDelta(statsReference, statsScheduled),
                        onClear: scoped
                          ? () => setFocus((f) => ({ ...f, prevCrews: null }))
                          : undefined,
                      }
                    : null
                }
                baseline={
                  scoped
                    ? null
                    : {
                        active: state.baseline !== null,
                        takenAt: state.baseline?.takenAt,
                        onSet: () => {
                          dispatch({ type: 'setBaseline', baseline: makeBaseline(fullScheduled) });
                          notify('Baseline captured from the current forecast', 'success');
                        },
                        onClear: () => dispatch({ type: 'clearBaseline' }),
                      }
                }
              />
              {focusActive && focusStaffId && (
                <ArchitectFocusBar
                  staff={state.staff}
                  staffId={focusStaffId}
                  onStaff={(id) =>
                    setFocus((f) => ({ ...f, staffId: id, crews: null, prevCrews: null }))
                  }
                  chips={chips}
                  selected={selectedKeys}
                  onToggle={toggleCrew}
                  onAddAll={() =>
                    setFocus((f) => ({
                      ...f,
                      prevCrews: selectedKeys,
                      crews: chips.map((c) => c.key),
                    }))
                  }
                  scope={focus.scope}
                  onScope={(scope) => setFocus((f) => ({ ...f, scope }))}
                  group={focus.group}
                  onGroup={(group) => setFocus((f) => ({ ...f, group }))}
                  stats={focusStats}
                  change={selectionChange}
                  onClearChange={() => setFocus((f) => ({ ...f, prevCrews: null }))}
                />
              )}
              {view === 'focus' && !focusActive && (
                <p className="empty-filter">Add staff members to focus on an architect.</p>
              )}
              <FilterBar
                leftSlot={<ViewSwitch view={view} onChange={setView} />}
                showArchitects={!focusActive}
                filters={filters}
                onChange={setFilters}
                architects={architectOptions}
                crews={crewOptions}
                statuses={statusChoices}
                colorFor={(name) => {
                  const s = state.staff.find((x) => x.name === name);
                  return staffColor(state.staff, s?.id ?? null);
                }}
                visibleCount={visible.length}
                totalCount={focusItems.length}
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
                reference={reference}
                groupByCrew={focusActive && focus.group}
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
        <span className="swatch swatch--late" /> Late vs due date
      </li>
      <li>
        <span className="swatch swatch--closure" /> Closure / weekend
      </li>
      <li>
        <span className="swatch swatch--vacation" /> Vacation
      </li>
      <li>
        <span className="swatch swatch--due" /> Due date
      </li>
      <li>
        <span className="swatch swatch--ghost" /> Comparison forecast
      </li>
    </ul>
  );
}
