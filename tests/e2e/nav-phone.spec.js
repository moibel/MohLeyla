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

test.describe('phone navigation and spacing', () => {
  for (const lang of ['en', 'ar', 'id']) {
    for (const width of [360, 390]) {
      test(`${lang} @${width}px: signed-in phone bar has Messages and Notifications (with counts), fits, and nothing is cut off`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        const backend = createMockBackend();
        const boss = backend.addUser('boss@example.com', { role: 'admin', display_name: 'Boss' });
        const me = backend.addUser('amal@example.com', { display_name: 'Amal' });
        backend.conversations.push({ id: 'conv-1', a: boss.id, b: me.id, last_at: new Date().toISOString() });
        backend.chatMsgs.push({ id: 'm1', conv: 'conv-1', sender: boss.id, body: 'Hi Amal', created_at: new Date(Date.now() + 100).toISOString(), removed_at: null });
        await backend.install(page);
        await signIn(page, 'amal@example.com', lang);
        const items = page.locator('.bottom-nav .nav-item');
        await expect(items).toHaveCount(6);
        const hrefs = await items.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
        expect(hrefs).toEqual(['/', '/learn', '/review', '/progress', '/chat', '/notifications']);
        await expect(page.locator('.bottom-nav a[href="/chat"] .nav-badge')).toHaveText('1');
        // every label is fully visible: no label is wider than its tab
        const clipped = await items.evaluateAll((els) => els.filter((e) => { const s = e.querySelector('span:last-child'); return s && s.scrollWidth > s.clientWidth + 1; }).map((e) => e.getAttribute('href') + ' ' + e.innerText.trim()));
        expect(clipped, 'labels cut off').toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await expect(page.locator('[data-testid="bell"]')).toBeHidden(); // the top-bar bell is for wide screens; the bottom bar has Notifications
        await page.locator('.bottom-nav a[href="/chat"]').click();
        await expect(page.locator('[data-testid="chat-list-page"]')).toBeVisible();
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(axe.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
      });
    }
  }

  test('signed-out phone bar keeps My words; signed-in learners reach My words from the Learn page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await seed(page, { lang: 'en' });
    await page.goto('/');
    expect(await page.locator('.bottom-nav .nav-item').evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual(['/', '/learn', '/review', '/words', '/progress']);
    await page.goto('/learn');
    await page.locator('[data-testid="my-words-link"]').click();
    await expect(page).toHaveURL(/\/words$/);
  });

  test('the greeting has no stray space before the exclamation mark', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await signIn(page, 'amina@example.com');
    await page.goto('/');
    await expect(page.locator('[data-testid="greeting"]')).toHaveText(/Hi,\s\S+!$/);
  });
});
