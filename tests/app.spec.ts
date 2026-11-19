import { test, expect } from '@playwright/test';

test('daily completion updates progress and remains saved after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await expect(page.locator('.summary-ring')).toHaveText('0%');
  await page.locator('button.check').first().click();
  await expect(page.locator('.summary-ring')).toHaveText('10%');
  await page.reload();
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await expect(page.locator('.summary-ring')).toHaveText('10%');
});

test('minimum Foresite session, goals and journals are usable on mobile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start a session' }).click();
  await page.getByLabel(/Session length/).selectOption('30');
  await page.getByLabel('What did you work on?').fill('Build the offline launch checklist');
  await page.getByLabel('What moved forward?').fill('Saved the release checklist locally');
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(page.locator('.streak')).toContainText('1 sessions this week');
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await expect(page.locator('.summary-ring')).toHaveText('10%');
  await page.getByRole('button', { name: 'Goals', exact: true }).click();
  await expect(page.locator('.goal-card')).toHaveCount(8);
  await expect(page.getByText('Build the offline launch checklist')).toBeVisible();
  await page.getByRole('button', { name: /Building in public/ }).click();
  await page.getByPlaceholder(/small feature/).fill('A small progress update');
  await page.getByRole('button', { name: 'Save content' }).click();
  await page.locator('.status-select').selectOption('Published');
  await expect(
    page.locator('.goal-card').filter({ hasText: 'TikTok videos posted' }).locator('.goal-count'),
  ).toContainText('1');
  await page.getByRole('button', { name: /Learning journal/ }).click();
  await page.getByPlaceholder('What did you notice?').fill('An educational market observation');
  await page.getByRole('button', { name: 'Save journal entry' }).click();
  await expect(page.getByText('An educational market observation')).toBeVisible();
  await page.getByRole('button', { name: 'Insights', exact: true }).click();
  await expect(page.getByText('Consistency, in context')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('service worker keeps the app available offline', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await page.locator('button.check').first().click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('h1')).toContainText('Good');
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await expect(page.locator('.summary-ring')).toHaveText('10%');
  await context.setOffline(false);
});

test('routine templates can be edited without losing prior check-ins', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await page.locator('button.check').first().click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const row = page.locator('.setting-row').filter({ hasText: 'Foresite deep work' }).first();
  await row.getByRole('button', { name: 'Edit' }).click();
  await page
    .locator('.modal-card .form-label')
    .filter({ hasText: 'Activity' })
    .locator('input:not([type=checkbox])')
    .first()
    .fill('Foresite build block');
  await page.getByRole('button', { name: 'Save activity' }).click();
  await expect(
    page.locator('.setting-row').filter({ hasText: 'Foresite build block' }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await expect(page.locator('.summary-ring')).toHaveText('10%');
});

test('weekly reflections and their answers can be reopened', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Goals', exact: true }).click();
  await page.getByRole('button', { name: /Open weekly review/ }).click();
  await page.getByLabel('What did I ship this week?').fill('A reliable local save flow');
  await page.getByLabel('How many customer conversations did I have?').fill('2');
  await page.getByRole('button', { name: 'Save this review' }).click();
  await expect(page.getByText('A reliable local save flow')).toBeVisible();
  await expect(page.getByText('YOUR WEEK, IN REVIEW')).toBeVisible();
  await page.getByRole('button', { name: /A reliable local save flow/ }).click();
  await expect(page.getByLabel('What did I ship this week?')).toHaveValue('A reliable local save flow');
});

test('one-time tasks appear only on their selected date', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await page.getByRole('button', { name: /Add something to today/ }).click();
  await page
    .locator('.modal-card .form-label')
    .filter({ hasText: 'Activity' })
    .locator('input:not([type=checkbox])')
    .first()
    .fill('One-time errand');
  await page.getByRole('button', { name: 'Save activity' }).click();
  await expect(page.getByText('One-time errand')).toBeVisible();
  await page.locator('.day-picker .icon-button').first().click();
  await expect(page.getByText('One-time errand')).toHaveCount(0);
});

test('goal quick-add records a published video and Settings explains reminders honestly', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Goals', exact: true }).click();
  const video = page.locator('.goal-card').filter({ hasText: 'TikTok videos posted' });
  await video.locator('.quick-add').click();
  await video.getByRole('button', { name: 'Save' }).click();
  await expect(video.locator('.goal-count')).toContainText('1');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText(/Scheduled notifications are not active/)).toBeVisible();
  await expect(page.getByText('Not active', { exact: true })).toBeVisible();
});

test('savings transfer is due only in the configured payday week', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Goals', exact: true }).click();
  const savings = page.locator('.goal-card').filter({ hasText: 'Savings transfer' });
  await expect(savings).toContainText('Set your next payday in Settings');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.locator('.payday-input').fill(today);
  await page.getByRole('button', { name: 'Goals', exact: true }).click();
  await savings.locator('.quick-add').click();
  await savings.getByRole('button', { name: 'Save' }).click();
  await expect(savings.locator('.goal-count')).toContainText('1');
  await expect(savings).toContainText('Target reached');
});

test('backup export contains the versioned local data collections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export backup/ }).click(),
  ]);
  const stream = await download.createReadStream();
  let body = '';
  for await (const chunk of stream!) body += chunk.toString();
  const backup = JSON.parse(body);
  expect(backup.formatVersion).toBe(1);
  expect(backup.activities.length).toBeGreaterThan(0);
  expect(backup).toHaveProperty('records');
  expect(backup).toHaveProperty('entries');
  expect(backup).toHaveProperty('settings');
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') await dialog.accept('MERGE');
    else await dialog.accept();
  });
  const input = page.locator('.file-button input');
  await input.setInputFiles({
    name: 'foresite-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(body),
  });
  await expect(page.getByText('Backup merged successfully.')).toBeVisible();
  await input.setInputFiles({
    name: 'malformed.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"formatVersion":1,"activities":"invalid"}'),
  });
  await expect(page.getByText(/incomplete, malformed or from an unsupported version/)).toBeVisible();
});

test('PWA includes iOS metadata and installable icon assets', async ({ page, request }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== 'http://127.0.0.1:4174') externalRequests.push(request.url());
  });
  await page.goto('/');
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon: any) => icon.sizes === '192x192')).toBeTruthy();
  expect(manifest.icons.some((icon: any) => icon.sizes === '512x512')).toBeTruthy();
  expect((await request.get('/icon-180.png')).ok()).toBeTruthy();
  expect((await request.get('/apple-splash-1170x2532.png')).ok()).toBeTruthy();
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  expect(externalRequests).toEqual([]);
});

test('recommendations show their reason and a dismissal survives reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.rec-reason').first()).toBeVisible();
  await page.locator('.dismiss-recommendation').first().click();
  await expect(page.getByText('You’ve dismissed today’s note.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('You’ve dismissed today’s note.')).toBeVisible();
});
