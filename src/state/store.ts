import { todayIso } from '../core/calendar';
import { moveItem, moveWithinVisible, sortByRank } from '../core/rank';
import { normalizeName } from '../core/scheduler';
import type { Closure, JiraItem, Settings, StaffMember, Vacation } from '../core/types';

export interface AppState {
  staff: StaffMember[];
  vacations: Vacation[];
  closures: Closure[];
  items: JiraItem[];
  settings: Settings;
  jiraFileName: string | null;
}

export type ItemPatch = Partial<Pick<JiraItem, 'storyPoints' | 'slaDays' | 'architectOverride'>>;

export type Action =
  | { type: 'addStaff'; names: string[] }
  | { type: 'removeStaff'; id: string }
  | { type: 'addVacations'; vacations: Omit<Vacation, 'id'>[] }
  | { type: 'removeVacation'; id: string }
  | { type: 'addClosures'; closures: Omit<Closure, 'id'>[] }
  | { type: 'removeClosure'; id: string }
  | { type: 'setItems'; items: JiraItem[]; fileName: string | null }
  | { type: 'moveItem'; activeKey: string; overKey: string }
  | { type: 'moveWithinVisible'; key: string; delta: -1 | 1; visibleKeys: string[] }
  | { type: 'updateItem'; key: string; patch: ItemPatch }
  | { type: 'resetOrder' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'replaceAll'; state: AppState }
  | { type: 'clearAll' };

let idCounter = 0;
export function makeId(prefix: string): string {
  idCounter++;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}${rand}`;
}

export function defaultSettings(): Settings {
  return {
    forecastStart: todayIso(),
    daysPerPoint: 1,
    autoAssign: true,
    doneStatuses: ['Done', 'Closed', 'Resolved', 'Cancelled', "Won't Do"],
    inProgressStatuses: ['In Progress', 'In Review', 'In Development', 'In QA'],
  };
}

export function initialState(): AppState {
  return {
    staff: [],
    vacations: [],
    closures: [],
    items: [],
    settings: defaultSettings(),
    jiraFileName: null,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addStaff': {
      const known = new Set(state.staff.map((s) => normalizeName(s.name)));
      const added: StaffMember[] = [];
      for (const raw of action.names) {
        const name = raw.replace(/\s+/g, ' ').trim();
        const key = normalizeName(name);
        if (!name || known.has(key)) continue;
        known.add(key);
        added.push({ id: makeId('staff'), name });
      }
      return added.length ? { ...state, staff: [...state.staff, ...added] } : state;
    }
    case 'removeStaff':
      return {
        ...state,
        staff: state.staff.filter((s) => s.id !== action.id),
        vacations: state.vacations.filter((v) => v.staffId !== action.id),
        items: state.items.map((i) =>
          i.architectOverride === action.id ? { ...i, architectOverride: null } : i,
        ),
      };
    case 'addVacations': {
      const key = (v: Omit<Vacation, 'id'>) => `${v.staffId}|${v.start}|${v.end}`;
      const known = new Set(state.vacations.map(key));
      const added: Vacation[] = [];
      for (const v of action.vacations) {
        if (v.end < v.start || known.has(key(v))) continue;
        known.add(key(v));
        added.push({ ...v, id: makeId('vac') });
      }
      return added.length ? { ...state, vacations: [...state.vacations, ...added] } : state;
    }
    case 'removeVacation':
      return { ...state, vacations: state.vacations.filter((v) => v.id !== action.id) };
    case 'addClosures': {
      const key = (c: Omit<Closure, 'id'>) => `${c.start}|${c.end}`;
      const known = new Set(state.closures.map(key));
      const added: Closure[] = [];
      for (const c of action.closures) {
        if (c.end < c.start || known.has(key(c))) continue;
        known.add(key(c));
        added.push({ ...c, id: makeId('cls') });
      }
      return added.length ? { ...state, closures: [...state.closures, ...added] } : state;
    }
    case 'removeClosure':
      return { ...state, closures: state.closures.filter((c) => c.id !== action.id) };
    case 'setItems':
      return { ...state, items: action.items, jiraFileName: action.fileName };
    case 'moveItem':
      return { ...state, items: moveItem(state.items, action.activeKey, action.overKey) };
    case 'moveWithinVisible':
      return {
        ...state,
        items: moveWithinVisible(state.items, action.visibleKeys, action.key, action.delta),
      };
    case 'updateItem':
      return {
        ...state,
        items: state.items.map((i) => (i.key === action.key ? { ...i, ...action.patch } : i)),
      };
    case 'resetOrder':
      return { ...state, items: sortByRank(state.items) };
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'replaceAll':
      return action.state;
    case 'clearAll':
      return { ...initialState(), settings: state.settings };
  }
}
