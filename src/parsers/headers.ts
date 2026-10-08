export const JIRA_COLUMNS = {
  key: ['issue key', 'key', 'jira key'],
  summary: ['summary', 'task summary'],
  crew: ['crew', 'crew assigned', 'team', 'squad'],
  architect: ['architect', 'architect assigned', 'solution architect'],
  assignee: ['assignee'],
  status: ['status type', 'status'],
  storyPoints: ['story points', 'story point', 'story point estimate', 'points', 'sp'],
  slaDays: ['sla', 'sla days', 'sla days to complete', 'sla of days to complete'],
  startDate: ['start date', 'start', 'target start'],
  endDate: ['target end', 'end date', 'end'],
  dueDate: ['due date', 'due'],
  rank: ['rank'],
} as const satisfies Record<string, readonly string[]>;

export const EMPLOYEE_ID_COLUMNS = ['employee id', 'employee identifier', 'assignee id'];

export const PERSON_COLUMNS = [
  'staff',
  'staff member',
  'staff name',
  'architect',
  'person',
  'employee',
  'member',
];
export const NAME_COLUMNS = ['name', 'full name'];
export const START_COLUMNS = ['start date', 'date', 'start', 'from', 'begin date', 'begin'];
export const END_COLUMNS = ['end date', 'end', 'to', 'until'];
export const CLOSURE_NAME_COLUMNS = [
  'name',
  'holiday',
  'closure',
  'description',
  'reason',
  'title',
];
export const NOTE_COLUMNS = ['note', 'notes', 'reason', 'description', 'comment'];
export const CREW_COLUMNS = ['crew', 'crew name', 'team', 'squad'];
export const ROLE_COLUMNS = ['role', 'priority', 'order', 'level', 'pool role'];
export const AVAILABLE_FROM_COLUMNS = ['available from', 'from', 'start date', 'start'];
