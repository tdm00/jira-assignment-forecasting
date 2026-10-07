import Papa from 'papaparse';
import type { JiraItem, ScheduledItem } from '../core/types';
import { defaultSettings, type AppState } from './store';

export const STORAGE_KEY = 'jira-gantt-forecaster:v1';
export const APP_ID = 'jira-gantt-forecaster';
export const PROJECT_VERSION = 1;

export interface ProjectFile {
  app: string;
  version: number;
  exportedAt: string;
  data: AppState;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validates the overall shape and fills defaults for any missing settings. */
export function coerceState(raw: unknown): AppState {
  if (!isObject(raw)) throw new Error('Project data is not an object');
  for (const k of ['staff', 'vacations', 'closures', 'items'] as const) {
    if (!Array.isArray(raw[k])) throw new Error(`Project data is missing "${k}"`);
  }
  const settings = isObject(raw.settings) ? raw.settings : {};
  return {
    staff: raw.staff as AppState['staff'],
    vacations: raw.vacations as AppState['vacations'],
    closures: raw.closures as AppState['closures'],
    items: (raw.items as JiraItem[]).map((i, idx) => ({
      ...i,
      architectOverride: i.architectOverride ?? null,
      fileIndex: i.fileIndex ?? idx,
    })),
    settings: { ...defaultSettings(), ...(settings as Partial<AppState['settings']>) },
    jiraFileName: typeof raw.jiraFileName === 'string' ? raw.jiraFileName : null,
  };
}

export function serializeProject(state: AppState, now: Date = new Date()): string {
  const file: ProjectFile = {
    app: APP_ID,
    version: PROJECT_VERSION,
    exportedAt: now.toISOString(),
    data: state,
  };
  return JSON.stringify(file, null, 2);
}

export function parseProject(text: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (!isObject(parsed) || parsed.app !== APP_ID) {
    throw new Error('Not a Jira Gantt Forecaster project file');
  }
  if (typeof parsed.version !== 'number' || parsed.version > PROJECT_VERSION) {
    throw new Error(`Unsupported project file version: ${String(parsed.version)}`);
  }
  return coerceState(parsed.data);
}

export function loadState(storage: Storage | undefined = safeStorage()): AppState | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(STORAGE_KEY);
    return text ? coerceState(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function saveState(state: AppState, storage: Storage | undefined = safeStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSaved(storage: Storage | undefined = safeStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be blocked (for example in some file:// contexts); nothing to clear.
  }
}

export function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function exportPlanCsv(items: JiraItem[], scheduled: Map<string, ScheduledItem>): string {
  const rows = items.map((item, idx) => {
    const s = scheduled.get(item.key);
    return {
      'Plan Order': idx + 1,
      'Issue key': item.key,
      Summary: item.summary,
      Crew: item.crew,
      Architect: item.architect,
      'Forecast Architect': s?.architect ?? '',
      Suggested: s?.suggested ? 'yes' : '',
      Status: item.status,
      'Story Points': item.storyPoints ?? '',
      'SLA Days': item.slaDays ?? '',
      'Start date': item.startDate ?? '',
      'Due date': item.endDate ?? '',
      'Forecast Start': s?.start ?? '',
      'Forecast End': s?.end ?? '',
      'Working Days': s?.workingDays ?? '',
      Warnings: s?.flags.join(' ') ?? '',
      Rank: item.rank,
    };
  });
  return Papa.unparse(rows);
}

export function downloadFile(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
