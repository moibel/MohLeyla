import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, getLesson, playThrough } from './helpers.js';

test.use({ serviceWorkers: 'block' });
const NEW = ['eg', 'fr', 'es', 'zh', 'de', 'tl'];

test.describe('new beta languages: Egyptian Arabic, French, Spanish, Chinese, German, Tagalog', () => {
  for (const lang of ['en', 'ar', 'id']) {
    test(`${lang}: the home page offers all ten paths and marks exactly the six new ones Beta`, async ({ page }) => {
      await seed(page, { lang });
      await page.goto('/');
      await expect(page.locator('.track-grid .track-card')).toHaveCount(10);
      for (const t of NEW) await expect(page.locator(`[data-testid="beta-${t}"]`)).toBeVisible();
      for (const t of ['ar', 'sa', 'en', 'id']) await expect(page.locator(`[data-testid="beta-${t}"]`)).toHaveCount(0);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(axe.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
    });
  }

  for (const track of NEW) {
    test(`${track}: the course page shows 30 lessons and the Beta note; a lesson plays through to a result`, async ({ page }) => {
      test.setTimeout(120_000);
      await seed(page, { lang: 'en' });
      await page.goto(`/learn?track=${track}`);
      await expect(page.locator('[data-testid="beta-note"]')).toContainText('not yet been reviewed by a native speaker');
      await expect(page.locator('[data-testid="track-progress"]')).toContainText('30');
      const lesson = getLesson(`${track}-01`);
      await page.goto(`/lesson/${track}-01`);
      await expect(page.locator('h1')).toHaveText(lesson.title.en);
      await playThrough(page, lesson, 'en');
      await expect(page.locator('[data-testid="result"]')).toBeVisible();
    });
  }

  test('Chinese words show characters with pinyin, are tagged as Chinese for screen readers, and there is no word-order exercise', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await page.goto('/lesson/zh-02');
    await page.locator('[data-testid="start-learn"]').click();
    const lesson = getLesson('zh-02');
    const first = lesson.items[0];
    await expect(page.locator('.word-target')).toContainText(first.target);
    expect(await page.locator('.word-target').first().evaluate((e) => e.getAttribute('lang'))).toBe('zh');
    await expect(page.locator('.translit-text').first()).toContainText(first.translit);
    // practice: no "tiles" exercise ever appears
    for (let i = 0; i < lesson.items.length; i++) await page.locator('[data-testid="next-word"]').click();
    await expect(page.locator('[data-testid="tile"]')).toHaveCount(0);
  });

  test('Egyptian Arabic says honestly that the voice is Standard Arabic, like the Saudi path', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await page.goto('/lesson/eg-02');
    await page.locator('[data-testid="start-learn"]').click();
    await expect(page.locator('.note-small').first()).toContainText('does not reproduce the Egyptian dialect accent');
    expect(await page.locator('.word-target').first().evaluate((e) => e.getAttribute('dir'))).toBe('rtl');
  });

  test('the Arabic interface lists the English, French, Spanish and Chinese paths first and the Arabic paths last', async ({ page }) => {
    await seed(page, { lang: 'ar' });
    await page.goto('/learn');
    await page.locator('[role="tab"]').first().waitFor();
    const order = await page.locator('[role="tab"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('track-', '')));
    expect(order).toEqual(['en', 'id', 'fr', 'es', 'de', 'tl', 'zh', 'ar', 'sa', 'eg']);
  });
});
