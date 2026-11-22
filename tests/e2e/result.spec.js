import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, getLesson, playThrough, solveExercise } from './helpers.js';

test.use({ serviceWorkers: 'block' });

test.describe('lesson result: today’s goal, streak and new achievements', () => {
  for (const lang of ['en', 'ar', 'id']) {
    test(`${lang}: finishing a first lesson shows the streak, daily goal and the "first lesson" achievement, accessibly`, async ({ page }) => {
      await seed(page, { lang });
      const lesson = getLesson('en-01');
      await page.goto('/lesson/en-01');
      await playThrough(page, lesson, lang);
      const today = page.locator('[data-testid="today-card"]');
      await expect(today).toBeVisible();
      await expect(page.locator('[data-testid="goal-line"]')).toContainText('50');
      await expect(page.locator('[data-testid="new-achievements"]')).toBeVisible();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
    });
  }
  test('repeating a lesson does not announce the same achievement again', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const lesson = getLesson('en-01');
    await page.goto('/lesson/en-01');
    await playThrough(page, lesson, 'en');
    await expect(page.locator('[data-testid="new-achievements"]')).toBeVisible();
    await page.getByRole('button', { name: /repeat/i }).click();
    for (let i = 0; i < lesson.items.length; i++) await page.locator('[data-testid="next-word"]').click();
    for (let guard = 0; guard < 40 && !(await page.locator('[data-testid="result"]').count()); guard++) {
      await solveExercise(page, lesson, 'en');
      await page.locator('[data-testid="feedback"]').waitFor();
      await page.locator('[data-testid="continue"]').click();
    }
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
    await expect(page.locator('[data-testid="new-achievements"]')).toHaveCount(0);
  });
});
