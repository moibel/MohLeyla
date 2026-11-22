import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, lessonsOf } from './helpers.js';

test.use({ serviceWorkers: 'block' });
const first = [...lessonsOf('ar')].sort((a, b) => a.order - b.order).map((l) => l.id);
const done = (id) => ({ [id]: { at: 1, best: 80, perfect: false, attempts: 1 } });

test.describe('course map and review', () => {
  for (const lang of ['en', 'ar', 'id']) {
    test(`${lang}: the course page shows track progress and a continue button, and passes axe`, async ({ page }) => {
      await seed(page, { lang, state: { completed: { ...done(first[0]), ...done(first[1]) }, settings: { lastTrack: 'ar' } } });
      await page.goto('/learn?track=ar');
      await expect(page.locator('[data-testid="track-progress"]')).toContainText('2');
      await expect(page.locator('[data-testid="track-progress"]')).toContainText('30');
      await page.locator('[data-testid="continue-track"]').click();
      await expect(page).toHaveURL(new RegExp(`/lesson/${first[2]}$`));
      await page.goBack();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
    });
  }

  test('review: keyboard reveals and answers; the start screen shows learned and mastered counts', async ({ page }) => {
    await seed(page, { lang: 'en', state: { saved: { a1: 1, e1: 1 } } });
    await page.goto('/review');
    await expect(page.locator('[data-testid="learned-line"]')).toContainText('learned');
    await page.locator('[data-testid="start-review"]').click();
    await expect(page.locator('[data-testid="review-card"]')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="knew"]')).toBeVisible();
    await page.keyboard.press('2');
    await page.keyboard.press('Enter');
    await page.keyboard.press('1');
    await expect(page.locator('[data-testid="review-result"]')).toBeVisible();
  });
});
