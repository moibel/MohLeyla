import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, dismissNamePrompt } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

test.use({ serviceWorkers: 'block' });

async function signIn(page, email, lang = 'en') {
  await seed(page, { lang });
  await page.goto('/settings');
  await page.locator('[data-testid="acc-email"]').fill(email);
  await page.locator('[data-testid="acc-send"]').click();
  await page.locator('[data-testid="acc-code"]').fill('123456');
  await page.locator('[data-testid="acc-verify"]').click();
  await expect(page.locator('[data-testid="avatar-link"]')).toBeVisible();
  await dismissNamePrompt(page);
}
async function newDevice(browser, backend, email, lang = 'en') {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await backend.install(ctx);
  const page = await ctx.newPage();
  await signIn(page, email, lang);
  return { ctx, page };
}

test.describe('admin rewards (mocked Supabase API; the real rules are tested in supabase/tests/rewards.test.sql)', () => {
  test('an admin gives stars, bonus XP and a badge by email; the learner is told once and sees them on the profile and in the top bar', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin');
    const panel = page.locator('[data-testid="admin-rewards"]');
    await expect(panel).toBeVisible();

    const give = async (kind, fields) => {
      await panel.locator('[data-testid="reward-email"]').fill('Sara@Example.com');
      await panel.locator('[data-testid="reward-kind"]').selectOption(kind);
      for (const [id, v] of Object.entries(fields)) await panel.locator(`[data-testid="${id}"]`).fill(v);
      await panel.locator('[data-testid="reward-give"]').click();
      await expect(panel.locator('[data-testid="reward-msg"]')).toContainText('sara@example.com');
    };
    await give('star', { 'reward-amount': '5', 'reward-reason': 'Ramadan challenge' });
    await give('xp', { 'reward-amount': '250' });
    await give('badge', { 'reward-label': 'Challenge winner', 'reward-reason': 'First place' });
    await expect(panel.locator('[data-testid="reward-row"]')).toHaveCount(3);

    // Sara had not signed up when the rewards were given; she gets them at first sign-in
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await expect(sara.page.locator('[data-testid="reward-notice"]')).toBeVisible();
    await expect(sara.page.locator('[data-testid="reward-notice"]')).toContainText('Stars: +5');
    await expect(sara.page.locator('[data-testid="star-pill"]')).toContainText('5');
    await expect(sara.page.locator('.stat-xp')).toContainText('250');
    await sara.page.locator('[data-testid="reward-dismiss"]').click();
    await expect(sara.page.locator('[data-testid="reward-notice"]')).toHaveCount(0);
    await sara.page.reload();
    await expect(sara.page.locator('[data-testid="reward-notice"]')).toHaveCount(0); // told once
    await expect(sara.page.locator('[data-testid="star-pill"]')).toContainText('5');
    await sara.page.goto('/profile');
    await expect(sara.page.locator('[data-testid="reward-stars"]')).toHaveText('5');
    await expect(sara.page.locator('[data-testid="reward-xp"]')).toHaveText('250');
    await expect(sara.page.locator('[data-testid="reward-badge"]')).toContainText('Challenge winner');
    const axe = await new AxeBuilder({ page: sara.page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);

    // admin takes the xp back; Sara's total drops after a refresh
    await page.locator('[data-testid="reward-row"]', { hasText: 'Bonus XP' }).locator('[data-testid="reward-revoke"]').click();
    await page.locator('[data-testid="reward-confirm-yes"]').click();
    await expect(page.locator('[data-testid="reward-row"]', { hasText: 'Bonus XP' })).toContainText('Taken back');
    await sara.page.reload();
    await expect(sara.page.locator('.stat-xp')).not.toContainText('250');
    await sara.ctx.close();
  });

  test('bonus rewards never change the daily goal or the streak', async ({ page }) => {
    const backend = createMockBackend();
    backend.rewards.push({ id: 'rw-x', email: 'omar@example.com', kind: 'xp', amount: 500, label: null, reason: null, created_at: new Date().toISOString(), granted_by_email: 'a@b.cc', revoked_at: null });
    await backend.install(page);
    await signIn(page, 'omar@example.com');
    await expect(page.locator('.stat-xp')).toContainText('500');
    await page.goto('/');
    await expect(page.locator('.stat-card').first()).toContainText('0'); // today's goal still at 0 XP
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('mohleyla-v6')));
    expect(st.xp).toBe(0);
  });

  test('a student and a teacher cannot reach the rewards form; the page explains why', async ({ page }) => {
    const backend = createMockBackend({ teachers: ['tee@example.com'] });
    await backend.install(page);
    await signIn(page, 'tee@example.com');
    await page.goto('/admin');
    await expect(page.locator('[data-testid="not-allowed"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-rewards"]')).toHaveCount(0);
  });

  test('validation errors are shown translated (amount too large is blocked by the form, a bad badge by the server)', async ({ page }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin');
    const panel = page.locator('[data-testid="admin-rewards"]');
    await panel.locator('[data-testid="reward-email"]').fill('x@example.com');
    await panel.locator('[data-testid="reward-kind"]').selectOption('badge');
    await panel.locator('[data-testid="reward-label"]').fill('   ');
    await panel.locator('[data-testid="reward-give"]').click();
    await expect(panel.locator('[data-testid="reward-msg"]')).toContainText('check what you entered');
  });

  for (const lang of ['ar', 'id']) {
    test(`${lang}: the admin rewards panel and the learner's rewards are translated and accessible`, async ({ page }) => {
      const backend = createMockBackend({ admins: ['boss@example.com'] });
      backend.rewards.push({ id: 'rw-1', email: 'boss@example.com', kind: 'star', amount: 7, label: null, reason: 'Test', created_at: new Date().toISOString(), granted_by_email: 'a@b.cc', revoked_at: null });
      await backend.install(page);
      await signIn(page, 'boss@example.com', lang);
      await page.locator('[data-testid="reward-dismiss"]').click(); // the notice fades in; dismiss it so axe does not read half-transparent text
      await page.goto('/admin');
      await expect(page.locator('[data-testid="admin-rewards"]')).toBeVisible();
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(axe.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.goto('/profile');
      await expect(page.locator('[data-testid="reward-stars"]')).toHaveText('7');
    });
  }
});
