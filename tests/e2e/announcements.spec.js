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
const axeOk = async (page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
};

test.describe('admin announcements (mocked Supabase API; real rules in supabase/tests/announcements.test.sql)', () => {
  test('an admin posts in English and Arabic; each learner sees their language (others see English); closing it hides it on Home but keeps it on the profile; archiving removes it', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin');
    const panel = page.locator('[data-testid="admin-news"]');
    await expect(panel).toBeVisible();
    await panel.locator('[data-testid="news-title-en"]').fill('Eid holiday');
    await panel.locator('[data-testid="news-body-en"]').fill('No live classes this week.');
    await panel.locator('[data-testid="news-title-ar"]').fill('إجازة العيد');
    await panel.locator('[data-testid="news-body-ar"]').fill('لا حصص مباشرة هذا الأسبوع.');
    await panel.locator('[data-testid="news-post"]').click();
    await expect(panel.locator('[data-testid="news-msg"]')).toContainText('posted');
    await expect(panel.locator('[data-testid="news-row"]')).toHaveCount(1);

    const ar = await newDevice(browser, backend, 'amal@example.com', 'ar');
    await ar.page.goto('/');
    await expect(ar.page.locator('[data-testid="news-card"]')).toContainText('إجازة العيد');
    await axeOk(ar.page);
    const id = await newDevice(browser, backend, 'budi@example.com', 'id');
    await id.page.goto('/');
    await expect(id.page.locator('[data-testid="news-card"]')).toContainText('Eid holiday'); // no Indonesian text: falls back to English

    await ar.page.locator('[data-testid="news-dismiss"]').click();
    await expect(ar.page.locator('[data-testid="news-card"]')).toHaveCount(0);
    await ar.page.reload();
    await expect(ar.page.locator('[data-testid="news-card"]')).toHaveCount(0);
    await ar.page.goto('/profile');
    await expect(ar.page.locator('[data-testid="news-card"]')).toContainText('إجازة العيد'); // still readable on the profile

    await panel.locator('[data-testid="news-archive"]').click();
    await page.locator('[data-testid="news-confirm-yes"]').click();
    await expect(panel.locator('[data-testid="news-row"]')).toContainText('Archived');
    await id.page.reload();
    await expect(id.page.locator('[data-testid="news-card"]')).toHaveCount(0);
    await ar.ctx.close(); await id.ctx.close();
  });

  test('a class announcement is shown only to the students of that class', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    const teacher = backend.addUser('tee@example.com', { role: 'teacher' });
    const inClass = backend.addUser('in@example.com');
    backend.addUser('out@example.com');
    backend.classes.push({ id: 'class-1', name: 'Beginners', code: 'ABCD1234', teacher_id: teacher.id, created_at: new Date().toISOString() });
    backend.members.push({ class_id: 'class-1', student_id: inClass.id, joined_at: new Date().toISOString() });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin');
    const panel = page.locator('[data-testid="admin-news"]');
    await expect(panel.locator('[data-testid="news-audience"] option')).toHaveCount(2); // everyone + Beginners
    await panel.locator('[data-testid="news-audience"]').selectOption('class-1');
    await panel.locator('[data-testid="news-title-en"]').fill('Homework');
    await panel.locator('[data-testid="news-body-en"]').fill('Finish lesson 3.');
    await panel.locator('[data-testid="news-post"]').click();
    await expect(panel.locator('[data-testid="news-msg"]')).toContainText('posted');
    const a = await newDevice(browser, backend, 'in@example.com');
    await a.page.goto('/');
    await expect(a.page.locator('[data-testid="news-card"]')).toContainText('Homework');
    await expect(a.page.locator('[data-testid="news-card"]')).toContainText('Beginners');
    const b = await newDevice(browser, backend, 'out@example.com');
    await b.page.goto('/');
    await expect(b.page.locator('[data-testid="news-card"]')).toHaveCount(0);
    await a.ctx.close(); await b.ctx.close();
  });

  test('a title without a message is refused with a clear message; teachers cannot reach the form', async ({ page }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin');
    const panel = page.locator('[data-testid="admin-news"]');
    await panel.locator('[data-testid="news-title-en"]').fill('Only a title');
    await panel.locator('[data-testid="news-post"]').click();
    await expect(panel.locator('[data-testid="news-msg"]')).toContainText('title and a message');
    expect(backend.announcements).toHaveLength(0);
  });

  for (const lang of ['ar', 'id']) {
    test(`${lang}: the announcements admin panel is translated, accessible and fits the screen`, async ({ page }) => {
      const backend = createMockBackend({ admins: ['boss@example.com'] });
      await backend.install(page);
      await signIn(page, 'boss@example.com', lang);
      await page.goto('/admin');
      await expect(page.locator('[data-testid="admin-news"]')).toBeVisible();
      await axeOk(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});
