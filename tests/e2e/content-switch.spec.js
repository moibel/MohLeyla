import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, dismissNamePrompt, lessonsOf } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

test.use({ serviceWorkers: 'block' });
const ordered = (track) => [...lessonsOf(track)].sort((a, b) => a.order - b.order);

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

test.describe('switching lessons and paths on or off (mocked Supabase API; real rules in supabase/tests/content_switch.test.sql)', () => {
  test('an admin hides a lesson and a whole path; learners no longer see them; showing them again brings them back', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin?tab=content');
    const panel = page.locator('[data-testid="admin-content"]');
    await expect(panel).toBeVisible();
    const lessonId = ordered('en')[0].id;

    const learner = await newDevice(browser, backend, 'sara@example.com');
    await learner.page.goto('/learn?track=en');
    await expect(learner.page.locator(`[data-testid="lesson-${lessonId}"]`)).toBeVisible();
    await expect(learner.page.locator('[data-testid="track-progress"]')).toContainText('30');

    // hide one lesson
    await panel.locator('[data-testid="content-track-en"] summary').click();
    await panel.locator(`[data-testid="lesson-switch-${lessonId}"]`).click();
    await expect(panel.locator(`[data-testid="lesson-switch-${lessonId}"]`)).not.toBeChecked();
    await expect(panel.locator('[data-testid="content-msg"]')).toContainText('hidden from learners');
    await learner.page.reload();
    await expect(learner.page.locator(`[data-testid="lesson-${lessonId}"]`)).toHaveCount(0);
    await expect(learner.page.locator('[data-testid="track-progress"]')).toContainText('29');
    await learner.page.goto(`/lesson/${lessonId}`);
    await expect(learner.page.getByText('not available right now')).toBeVisible(); // a bookmarked link explains instead of showing a blank

    // hide a whole path
    await panel.locator('[data-testid="content-track-id"] summary').click();
    await panel.locator('[data-testid="track-switch-id"]').click();
    await expect(panel.locator('[data-testid="track-switch-id"]')).not.toBeChecked();
    await learner.page.goto('/learn');
    await expect(learner.page.locator('[data-testid="track-id"]')).toHaveCount(0);
    await learner.page.goto('/');
    await expect(learner.page.locator('.track-grid .track-card')).toHaveCount(3);

    // show everything again
    await panel.locator('[data-testid="track-switch-id"]').click();
    await expect(panel.locator('[data-testid="track-switch-id"]')).toBeChecked();
    await panel.locator(`[data-testid="lesson-switch-${lessonId}"]`).click();
    await expect(panel.locator(`[data-testid="lesson-switch-${lessonId}"]`)).toBeChecked();
    await learner.page.goto('/learn?track=en');
    await expect(learner.page.locator(`[data-testid="lesson-${lessonId}"]`)).toBeVisible();
    await learner.page.goto('/');
    await expect(learner.page.locator('.track-grid .track-card')).toHaveCount(4);
    await learner.ctx.close();
  });

  test('a hidden lesson is skipped as the "continue" target but the learner keeps their progress for it', async ({ page }) => {
    const backend = createMockBackend();
    const en = ordered('en');
    backend.contentOff.push({ kind: 'lesson', key: en[0].id });
    await backend.install(page);
    await seed(page, { lang: 'en', state: { completed: { [en[1].id]: { at: 1, best: 90, perfect: false, attempts: 1 } }, settings: { lastTrack: 'en' } } });
    await page.goto('/learn?track=en');
    await expect(page.locator(`[data-testid="lesson-${en[0].id}"]`)).toHaveCount(0); // the hidden list has arrived
    await page.locator('[data-testid="continue-track"]').click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${en[2].id}$`)); // not the hidden first lesson
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('mohleyla-v6')));
    expect(Object.keys(st.completed)).toContain(en[1].id);
  });

  test('the hidden list is remembered on the device, so a hidden path stays hidden when the server cannot be reached', async ({ page }) => {
    const backend = createMockBackend();
    backend.contentOff.push({ kind: 'track', key: 'sa' });
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await page.goto('/learn');
    await expect(page.locator('[data-testid="track-ar"]')).toBeVisible(); // the page has drawn, so "no Saudi tab" below means it was really hidden
    await expect(page.locator('[data-testid="track-sa"]')).toHaveCount(0);
    await page.route('**/rest/v1/rpc/content_disabled', (r) => r.abort());
    await page.reload();
    await expect(page.locator('[data-testid="track-ar"]')).toBeVisible();
    await expect(page.locator('[data-testid="track-sa"]')).toHaveCount(0);
  });

  test('teachers and students cannot see the switches', async ({ page }) => {
    const backend = createMockBackend({ teachers: ['tee@example.com'] });
    await backend.install(page);
    await signIn(page, 'tee@example.com');
    await page.goto('/admin?tab=content');
    await expect(page.locator('[data-testid="not-allowed"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-content"]')).toHaveCount(0);
  });

  for (const lang of ['ar', 'id']) {
    test(`${lang}: the switches panel is translated, accessible and fits the screen`, async ({ page }) => {
      const backend = createMockBackend({ admins: ['boss@example.com'] });
      await backend.install(page);
      await signIn(page, 'boss@example.com', lang);
      await page.goto('/admin?tab=content');
      const panel = page.locator('[data-testid="admin-content"]');
      await expect(panel).toBeVisible();
      await panel.locator('[data-testid="content-track-ar"] summary').click();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});
