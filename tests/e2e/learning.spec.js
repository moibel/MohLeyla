import { test, expect } from '@playwright/test';
import { seed, getLesson, playThrough } from './helpers.js';

const state = () => JSON.parse(localStorage.getItem('mohleyla-v6'));

test.describe('learning flow & progress', () => {
  test('completes a lesson, awards XP once, and persists after reload', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const lesson = getLesson('ar-01');
    await page.goto('/lesson/ar-01');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Greetings');
    await expect(page.locator('[data-testid="overview"]')).toContainText('What you will learn');
    await playThrough(page, lesson, 'en');
    await expect(page.locator('[data-testid="xp-earned"]')).toHaveText('+70');
    expect((await page.evaluate(state)).xp).toBe(70);
    await page.reload();
    expect((await page.evaluate(state)).xp).toBe(70);
    await expect(page.locator('.stat-xp')).toContainText('70');
    // repeating the lesson must not award XP again
    await page.goto('/lesson/ar-01');
    await playThrough(page, lesson, 'en');
    await expect(page.locator('[data-testid="xp-earned"]')).toHaveText('+0');
    await expect(page.locator('[data-testid="result"]')).toContainText('first time');
    expect((await page.evaluate(state)).xp).toBe(70);
  });

  test('a wrong answer is explained, comes back for a second chance, and removes the perfect bonus', async ({ page }) => {
    await seed(page, { lang: 'id' });
    const lesson = getLesson('en-01');
    await page.goto('/lesson/en-01');
    await playThrough(page, lesson, 'id', { wrongFirst: true });
    await expect(page.locator('[data-testid="xp-earned"]')).toHaveText('+50');
  });

  test('Saudi lesson works in Arabic UI and shows the honest audio note', async ({ page }) => {
    await seed(page, { lang: 'ar' });
    const lesson = getLesson('sa-01');
    await page.goto('/lesson/sa-01');
    await page.locator('[data-testid="start-learn"]').click();
    await expect(page.locator('[data-testid="word-card"]')).toContainText('الفصحى');
    await expect(page.locator('.note-small').first()).toContainText('لا يحاكي لهجة السعودية');
    await page.locator('[data-testid="save-word"]').click();
    expect(Object.keys((await page.evaluate(state)).saved)).toContain(lesson.items[0].id);
  });

  test('every lesson page loads (all 240)', async ({ page }) => {
    test.setTimeout(600_000);
    test.setTimeout(480_000);
    await seed(page, { lang: 'en' });
    const ids = [];
    const sizes = { ar: 30, sa: 30, en: 30, id: 30, eg: 30, fr: 30, es: 30, zh: 30 };
    for (const [t, size] of Object.entries(sizes)) for (let n = 1; n <= size; n++) ids.push(`${t}-${String(n).padStart(2, '0')}`);
    const meta = await (await page.request.get('/')).text(); void meta;
    for (const id of ids) {
      await page.goto(`/lesson/${id}`);
      await expect(page.locator('[data-testid="overview"]'), id).toBeVisible();
      await page.locator('[data-testid="start-learn"]').click();
      await expect(page.locator('[data-testid="word-card"]'), id).toBeVisible();
    }
  });

  test('vocabulary: save, search, filter, remove; review session updates spaced repetition', async ({ page }) => {
    await seed(page, { lang: 'en', state: { saved: { a1: 1, e1: 1 } } });
    await page.goto('/words');
    await expect(page.locator('[data-testid="vocab-card"]')).toHaveCount(2);
    await page.locator('[data-testid="vocab-search"]').fill('hello');
    await expect(page.locator('[data-testid="vocab-card"]')).toHaveCount(2);
    await page.locator('[data-testid="vocab-search"]').fill('zzzz');
    await expect(page.locator('.empty')).toBeVisible();
    await page.locator('[data-testid="vocab-search"]').fill('');
    await page.locator('select[aria-label="Language"]').selectOption('en');
    await expect(page.locator('[data-testid="vocab-card"]')).toHaveCount(1);
    await page.locator('[data-testid="vocab-card"] button[aria-pressed="true"]').click();
    await expect(page.locator('[data-testid="vocab-card"]')).toHaveCount(0);

    await page.goto('/review');
    await page.locator('[data-testid="start-review"]').click();
    await page.locator('[data-testid="reveal"]').click();
    await page.locator('[data-testid="knew"]').click();
    await expect(page.locator('[data-testid="review-result"]')).toBeVisible();
    const s = await page.evaluate(state);
    expect(s.srs.a1.reps).toBe(1);
    expect(s.stats.reviewSessions).toBe(1);
  });
});

test.describe('legacy progress migration', () => {
  test('v5 localStorage progress is preserved and shown', async ({ page }) => {
    await seed(page, { lang: 'id', legacy: { completed: ['ar-01', 'en-02', 'id-03'], saved: ['a1', 'e5', 'idx031'], xp: 150 } });
    await page.goto('/progress');
    await expect(page.locator('.stat-xp')).toContainText('150');
    await expect(page.locator('.progress-hero')).toContainText('3 / 240');
    const s = await page.evaluate(state);
    expect(Object.keys(s.completed).sort()).toEqual(['ar-01', 'en-02', 'id-03']);
    expect(Object.keys(s.saved).sort()).toEqual(['a1', 'e5', 'idx031']);
    expect(await page.evaluate(() => localStorage.getItem('mohleyla-v1'))).not.toBeNull();
    await page.goto('/words');
    await expect(page.locator('[data-testid="vocab-card"]')).toHaveCount(3);
    await expect(page.locator('.onboarding')).toHaveCount(0);
  });

  test('existing learners are not shown onboarding', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('mohleyla-v1', JSON.stringify({ completed: ['ar-01'], saved: [], xp: 50 })); });
    await page.goto('/');
    await expect(page.locator('[data-testid="onboarding"]')).toHaveCount(0);
  });

  test('new learners see onboarding and can start', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="onboarding"]')).toBeVisible();
    await page.getByRole('button', { name: /start learning/i }).last().click();
    await expect(page.locator('[data-testid="onboarding"]')).toBeHidden();
  });
});
