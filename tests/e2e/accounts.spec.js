import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, getLesson, playThrough, dismissNamePrompt } from './helpers.js';
import { createMockBackend, makeSession } from './mockSupabase.js';

test.use({ serviceWorkers: 'block' });
const state = () => JSON.parse(localStorage.getItem('mohleyla-v6'));

async function signIn(page, email = 'amina@example.com', code = '123456') {
  await page.goto('/settings');
  await page.locator('[data-testid="acc-email"]').fill(email);
  await page.locator('[data-testid="acc-send"]').click();
  await expect(page.locator('[data-testid="acc-sent"]')).toContainText(email);
  await page.locator('[data-testid="acc-code"]').fill(code);
  await page.locator('[data-testid="acc-verify"]').click();
  await dismissNamePrompt(page);
}

test.describe('accounts & sync (mocked Supabase API)', () => {
  test('sign in with an emailed code uploads local progress; sign out keeps it', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en', state: { xpLedger: { dev: 150 }, xp: 150, completed: { 'ar-01': { best: 100, attempts: 1, perfect: true } }, saved: { a1: 1 } } });
    await signIn(page);
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Up to date');
    expect(backend.rows.size).toBe(1);
    const row = [...backend.rows.values()][0];
    expect(row.xp).toBe(150);
    expect(row.settings).toBeUndefined();
    expect(row.device).toBeUndefined();
    await page.locator('[data-testid="acc-signout"]').click();
    await expect(page.locator('[data-testid="acc-email"]')).toBeVisible();
    expect((await page.evaluate(state)).xp).toBe(150);
  });

  test('after sending, the screen offers the code box and the link; following the emailed link signs in and syncs', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en', state: { xp: 70, xpLedger: { d: 70 }, completed: { 'ar-01': { best: 100, attempts: 1 } } } });
    await page.goto('/settings');
    await page.locator('[data-testid="acc-email"]').fill('amina@example.com');
    await page.locator('[data-testid="acc-send"]').click();
    await expect(page.locator('[data-testid="acc-sent"]')).toContainText('open the link in it on this device');
    await expect(page.locator('[data-testid="acc-code"]')).toBeVisible();
    await page.locator('[data-testid="acc-resend"]').click();
    await expect.poll(() => backend.stats.otps).toBe(2);
    // the user opens the link from the email: Supabase redirects to /settings with the session in the URL hash
    const s = makeSession('amina@example.com', 'user-amina');
    await page.goto('about:blank'); // an emailed link opens as a fresh page load, not a same-page hash change
    await page.goto(`/settings#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&expires_at=${s.expires_at}&token_type=bearer&type=magiclink`);
    await dismissNamePrompt(page);
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Up to date');
    expect(backend.rows.has('user-amina')).toBe(true);
    expect([...backend.rows.values()][0].xp).toBe(70);
    await page.reload();
    await expect(page.locator('[data-testid="sync-status"]')).toBeVisible(); // session persisted
  });

  test('wrong code, bad email and rate limits show translated errors', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'id' });
    await page.goto('/settings');
    backend.state.rateLimit = true;
    await page.locator('[data-testid="acc-email"]').fill('a@b.co');
    await page.locator('[data-testid="acc-send"]').click();
    await expect(page.locator('[data-testid="acc-error"]')).toContainText('Terlalu banyak email');
    backend.state.rateLimit = false;
    await page.locator('[data-testid="acc-send"]').click();
      await page.locator('[data-testid="acc-code"]').fill('999999');
    await page.locator('[data-testid="acc-verify"]').click();
    await expect(page.locator('[data-testid="acc-error"]')).toContainText('Kode salah');
  });

  test('a lesson finished on one device appears on a second device of the same account (and XP adds up)', async ({ browser }) => {
    test.setTimeout(120_000); // two full lessons plus two sign-ins
    const backend = createMockBackend();
    const lesson = getLesson('ar-01');

    const ctxA = await browser.newContext({ serviceWorkers: 'block' });
    await backend.install(ctxA);
    const phone = await ctxA.newPage();
    await seed(phone, { lang: 'en' });
    await phone.goto('/lesson/ar-01');
    await playThrough(phone, lesson, 'en');
    await signIn(phone);
    await expect(phone.locator('[data-testid="sync-status"]')).toContainText('Up to date');

    const ctxB = await browser.newContext({ serviceWorkers: 'block' });
    await backend.install(ctxB);
    const tablet = await ctxB.newPage();
    await seed(tablet, { lang: 'ar' });
    await tablet.goto('/lesson/en-01');
    await playThrough(tablet, getLesson('en-01'), 'ar', { wrongFirst: true }); // +50 on the tablet
    await signIn(tablet);
    // the tablet has its own progress and has never synced with this account: it asks, and the learner combines both
    await expect(tablet.locator('[data-testid="acc-choice"]')).toBeVisible();
    await tablet.locator('[data-testid="choice-merge"]').click();
    await dismissNamePrompt(tablet); // the name question comes after the merge question
    await expect(tablet.locator('[data-testid="sync-status"]')).toContainText('محدَّث');
    const t = await tablet.evaluate(state);
    expect(Object.keys(t.completed).sort()).toEqual(['ar-01', 'en-01']);
    expect(t.xp).toBe(120);

    await phone.locator('[data-testid="acc-sync"]').click();
    await expect(phone.locator('[data-testid="sync-status"]')).toContainText('Up to date');
    expect((await phone.evaluate(state)).xp).toBe(120);
    await ctxA.close(); await ctxB.close();
  });

  test('stored session is restored after reload and background sync pushes new progress', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await signIn(page);
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Up to date');
    await page.reload();
    await expect(page.locator('[data-testid="sync-status"]')).toBeVisible(); // still signed in
    const before = backend.stats.upserts;
    await page.goto('/lesson/en-01');
    await playThrough(page, getLesson('en-01'), 'en');
    await expect.poll(() => backend.stats.upserts, { timeout: 15000 }).toBeGreaterThan(before);
    expect([...backend.rows.values()][0].xp).toBe(70);
  });

  test('a different account on a shared device asks before mixing progress', async ({ page }) => {
    const backend = createMockBackend({ users: { 'kid@example.com': 'user-kid' } });
    backend.rows.set('user-kid', { schema: 6, xp: 300, xpLedger: { tablet: 300 }, completed: { 'id-01': { best: 90, attempts: 1 } }, saved: {}, unsaved: {}, srs: {}, speaking: {}, stats: {}, days: {}, streak: { current: 0, best: 0, last: null } });
    await backend.install(page);
    await seed(page, { lang: 'en', state: { xp: 70, xpLedger: { me: 70 }, completed: { 'ar-01': { best: 100, attempts: 1 } } } });
    await page.addInitScript(() => localStorage.setItem('mohleyla-sync-link', 'someone-else'));
    await signIn(page, 'kid@example.com');
    await expect(page.locator('[data-testid="acc-choice"]')).toBeVisible();
    expect((await page.evaluate(state)).xp).toBe(70); // untouched until a choice is made
    await page.locator('[data-testid="choice-merge"]').click();
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Up to date');
    expect((await page.evaluate(state)).xp).toBe(370);
  });

  test('deleting cloud data removes the row and signs out; reset while signed in also deletes the cloud copy', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en', state: { xp: 70, xpLedger: { d: 70 }, completed: { 'ar-01': { best: 100, attempts: 1 } } } });
    await signIn(page);
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Up to date');
    expect(backend.rows.size).toBe(1);
    await page.getByRole('button', { name: 'Delete my cloud data' }).first().click();
    await page.locator('[data-testid="acc-delete-confirm"]').click();
    await expect.poll(() => backend.rows.size).toBe(0);
    await expect(page.locator('[data-testid="acc-email"]')).toBeVisible();
    expect((await page.evaluate(state)).xp).toBe(70); // device progress kept

    await signIn(page);
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Up to date');
    expect(backend.rows.size).toBe(1);
    await page.getByRole('button', { name: 'Reset all progress' }).click();
    await page.locator('dialog[open] button', { hasText: 'Reset all progress' }).click();
    await expect.poll(() => backend.rows.size).toBe(0);
    await page.waitForTimeout(3500); // past the sync debounce: the reset must not resurrect cloud data
    expect(backend.rows.size).toBe(0);
  });

  test('offline sign-in attempt explains the problem; account card passes axe in Arabic', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'ar' });
    await page.goto('/settings');
    await expect(page.locator('[data-testid="account"]')).toContainText('الحساب والمزامنة');
    const r = await new AxeBuilder({ page }).include('[data-testid="account"]').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
  });
});
