/** Calendar date in `YYYY-MM-DD` form. */
export type IsoDate = string;

export interface StaffMember {
  id: string;
  name: string;
}

export interface Vacation {
  id: string;
  staffId: string;
  start: IsoDate;
  end: IsoDate;
  note: string;
}

export interface Closure {
  id: string;
  name: string;
  start: IsoDate;
  end: IsoDate;
}

export interface JiraItem {
  key: string;
  summary: string;
  crew: string;
  /** Architect name as provided by Jira. */
  architect: string;
  /** Staff id chosen in the grid. `null` = use the Jira value, `AUTO_ASSIGN` = next available. */
  architectOverride: string | null;
  status: string;
  storyPoints: number | null;
  slaDays: number | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  rank: string;
  /** Position in the original file, used as a rank tie-breaker. */
  fileIndex: number;
}

export const AUTO_ASSIGN = '__auto__';

export interface Settings {
  forecastStart: IsoDate;
  daysPerPoint: number;
  autoAssign: boolean;
  doneStatuses: string[];
  inProgressStatuses: string[];
}

export type ItemState = 'done' | 'in-progress' | 'planned' | 'unscheduled';

export type FlagCode = 'no-estimate' | 'no-architect' | 'unknown-architect' | 'late';

export interface ScheduledItem {
  key: string;
  /** Display name of the architect working the item (may be a suggestion). */
  architect: string;
  /** Staff id when the architect is in the staff list. */
  staffId: string | null;
  suggested: boolean;
  state: ItemState;
  start: IsoDate | null;
  end: IsoDate | null;
  workingDays: number;
  flags: FlagCode[];
}

export interface Filters {
  search: string;
  architects: string[];
  crews: string[];
}
