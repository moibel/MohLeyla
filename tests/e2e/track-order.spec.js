import { test, expect } from '@playwright/test';
import { seed } from './helpers.js';

test.use({ serviceWorkers: 'block' });
const order = async (page) => { await page.locator('[role="tab"]').first().waitFor(); return page.locator('[role="tab"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('track-', ''))); };

test.describe('learning paths are ordered by interface language', () => {
  test('Arabic interface: English and Indonesian first, Arabic paths last; default path is English', async ({ page }) => {
    await seed(page, { lang: 'ar' });
    await page.goto('/learn');
    expect(await order(page)).toEqual(['en', 'id', 'fr', 'es', 'de', 'tl', 'zh', 'ar', 'sa', 'eg']);
    await expect(page.locator('[data-testid="track-en"]')).toHaveAttribute('aria-selected', 'true');
    await page.goto('/');
    const cards = await page.locator('.track-grid .track-card').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(cards.map((h) => h.split('=')[1])).toEqual(['en', 'id', 'fr', 'es', 'de', 'tl', 'zh', 'ar', 'sa', 'eg']);
  });
  for (const lang of ['en', 'id']) {
    test(`${lang} interface: Arabic paths first; default path is Arabic`, async ({ page }) => {
      await seed(page, { lang });
      await page.goto('/learn');
      expect(await order(page)).toEqual(['ar', 'sa', 'eg', 'en', 'id', 'fr', 'es', 'de', 'tl', 'zh']);
      await expect(page.locator('[data-testid="track-ar"]')).toHaveAttribute('aria-selected', 'true');
    });
  }
  test('a learner who already chose a path keeps it, whatever the interface language', async ({ page }) => {
    await seed(page, { lang: 'ar', state: { settings: { lastTrack: 'sa' } } });
    await page.goto('/learn');
    await expect(page.locator('[data-testid="track-sa"]')).toHaveAttribute('aria-selected', 'true');
  });
  test('first-run: the suggested path follows the interface language until the learner picks one', async ({ page }) => {
    await seed(page, { lang: 'ar', state: { settings: { onboarded: false } } });
    await page.goto('/');
    const dlg = page.locator('[data-testid="onboarding"]');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('input[name="ob-track"]:checked')).toHaveCount(1);
    expect(await dlg.locator('input[name="ob-track"]').evaluateAll((els) => els.findIndex((e) => e.checked))).toBe(0);
  });
});
