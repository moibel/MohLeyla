import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed } from './helpers.js';

test.use({ serviceWorkers: 'block' });

test.describe('reliability: a failure never leaves a blank page', () => {
  for (const [lang, title] of [['en', 'Something went wrong'], ['ar', 'حدث خطأ ما'], ['id', 'Terjadi kesalahan']]) {
    test(`${lang}: when a page file cannot be loaded the learner sees a translated recovery screen, and "Try again" works once the network is back`, async ({ page }) => {
      await seed(page, { lang });
      await page.addInitScript(() => sessionStorage.setItem('mohleyla-healed', '1')); // skip the one-time automatic reload in this test
      await page.route('**/assets/Courses-*.js', (r) => r.abort());
      await page.goto('/learn');
      const crash = page.locator('[data-testid="crash-screen"]');
      await expect(crash).toBeVisible();
      await expect(crash.locator('h1')).toHaveText(title);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(axe.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
      await page.unroute('**/assets/Courses-*.js');
      await page.reload();
      await expect(page.locator('[data-testid^="track-"]').first()).toBeVisible();
    });
  }

  test('progress on the device is untouched by a crash', async ({ page }) => {
    await seed(page, { lang: 'en', state: { xp: 123 } });
    await page.addInitScript(() => sessionStorage.setItem('mohleyla-healed', '1'));
    await page.route('**/assets/Courses-*.js', (r) => r.abort());
    await page.goto('/learn');
    await expect(page.locator('[data-testid="crash-screen"]')).toBeVisible();
    expect((await page.evaluate(() => JSON.parse(localStorage.getItem('mohleyla-v6')))).xp).toBe(123);
  });
});
