import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, completeSetup } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

// Password sign-in for the app stores' reviewers, on the build that requires sign-in (port 4174).
test.use({ baseURL: 'http://127.0.0.1:4174', serviceWorkers: 'block' });
const WHO = 'mohleyla.support+review-student@gmail.com';
const PASS = 'test-only-long-pass-1';
const backendWith = () => createMockBackend({ passwords: { [WHO]: PASS } });

test.describe('reviewer sign-in', () => {
  test('is tucked behind its own button; a wrong password is refused; the right one opens the normal set-up', async ({ page }) => {
    const backend = backendWith();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await expect(page.locator('[data-testid="acc-pw-form"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await page.locator('[data-testid="acc-pw-toggle"]').click();
    await expect(page.locator('[data-testid="acc-email"], [data-testid="acc-google"]')).toHaveCount(0);
    await page.locator('[data-testid="acc-pw-email"]').fill(WHO);
    await page.locator('[data-testid="acc-pw-password"]').fill('wrong-password');
    await page.locator('[data-testid="acc-pw-submit"]').click();
    await expect(page.locator('[data-testid="acc-error"]')).toContainText('do not match');
    await expect(page.locator('[data-testid="gate"]')).toBeVisible();
    await page.locator('[data-testid="acc-pw-password"]').fill(PASS);
    await page.locator('[data-testid="acc-pw-submit"]').click();
    await expect(page.locator('[data-testid="welcome"]')).toBeVisible(); // reviewers see the 13+ and terms step like everyone
    await completeSetup(page);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(PASS);
    await page.goto('/settings');
    await page.locator('[data-testid="acc-signout"]').click();
    await expect(page.locator('[data-testid="gate"]')).toBeVisible();
    expect(backend.stats.otps).toBe(0); // no email was needed
  });

  test('an ordinary account (no password) cannot be entered this way, and going back restores the other options', async ({ page }) => {
    const backend = backendWith();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await page.locator('[data-testid="acc-pw-toggle"]').click();
    await page.locator('[data-testid="acc-pw-email"]').fill('learner@example.com');
    await page.locator('[data-testid="acc-pw-password"]').fill(PASS);
    await page.locator('[data-testid="acc-pw-submit"]').click();
    await expect(page.locator('[data-testid="acc-error"]')).toContainText('do not match');
    await page.locator('[data-testid="acc-pw-back"]').click();
    await expect(page.locator('[data-testid="acc-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="acc-error"]')).toHaveCount(0);
  });

  for (const lang of ['en', 'ar', 'id']) {
    test(`${lang}: the password form is translated, accessible and fits a small phone`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await backendWith().install(page);
      await seed(page, { lang });
      await page.goto('/');
      await page.locator('[data-testid="acc-pw-toggle"]').click();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (lang === 'ar') expect(((await page.locator('[data-testid="acc-pw-form"]').innerText()).match(/[A-Za-z]{3,}/g) || []).filter((w) => !['Google', 'Apple', 'MohLeyla'].includes(w))).toEqual([]);
    });
  }
});
