import { expect, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DIST_HTML = resolve(ROOT, 'dist/index.html');
export const APP_URL = pathToFileURL(DIST_HTML).href;

export function fixture(name: string): string {
  return readFileSync(resolve(ROOT, 'tests/fixtures', name), 'utf8');
}

export async function openApp(page: Page): Promise<void> {
  if (!existsSync(DIST_HTML)) throw new Error('Run `npm run build` before the e2e tests');
  await page.goto(APP_URL);
  await expect(page.getByRole('heading', { name: 'Jira Gantt Forecaster' })).toBeVisible();
}

/** Dispatches a real drag-and-drop sequence with a DataTransfer holding the given files. */
export async function dropFiles(target: Locator, names: string[]): Promise<void> {
  const files = names.map((name) => ({ name, text: fixture(name) }));
  const dataTransfer = await target.page().evaluateHandle((list) => {
    const dt = new DataTransfer();
    for (const f of list) dt.items.add(new File([f.text], f.name, { type: 'text/csv' }));
    return dt;
  }, files);
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
}

export async function setForecastStart(page: Page, date: string): Promise<void> {
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByTestId('forecast-start').fill(date);
}

export async function loadFixtures(page: Page): Promise<void> {
  await setForecastStart(page, '2026-11-09');
  await dropFiles(page.getByTestId('dropzone-hero'), [
    'staff.csv',
    'closures.csv',
    'vacations.csv',
    'jira.csv',
  ]);
  await expect(page.getByTestId('row-U-1')).toBeVisible();
}

export async function rowKeys(page: Page): Promise<string[]> {
  return page
    .locator('tbody tr[data-key]')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-key') ?? ''));
}
