/** Calendar date in `YYYY-MM-DD` form. */
export type IsoDate = string;

export interface StaffMember {
  id: string;
  name: string;
  /** Jira login used when the architect field is a user picker. */
  jiraUsername?: string;
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
  /** Estimates as imported from Jira; edits are measured against these. */
  jira?: { storyPoints: number | null; slaDays: number | null };
}

export const AUTO_ASSIGN = '__auto__';

export type AssignmentMode = 'jira' | 'crew-pool';
export type PoolPolicy = 'primary-only' | 'primary-preferred' | 'earliest';

export interface Settings {
  forecastStart: IsoDate;
  daysPerPoint: number;
  autoAssign: boolean;
  doneStatuses: string[];
  inProgressStatuses: string[];
  /** `jira` uses the architect in the Jira file; `crew-pool` picks from the crew's pool. */
  assignmentMode: AssignmentMode;
  poolPolicy: PoolPolicy;
  /** Business days a backup must start sooner than the primary to take the item. */
  backupThresholdDays: number;
  /** Jira server that the update script targets, for example `https://jira.example.com`. */
  jiraBaseUrl: string;
  /**
   * Jira field ids (for example `customfield_10002`). A filled-in id is sent as-is.
   * When the id is blank, the script looks the id up by the matching field name.
   */
  storyPointsField: string;
  storyPointsFieldName: string;
  slaDaysField: string;
  slaDaysFieldName: string;
  architectField: string;
  architectFieldName: string;
  architectFieldType: ArchitectFieldType;
  targetStartField: string;
  targetStartFieldName: string;
  targetEndField: string;
  targetEndFieldName: string;
  /** Write forecast start and end to the target start and end fields. */
  exportForecastDates: boolean;
  exportRankChanges: boolean;
  /**
   * Kept so projects saved before the architect on the row was always exported still load.
   * Detection no longer reads this switch.
   */
  exportForecastArchitects: boolean;
}

/** How the architect value is sent: user picker `{name}`, select list `{value}` or plain text. */
export type ArchitectFieldType = 'user' | 'select' | 'text';

export type PoolRole = 1 | 2 | 3;

/** One slot of a crew's architect pool: role 1 is the primary, 2 and 3 are backups. */
export interface CrewAssignment {
  crew: string;
  staffId: string;
  role: PoolRole;
  enabled: boolean;
  /** The architect can only start this crew's work from this date. */
  availableFrom?: IsoDate;
}

export type ItemState = 'done' | 'in-progress' | 'planned' | 'unscheduled';

export type FlagCode =
  'no-estimate' | 'no-architect' | 'unknown-architect' | 'late' | 'no-crew-pool';

export type AssignedVia = 'override' | 'jira' | 'primary' | 'backup' | 'auto' | 'none';

export interface ScheduledItem {
  key: string;
  /** Display name of the architect working the item (may be a suggestion). */
  architect: string;
  /** Staff id when the architect is in the staff list. */
  staffId: string | null;
  suggested: boolean;
  assignedVia: AssignedVia;
  /** Pool role of the chosen architect when assigned from a crew pool. */
  role?: PoolRole;
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
