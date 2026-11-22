import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed } from './helpers.js';

// Chromium's fake microphone produces a test tone, so MediaRecorder really records.
test.use({
  serviceWorkers: 'block',
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const state = () => JSON.parse(localStorage.getItem('mohleyla-v6'));
const openCard = async (page, id = 'en-01') => {
  await page.goto(`/lesson/${id}`);
  await page.locator('[data-testid="start-learn"]').click();
  await expect(page.locator('[data-testid="speaking"]')).toBeVisible();
};

test('records for real, plays it back, self-rates, and awards capped XP', async ({ page }) => {
  await page.addInitScript(() => {
    window.__tracks = [];
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => { const s = await orig(c); window.__tracks.push(...s.getTracks()); return s; };
    window.__plays = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push(this.src); return play.call(this); };
  });
  await seed(page, { lang: 'en' });
  await openCard(page);
  await page.locator('[data-testid="rec-start"]').click();
  await expect(page.locator('[data-testid="rec-stop"]')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="rec-stop"]').click();
  await expect(page.locator('[data-testid="rec-review"]')).toBeVisible();
  // microphone released after stopping
  expect(await page.evaluate(() => window.__tracks.length > 0 && window.__tracks.every((t) => t.readyState === 'ended'))).toBe(true);
  // the user's own clip plays (blob: url)
  await page.locator('[data-testid="rec-play"]').click();
  await expect.poll(() => page.evaluate(() => window.__plays.some((s) => s.startsWith('blob:')))).toBe(true);
  await page.locator('[data-testid="rate-close"]').click();
  await expect(page.locator('[data-testid="rated"]')).toBeVisible();
  const s = await page.evaluate(state);
  expect(Object.values(s.speaking)[0]).toMatchObject({ tries: 1, close: 1 });
  expect(s.xp).toBe(1);
  // nothing is persisted from the recording itself
  expect(await page.evaluate(() => JSON.stringify(localStorage).includes('blob:'))).toBe(false);
});

test('moving to the next word discards the recording and releases the mic', async ({ page }) => {
  await seed(page, { lang: 'en' });
  await openCard(page);
  await page.locator('[data-testid="rec-start"]').click();
  await page.waitForTimeout(800);
  await page.locator('[data-testid="rec-stop"]').click();
  await expect(page.locator('[data-testid="rec-review"]')).toBeVisible();
  await page.locator('[data-testid="next-word"]').click();
  await expect(page.locator('[data-testid="rec-review"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="rec-start"]')).toBeVisible();
});

test('a "needs practice" rating awards no XP', async ({ page }) => {
  await seed(page, { lang: 'id' });
  await openCard(page, 'ar-01');
  await page.locator('[data-testid="rec-start"]').click();
  await page.waitForTimeout(800);
  await page.locator('[data-testid="rec-stop"]').click();
  await page.locator('[data-testid="rate-more"]').click();
  const s = await page.evaluate(state);
  expect(s.xp).toBe(0);
  expect(Object.values(s.speaking)[0]).toMatchObject({ tries: 1, close: 0 });
});

const denied = { en: 'Microphone access was blocked', ar: 'تم حظر الوصول إلى الميكروفون', id: 'Akses mikrofon diblokir' };
for (const ui of ['en', 'ar', 'id']) {
  test(`denied microphone shows a clear error in ${ui}`, async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); };
    });
    await seed(page, { lang: ui });
    await openCard(page);
    await page.locator('[data-testid="rec-start"]').click();
    await expect(page.locator('[data-testid="rec-error"]')).toContainText(denied[ui]);
    await expect(page.locator('[data-testid="rec-error"]')).toHaveAttribute('role', 'alert');
    await expect(page.locator('[data-testid="rec-start"]')).toBeVisible(); // can retry
  });
}

test('browsers without recording support explain it instead of showing a dead button', async ({ page }) => {
  await page.addInitScript(() => { delete window.MediaRecorder; });
  await seed(page, { lang: 'en' });
  await page.goto('/lesson/en-01');
  await page.locator('[data-testid="start-learn"]').click();
  await expect(page.locator('[data-testid="speak-unsupported"]')).toContainText('cannot record audio');
});

test('speaking card passes axe in RTL and has a privacy note', async ({ page }) => {
  await seed(page, { lang: 'ar' });
  await openCard(page, 'ar-01');
  await expect(page.locator('[data-testid="speaking"]')).toContainText('لا يُحفظ ولا يُرفع');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
});
