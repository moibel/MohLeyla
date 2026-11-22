import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, dismissNamePrompt } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

test.use({ serviceWorkers: 'block' });

async function adminPage(page, lang = 'en') {
  const backend = createMockBackend({ admins: ['boss@example.com'] });
  for (let i = 0; i < 12; i++) backend.addUser(`user${i}@example.com`, { summary: { xp: i * 10, lessons_done: i } });
  await backend.install(page);
  await seed(page, { lang });
  await page.goto('/settings');
  await page.locator('[data-testid="acc-email"]').fill('boss@example.com');
  await page.locator('[data-testid="acc-send"]').click();
  await page.locator('[data-testid="acc-code"]').fill('123456');
  await page.locator('[data-testid="acc-verify"]').click();
  await expect(page.locator('[data-testid="avatar-link"]')).toBeVisible();
  await dismissNamePrompt(page);
  return backend;
}

test.describe('admin page layout (it must not jump, overflow sideways, or show broken text)', () => {
  for (const [name, size] of [['phone', { width: 390, height: 844 }], ['laptop', { width: 1366, height: 800 }]]) {
    for (const tab of ['users', 'chats', 'content', 'news', 'rewards']) {
      test(`${name}: the ${tab} tab fits the screen width and has no accessibility violations`, async ({ page }) => {
        await page.setViewportSize(size);
        await adminPage(page);
        await page.goto(tab === 'users' ? '/admin' : `/admin?tab=${tab}`);
        await expect(page.locator(`[data-testid="admin-panel-${tab}"]`)).toBeVisible();
        if (tab === 'users') await expect(page.locator('[data-testid="user-row"]').first()).toBeVisible();
        if (tab === 'content') await page.locator('[data-testid="content-track-ar"] summary').click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'page is wider than the screen').toBe(true);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
      });
    }
  }

  test('the people count is a real sentence, never a raw placeholder', async ({ page }) => {
    await adminPage(page);
    await page.goto('/admin');
    await expect(page.locator('[data-testid="user-row"]').first()).toBeVisible();
    const text = await page.locator('[data-testid="admin-page"]').innerText();
    expect(text).not.toMatch(/\{\{|\}\}/);
    expect(text).toMatch(/Showing \d+ of \d+/);
  });

  test('loading the people list does not push the page around (layout shift stays small)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await adminPage(page);
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto('/admin');
    await expect(page.locator('[data-testid="user-row"]').first()).toBeVisible();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);
  });

  test('tabs work with the keyboard and the address; "give reward" on a person opens the Rewards tab with their email', async ({ page }) => {
    await adminPage(page);
    await page.goto('/admin');
    await page.locator('[data-testid="admin-tab-users"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="admin-panel-chats"]')).toBeVisible();
    await expect(page).toHaveURL(/tab=chats/);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="admin-panel-content"]')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="admin-panel-rewards"]')).toBeVisible();
    await page.locator('[data-testid="admin-tab-users"]').click();
    await page.locator('[data-testid="give-reward"]').first().click();
    await expect(page.locator('[data-testid="admin-panel-rewards"]')).toBeVisible();
    await expect(page.locator('[data-testid="reward-email"]')).not.toHaveValue('');
  });
});
