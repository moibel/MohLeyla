import { test, expect } from '@playwright/test';
import { seed, getLesson, solveExercise } from './helpers.js';

test.use({ serviceWorkers: 'block' });

async function toPractice(page, lesson) {
  await page.locator('[data-testid="start-learn"]').click();
  for (let i = 0; i < lesson.items.length; i++) await page.locator('[data-testid="next-word"]').click();
}

test.describe('exercise screens: keyboard and encouragement', () => {
  test('number keys answer multiple-choice questions and Enter continues', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const lesson = getLesson('en-01');
    await page.goto('/lesson/en-01');
    await toPractice(page, lesson);
    for (let guard = 0; guard < 12 && !(await page.locator('[data-testid="opt-correct"]').count()); guard++) {
      await solveExercise(page, lesson, 'en');
      await page.locator('[data-testid="feedback"]').waitFor();
      await page.locator('[data-testid="continue"]').click();
    }
    const opts = page.locator('[data-testid="opt"], [data-testid="opt-correct"]');
    const idx = await opts.evaluateAll((els) => els.findIndex((e) => e.dataset.testid === 'opt-correct'));
    await page.keyboard.press(String(idx + 1));
    await expect(page.locator('[data-testid="feedback"]')).toHaveClass(/good/);
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="feedback"]')).toHaveCount(0);
  });

  test('three correct answers in a row show the "in a row" chip; a mistake clears it', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const lesson = getLesson('en-01');
    await page.goto('/lesson/en-01');
    await toPractice(page, lesson);
    for (let i = 0; i < 3; i++) {
      await solveExercise(page, lesson, 'en');
      await page.locator('[data-testid="feedback"]').waitFor();
      if (i < 2) await page.locator('[data-testid="continue"]').click();
    }
    await expect(page.locator('[data-testid="combo"]')).toContainText('3');
    await page.locator('[data-testid="continue"]').click();
    // answer correctly until a multiple-choice question appears, then get it wrong
    for (let guard = 0; guard < 12 && !(await page.locator('[data-testid="opt"]').count()); guard++) {
      await solveExercise(page, lesson, 'en');
      await page.locator('[data-testid="feedback"]').waitFor();
      await page.locator('[data-testid="continue"]').click();
    }
    await page.locator('[data-testid="opt"]').first().click();
    await expect(page.locator('[data-testid="feedback"]')).toHaveClass(/bad/);
    await expect(page.locator('[data-testid="combo"]')).toHaveCount(0);
  });
});
