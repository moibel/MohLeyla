import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, getLesson, playThrough } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

// Runs against the build with VITE_REQUIRE_SIGN_IN=true (port 4174, see playwright.config.js).
test.use({ baseURL: 'http://127.0.0.1:4174', serviceWorkers: 'block' });
const state = () => JSON.parse(localStorage.getItem('mohleyla-v6'));

async function signInGate(page, email, code = '123456') {
  await page.locator('[data-testid="acc-email"]').fill(email);
  await page.locator('[data-testid="acc-send"]').click();
  await expect(page.locator('[data-testid="acc-sent"]')).toContainText(email);
  await page.locator('[data-testid="acc-code"]').fill(code);
  await page.locator('[data-testid="acc-verify"]').click();
  await expect(page.locator('[data-testid="gate"]')).toHaveCount(0); // wait until sign-in finished and the app opened
}

test.describe('required sign-in', () => {
  test('nothing is reachable before signing in; the gate is translated and accessible', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    for (const url of ['/', '/lesson/ar-01', '/learn', '/settings']) {
      await page.goto(url);
      await expect(page.locator('[data-testid="gate"]'), url).toBeVisible();
      await expect(page.locator('.bottom-nav, .sidebar')).toHaveCount(0);
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in to start learning');
    await page.locator('[data-testid="lang-switch"]').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('سجّل الدخول لتبدأ التعلّم');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
  });

  test('signing in opens the app, survives a reload, and sign-out returns to the gate', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await signInGate(page, 'amina@example.com');
    await expect(page.locator('.sidebar, .bottom-nav').first()).toBeAttached();
    await expect(page.locator('[data-testid="gate"]')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('[data-testid="gate"]')).toHaveCount(0); // remembered: no sign-in screen flash or prompt
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.goto('/settings');
    await page.locator('[data-testid="acc-signout"]').click();
    await expect(page.locator('[data-testid="gate"]')).toBeVisible();
  });

  test('existing progress on the device is kept and uploaded at first sign-in (nothing lost)', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'id', legacy: { completed: ['ar-01', 'en-02'], saved: ['a1'], xp: 150 } });
    await page.goto('/');
    await expect(page.locator('[data-testid="gate"]')).toBeVisible();
    await signInGate(page, 'old-learner@example.com');
    await expect.poll(() => backend.rows.size).toBe(1);
    const row = [...backend.rows.values()][0];
    expect(row.xp).toBe(150);
    expect(Object.keys(row.completed).sort()).toEqual(['ar-01', 'en-02']);
    expect(row.saved.a1).toBe(0);
  });

  test('shared device: sign-out saves to the cloud then clears the device; the next person starts clean; the first person gets everything back', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await signInGate(page, 'amina@example.com');
    await page.goto('/lesson/ar-01');
    await playThrough(page, getLesson('ar-01'), 'en'); // +70 XP, not yet synced when we sign out
    await page.goto('/settings');
    await page.locator('[data-testid="acc-signout"]').click();
    await expect(page.locator('[data-testid="gate"]')).toBeVisible();
    // the lesson reached the cloud before the device was cleared
    const aminaRow = [...backend.rows.values()][0];
    expect(aminaRow.xp).toBe(70);
    // and this device no longer holds her progress
    const left = await page.evaluate(state);
    expect(left.xp).toBe(0);
    expect(Object.keys(left.completed)).toEqual([]);
    // the next person signs in: clean start, no "merge?" question
    await page.locator('[data-testid="acc-email"]').fill('omar@example.com');
    await page.locator('[data-testid="acc-send"]').click();
    await page.locator('[data-testid="acc-code"]').fill('123456');
    await page.locator('[data-testid="acc-verify"]').click();
    await expect(page.locator('[data-testid="gate"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="acc-choice"][open]')).toHaveCount(0);
    expect((await page.evaluate(state)).xp).toBe(0);
    expect(backend.rows.size).toBe(1); // no empty row created for someone with no progress yet
    // Amina comes back on the same device and gets her progress back
    await page.goto('/settings');
    await page.locator('[data-testid="acc-signout"]').click();
    await signInGate(page, 'amina@example.com');
    await expect(page.locator('[data-testid="gate"]')).toHaveCount(0);
    await expect.poll(async () => (await page.evaluate(state)).xp).toBe(70);
  });

  test('offline sign-out asks before discarding unsaved progress; staying keeps it, discarding clears it', async ({ page, context }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await signInGate(page, 'amina@example.com');
    await page.goto('/settings');
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Up to date');
    await context.setOffline(true);
    await page.locator('[data-testid="acc-signout"]').click();
    await expect(page.locator('[data-testid="acc-unsynced"]')).toBeVisible();
    await page.locator('[data-testid="unsynced-cancel"]').click();
    await expect(page.locator('[data-testid="gate"]')).toHaveCount(0); // still signed in
    await page.locator('[data-testid="acc-signout"]').click();
    await page.locator('[data-testid="unsynced-force"]').click();
    await expect(page.locator('[data-testid="gate"]')).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('required sign-in offline', () => {
  test.use({ serviceWorkers: 'allow' });
  test('a learner who has signed in can reopen the app without internet', async ({ page, context }) => {
    const backend = createMockBackend();
    await backend.install(context);
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await signInGate(page, 'amina@example.com');
    await expect(page.locator('[data-testid="gate"]')).toHaveCount(0);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.goto('/learn');
    await context.setOffline(true);
    await page.goto('/learn');
    await expect(page.locator('[data-testid="gate"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await context.setOffline(false);
  });
});
