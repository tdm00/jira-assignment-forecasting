import { expect, test, type Page } from '@playwright/test';
import { loadFixtures, openApp, rowKeys } from './helpers';

const end = (page: Page, key: string) => page.getByTestId(`fend-${key}`);
const bar = (page: Page, key: string) => page.getByTestId(`bar-${key}`);

test.describe('crew pools and architect focus', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await loadFixtures(page);
    await page.getByRole('tab', { name: 'Crews' }).click();
    await page.getByTestId('seed-crews').click();
    await page.getByTestId('use-crew-pools').click();
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByTestId('pool-policy').selectOption('earliest');
    await page.getByRole('tab', { name: 'Crews' }).click();
  });

  test('adding a backup moves the bars and shows the change against the baseline (REQ-POOL-005, REQ-POOL-008)', async ({
    page,
  }) => {
    await expect(end(page, 'U-1')).toHaveText('Nov 19');
    const before = await bar(page, 'U-1').getAttribute('data-start');
    await page.getByTestId('set-baseline').click();

    await page.getByLabel('Backup 2 for Atlas').selectOption({ label: 'Alice Chen' });
    await expect(end(page, 'U-1')).toHaveText('Nov 17');
    await expect(bar(page, 'U-1')).not.toHaveAttribute('data-start', before ?? '');
    await expect(page.getByTestId('delta-U-1')).toHaveText('-2d');
    await expect(page.getByTestId('finish-delta')).toContainText('-1d');
    await expect(page.getByTestId('ghost-U-1')).toBeVisible();

    await page.getByLabel('Backup 2 enabled for Atlas').uncheck();
    await expect(end(page, 'U-1')).toHaveText('Nov 19');
    await expect(page.getByTestId('delta-U-1')).toHaveText('0d');
  });

  test('forecasts one architect crew by crew (REQ-FOCUS-001..004)', async ({ page }) => {
    await page.getByLabel('Backup 2 for Atlas').selectOption({ label: 'Alice Chen' });
    await page.getByRole('button', { name: 'Architect focus' }).click();
    await page.getByLabel('Focus architect').selectOption({ label: 'Alice Chen' });

    await expect(page.getByTestId('chip-phoenix')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('chip-atlas')).toHaveAttribute('aria-pressed', 'false');
    expect(await rowKeys(page)).toEqual(['A-1', 'A-2']);
    await expect(end(page, 'A-2')).toHaveText('Nov 16');

    await page.getByTestId('chip-atlas').click();
    expect(await rowKeys(page)).toEqual(['A-1', 'A-2', 'U-1']);
    await expect(page.getByTestId('selection-change')).toContainText('Adding Atlas');
    await expect(page.getByTestId('crew-finish-combined')).toBeVisible();

    await page.getByTestId('chip-atlas').click();
    expect(await rowKeys(page)).toEqual(['A-1', 'A-2']);
    await expect(end(page, 'A-2')).toHaveText('Nov 16');

    await page.getByRole('button', { name: 'Team' }).click();
    expect(await rowKeys(page)).toEqual(['A-1', 'A-2', 'B-1', 'U-1']);
  });
});
