import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DIST_HTML, dropFiles, loadFixtures, openApp, rowKeys, setForecastStart } from './helpers';

test.describe('single-file delivery', () => {
  test('build output is one self-contained HTML file (REQ-OVR-001, REQ-NFR-001, REQ-NFR-005)', () => {
    const html = readFileSync(DIST_HTML, 'utf8');
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
    expect(html).not.toMatch(/(src|href)=["']https?:/i);
    expect(Buffer.byteLength(html)).toBeLessThan(1_000_000);
  });

  test('runs from file:// without network requests or errors (REQ-OVR-002, REQ-NFR-002)', async ({
    page,
  }) => {
    const external: string[] = [];
    const errors: string[] = [];
    page.on('request', (r) => {
      if (!/^(file|data|blob):/.test(r.url())) external.push(r.url());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await openApp(page);
    await page.getByRole('button', { name: 'Load sample data' }).last().click();
    await expect(page.locator('tbody tr[data-key]')).toHaveCount(20);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('forecasting workflow', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await loadFixtures(page);
  });

  test('imports dropped files and forecasts (REQ-IMP-001, REQ-SCH-004, REQ-GNT-001)', async ({
    page,
  }) => {
    expect(await rowKeys(page)).toEqual(['A-1', 'A-2', 'B-1', 'U-1']);
    await expect(page.getByTestId('fend-A-1')).toHaveText('Nov 12');
    await expect(page.getByTestId('fend-B-1')).toHaveText('Nov 18');
    await expect(page.getByTestId('bar-A-2')).toHaveAttribute('data-start', '2026-11-13');
    await expect(page.getByTestId('toast').first()).toBeVisible();

    const a1 = await page.getByTestId('bar-A-1').boundingBox();
    const a2 = await page.getByTestId('bar-A-2').boundingBox();
    expect(a2!.x).toBeGreaterThan(a1!.x + a1!.width - 1);
    expect(a2!.y).toBeGreaterThan(a1!.y);
  });

  test('reorders rows with mouse drag and drop (REQ-GRID-007, REQ-GNT-002)', async ({ page }) => {
    const handle = page.getByTestId('handle-A-2');
    const target = page.getByTestId('row-A-1');
    const from = (await handle.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y - 10, { steps: 5 });
    await page.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => rowKeys(page)).toEqual(['A-2', 'A-1', 'B-1', 'U-1']);
    await expect(page.getByTestId('bar-A-2')).toHaveAttribute('data-start', '2026-11-09');
    await expect(page.getByTestId('bar-A-1')).toHaveAttribute('data-end', '2026-11-16');
    await expect(page.getByTestId('row-A-2').getByTestId('position')).toHaveText('1');
  });

  test('reorders with the keyboard (REQ-GRID-011, REQ-UX-005)', async ({ page }) => {
    await page.getByTestId('handle-B-1').focus();
    await page.keyboard.press('Alt+ArrowUp');
    await page.keyboard.press('Alt+ArrowUp');
    expect(await rowKeys(page)).toEqual(['B-1', 'A-1', 'A-2', 'U-1']);
  });

  test('editing SLA and story points updates the Gantt live (REQ-GRID-009, REQ-GRID-010)', async ({
    page,
  }) => {
    const before = (await page.getByTestId('bar-A-1').boundingBox())!.width;
    await page.getByTestId('sla-A-1').fill('6');
    await expect(page.getByTestId('bar-A-1')).toHaveAttribute('data-end', '2026-11-17');
    await expect
      .poll(async () => (await page.getByTestId('bar-A-1').boundingBox())!.width)
      .toBeGreaterThan(before);
    await expect(page.getByTestId('bar-A-2')).toHaveAttribute('data-start', '2026-11-18');

    await page.getByTestId('sla-A-1').fill('');
    await page.getByTestId('sp-A-1').fill('2');
    await expect(page.getByTestId('bar-A-1')).toHaveAttribute('data-end', '2026-11-10');
  });

  test('searches and filters (REQ-GRID-002..006)', async ({ page }) => {
    await page.getByLabel('Search summary').fill('alpha');
    expect(await rowKeys(page)).toEqual(['A-1', 'A-2']);
    await page.getByRole('button', { name: 'Clear filters' }).click();

    await page.getByRole('button', { name: /^Architects/ }).click();
    await page.getByRole('checkbox', { name: 'Bob Martinez' }).check();
    expect(await rowKeys(page)).toEqual(['B-1']);
    await expect(page.getByTestId('fend-B-1')).toHaveText('Nov 18');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Crews/ }).click();
    await page.getByRole('checkbox', { name: 'Phoenix' }).check();
    await expect(page.getByText('No items match')).toBeVisible();
  });

  test('vacations and closures added in the UI shift the forecast (REQ-VAC-001, REQ-CLS-001)', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Vacations' }).click();
    await page.getByLabel('Vacation start').fill('2026-11-09');
    await page.getByLabel('Vacation end').fill('2026-11-10');
    await page.getByRole('button', { name: 'Add vacation' }).click();
    await expect(page.getByTestId('fend-A-1')).toHaveText('Nov 16');

    await page.getByRole('tab', { name: 'Closures' }).click();
    await page.getByLabel('Closure name').fill('Shutdown');
    await page.getByLabel('Closure date').fill('2026-11-12');
    await page.getByRole('button', { name: 'Add closure' }).click();
    await expect(page.getByTestId('fend-A-1')).toHaveText('Nov 17');
    await expect(page.locator('.gantt-header__closure[title="Closed: Shutdown"]')).toHaveCount(1);
  });

  test('exports the project and CSV (REQ-PER-003, REQ-PER-005)', async ({ page }) => {
    const [json] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export project' }).click(),
    ]);
    expect(json.suggestedFilename()).toMatch(/\.json$/);
    const project = JSON.parse(readFileSync((await json.path())!, 'utf8'));
    expect(project.data.items).toHaveLength(4);

    const [csv] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ]);
    expect(readFileSync((await csv.path())!, 'utf8')).toContain('Forecast End');
  });

  test('creates a Jira update file with a meeting comment (REQ-JIRA-005, REQ-JIRA-010, REQ-JIRA-012)', async ({
    page,
  }) => {
    await page.getByTestId('sp-A-1').fill('13');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByTestId('jira-storyPointsField').fill('customfield_10002');
    await page.getByRole('button', { name: 'Jira update file' }).click();
    await page.getByLabel('Meeting notes').fill('Based on a meeting on October 20');
    const [script] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download update file' }).click(),
    ]);
    expect(script.suggestedFilename()).toMatch(/^jira-updates-.*\.sh$/);
    const text = readFileSync((await script.path())!, 'utf8');
    expect(text).toContain(
      `curl -sS --fail-with-body -X PUT 'https://jira.pncint.net/rest/api/2/issue/A-1' -H "Authorization: Bearer $JIRA_PAT"`,
    );
    expect(text).toContain(`{"fields":{"customfield_10002":13}}`);
    expect(text).toContain(
      `{"body":"Based on a meeting on October 20\\n\\nStory Points: 5 to 13"}`,
    );
  });

  test('restores the session after reload (REQ-PER-002)', async ({ page }) => {
    await page.getByTestId('sla-B-1').fill('1');
    await page.reload();
    await expect(page.getByTestId('row-B-1')).toBeVisible();
    await expect(page.getByTestId('sla-B-1')).toHaveValue('1');
  });
});

test('adds staff manually and toggles theme (REQ-STF-002, REQ-UX-003)', async ({ page }) => {
  await openApp(page);
  await page.getByLabel('Staff name').fill('Dana Lee');
  await page.getByLabel('Staff name').press('Enter');
  await expect(page.getByRole('list', { name: 'Staff members' })).toContainText('Dana Lee');
  await page.getByRole('button', { name: /Switch to (dark|light) theme/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
});

test('drops files on the sidebar drop zone (REQ-IMP-002)', async ({ page }) => {
  await openApp(page);
  await setForecastStart(page, '2026-11-09');
  await page.getByRole('tab', { name: 'Data' }).click();
  await dropFiles(page.getByTestId('dropzone-compact'), ['jira.csv']);
  await expect(page.getByTestId('row-A-1')).toBeVisible();
  await expect(
    page.getByTestId('row-U-1').getByRole('img', { name: /No architect/ }),
  ).toBeVisible();
});
