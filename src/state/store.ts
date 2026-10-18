import { todayIso } from '../core/calendar';
import { moveItem, moveWithinVisible, sortByRank } from '../core/rank';
import type { Baseline } from '../core/compare';
import { crewKey, normalizeName } from '../core/scheduler';
import type {
  Closure,
  CrewAssignment,
  IsoDate,
  JiraItem,
  PoolRole,
  Settings,
  StaffMember,
  Vacation,
} from '../core/types';

export interface AppState {
  staff: StaffMember[];
  vacations: Vacation[];
  closures: Closure[];
  items: JiraItem[];
  settings: Settings;
  jiraFileName: string | null;
  crewAssignments: CrewAssignment[];
  baseline: Baseline | null;
}

export type ItemPatch = Partial<Pick<JiraItem, 'storyPoints' | 'slaDays' | 'architectOverride'>>;

export type Action =
  | { type: 'addStaff'; names: string[] }
  | { type: 'removeStaff'; id: string }
  | { type: 'setStaffUsername'; id: string; username: string }
  | { type: 'addVacations'; vacations: Omit<Vacation, 'id'>[] }
  | { type: 'removeVacation'; id: string }
  | { type: 'addClosures'; closures: Omit<Closure, 'id'>[] }
  | { type: 'removeClosure'; id: string }
  | { type: 'setItems'; items: JiraItem[]; fileName: string | null }
  | { type: 'moveItem'; activeKey: string; overKey: string }
  | { type: 'moveWithinVisible'; key: string; delta: -1 | 1; visibleKeys: string[] }
  | { type: 'updateItem'; key: string; patch: ItemPatch }
  | { type: 'resetOrder' }
  | { type: 'setCrewSlot'; crew: string; role: PoolRole; staffId: string | null }
  | { type: 'toggleCrewAssignment'; crew: string; staffId: string }
  | { type: 'setCrewAvailableFrom'; crew: string; staffId: string; date: IsoDate | null }
  | { type: 'importCrewAssignments'; assignments: Omit<CrewAssignment, 'enabled'>[] }
  | { type: 'seedCrewPools' }
  | { type: 'setBaseline'; baseline: Baseline }
  | { type: 'clearBaseline' }
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
    assignmentMode: 'jira',
    poolPolicy: 'primary-preferred',
    backupThresholdDays: 5,
    jiraBaseUrl: 'https://jira.pncint.net',
    storyPointsField: '',
    slaDaysField: '',
    architectField: '',
    architectFieldType: 'user',
    exportRankChanges: true,
    exportForecastArchitects: false,
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
    crewAssignments: [],
    baseline: null,
  };
}

const sameCrew = (a: string, b: string) => crewKey(a) === crewKey(b);

/** Puts `staffId` in a crew's role slot; the previous holder of that slot and the staff's other slot in the crew are freed. */
export function assignSlot(
  list: CrewAssignment[],
  crew: string,
  role: PoolRole,
  staffId: string | null,
  extra: Partial<CrewAssignment> = {},
): CrewAssignment[] {
  const kept = list.filter(
    (a) => !(sameCrew(a.crew, crew) && (a.role === role || a.staffId === staffId)),
  );
  if (!staffId || !crewKey(crew)) return kept;
  return [...kept, { crew: crew.trim(), staffId, role, enabled: true, ...extra }];
}

/** Each crew's most frequent Jira architect (that is in the staff list) becomes its primary. */
export function seedPools(state: AppState): CrewAssignment[] {
  const byName = new Map(state.staff.map((s) => [normalizeName(s.name), s] as const));
  const order = new Map(state.staff.map((s, i) => [s.id, i] as const));
  const counts = new Map<string, { name: string; perStaff: Map<string, number> }>();
  for (const item of state.items) {
    const key = crewKey(item.crew);
    const member = byName.get(normalizeName(item.architect));
    if (!key || !member) continue;
    const row = counts.get(key) ?? { name: item.crew.trim(), perStaff: new Map() };
    row.perStaff.set(member.id, (row.perStaff.get(member.id) ?? 0) + 1);
    counts.set(key, row);
  }
  let next = state.crewAssignments;
  for (const [key, { name, perStaff }] of counts) {
    if (next.some((a) => crewKey(a.crew) === key && a.role === 1)) continue;
    const [staffId] = [...perStaff.entries()].sort(
      (a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0),
    )[0]!;
    next = assignSlot(next, name, 1, staffId);
  }
  return next;
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
        crewAssignments: state.crewAssignments.filter((a) => a.staffId !== action.id),
        vacations: state.vacations.filter((v) => v.staffId !== action.id),
        items: state.items.map((i) =>
          i.architectOverride === action.id ? { ...i, architectOverride: null } : i,
        ),
      };
    case 'setStaffUsername':
      return {
        ...state,
        staff: state.staff.map((s) => {
          if (s.id !== action.id) return s;
          const next: StaffMember = { ...s };
          const username = action.username.trim();
          if (username) next.jiraUsername = username;
          else delete next.jiraUsername;
          return next;
        }),
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
      return { ...state, items: action.items, jiraFileName: action.fileName, baseline: null };
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
    case 'setCrewSlot':
      return {
        ...state,
        crewAssignments: assignSlot(
          state.crewAssignments,
          action.crew,
          action.role,
          action.staffId,
        ),
      };
    case 'toggleCrewAssignment':
      return {
        ...state,
        crewAssignments: state.crewAssignments.map((a) =>
          sameCrew(a.crew, action.crew) && a.staffId === action.staffId
            ? { ...a, enabled: !a.enabled }
            : a,
        ),
      };
    case 'setCrewAvailableFrom':
      return {
        ...state,
        crewAssignments: state.crewAssignments.map((a) => {
          if (!sameCrew(a.crew, action.crew) || a.staffId !== action.staffId) return a;
          const next: CrewAssignment = { ...a };
          if (action.date) next.availableFrom = action.date;
          else delete next.availableFrom;
          return next;
        }),
      };
    case 'importCrewAssignments': {
      let next = state.crewAssignments;
      for (const a of action.assignments) {
        next = assignSlot(
          next,
          a.crew,
          a.role,
          a.staffId,
          a.availableFrom ? { availableFrom: a.availableFrom } : {},
        );
      }
      return { ...state, crewAssignments: next };
    }
    case 'seedCrewPools':
      return { ...state, crewAssignments: seedPools(state) };
    case 'setBaseline':
      return { ...state, baseline: action.baseline };
    case 'clearBaseline':
      return { ...state, baseline: null };
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'replaceAll':
      return action.state;
    case 'clearAll':
      return { ...initialState(), settings: state.settings };
  }
}
