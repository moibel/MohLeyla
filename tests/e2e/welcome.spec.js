import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, completeSetup } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

// The set-up after the first sign-in (build with required sign-in, port 4174).
test.use({ baseURL: 'http://127.0.0.1:4174', serviceWorkers: 'block' });
const stored = () => JSON.parse(localStorage.getItem('mohleyla-v6'));

async function signIn(page, email) {
  await page.locator('[data-testid="acc-email"]').fill(email);
  await page.locator('[data-testid="acc-send"]').click();
  await page.locator('[data-testid="acc-code"]').fill('123456');
  await page.locator('[data-testid="acc-verify"]').click();
}

test.describe('set-up before the first lesson', () => {
  test('lessons stay closed until the person confirms 13+, accepts the terms and chooses languages and levels', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en', state: { settings: { onboarded: false } } });
    await page.goto('/lesson/de-01');
    await signIn(page, 'new@example.com');
    const next = page.locator('[data-testid="wl-next"]');
    await expect(page.locator('[data-testid="welcome"]')).toBeVisible();
    await expect(page.locator('.sidebar, .bottom-nav')).toHaveCount(0);
    await expect(next).toBeDisabled();
    await page.locator('[data-testid="wl-age"]').check();
    await expect(next).toBeDisabled(); // the terms are required too
    await page.locator('[data-testid="wl-terms"]').check();
    await next.click();
    await expect(next).toBeDisabled(); // at least one language
    await page.locator('[data-testid="wl-track-tl"]').check();
    await page.locator('[data-testid="wl-track-de"]').check();
    await next.click();
    await page.locator('[data-testid="wl-level-de-intermediate"]').check();
    await next.click();
    await page.locator('[data-testid="wl-finish"]').click();
    await expect(page.locator('[data-testid="welcome"]')).toHaveCount(0);
    expect((await page.evaluate(stored)).settings.onboarded).toBe(true);
    // the page they first asked for (a German lesson) now opens, so it may already have become the last-used language
    expect(['tl', 'de']).toContain((await page.evaluate(stored)).settings.lastTrack);
    // the chosen languages come first, and German starts at the chosen level
    await page.goto('/');
    await expect(page.locator('.track-grid .track-card').first()).toHaveAttribute('href', '/learn?track=tl');
    await expect(page.locator('.track-grid .track-card').nth(1)).toHaveAttribute('href', '/learn?track=de');
    await expect(page.locator('a[href="/lesson/de-21"]').first()).toBeVisible();
    // saved in the account: not asked again after a reload, and the plan can be changed in Settings
    await page.reload();
    await expect(page.locator('[data-testid="welcome"]')).toHaveCount(0);
    await page.goto('/settings');
    await expect(page.locator('[data-testid="plan-section"]')).toContainText('German');
    await page.locator('[data-testid="plan-edit"]').click();
    await expect(page.locator('[data-testid="wl-age"]')).toHaveCount(0); // age and terms are not asked again
    await expect(page.locator('[data-testid="wl-track-de"]')).toBeChecked();
  });

  for (const lang of ['en', 'ar', 'id']) {
    test(`${lang}: every set-up step is accessible and fits a phone`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      const backend = createMockBackend();
      await backend.install(page);
      await seed(page, { lang });
      await page.goto('/');
      await signIn(page, `${lang}@example.com`);
      for (let step = 0; step < 4; step++) {
        await expect(page.locator('[data-testid="welcome"]')).toBeVisible();
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' ')), `step ${step}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `step ${step}`).toBe(true);
        if (lang === 'ar') expect(((await page.locator('.welcome-card').innerText()).match(/[A-Za-z]{3,}/g) || []).filter((w) => w !== 'MohLeyla')).toEqual([]);
        if (step === 0) { await page.locator('[data-testid="wl-age"]').check(); await page.locator('[data-testid="wl-terms"]').check(); }
        if (step === 1) await page.locator('[data-testid="wl-track-ar"]').check();
        if (step < 3) await page.locator('[data-testid="wl-next"]').click();
      }
    });
  }

  test('the next person on the same device does their own set-up and gets none of the previous person\'s progress', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await signIn(page, 'first@example.com');
    await completeSetup(page, { tracks: ['fr'] });
    await page.goto('/settings');
    await page.locator('[data-testid="acc-signout"]').click();
    await signIn(page, 'second@example.com');
    await expect(page.locator('[data-testid="welcome"]')).toBeVisible();
    await page.locator('[data-testid="wl-age"]').check();
    await page.locator('[data-testid="wl-terms"]').check();
    await page.locator('[data-testid="wl-next"]').click();
    await expect(page.locator('.welcome-langs input:checked')).toHaveCount(0);
  });
});
