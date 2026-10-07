import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { JiraItem, Settings } from '../src/core/types';
import { defaultSettings, initialState, type AppState } from '../src/state/store';

export const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function fixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), 'utf8');
}

export function sample(name: string): string {
  return readFileSync(resolve(FIXTURES, '../../docs/sample-data', name), 'utf8');
}

/** Monday 9 Nov 2026; Wednesday 11 Nov is a closure in the fixtures. */
export const FORECAST_START = '2026-11-09';

export function testSettings(patch: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), forecastStart: FORECAST_START, ...patch };
}

export function testState(patch: Partial<AppState> = {}): AppState {
  return { ...initialState(), settings: testSettings(), ...patch };
}

let n = 0;
export function item(patch: Partial<JiraItem> = {}): JiraItem {
  n++;
  return {
    key: `T-${n}`,
    summary: `Item ${n}`,
    crew: '',
    architect: '',
    architectOverride: null,
    status: 'To Do',
    storyPoints: null,
    slaDays: 1,
    startDate: null,
    endDate: null,
    rank: '',
    fileIndex: n,
    ...patch,
  };
}
