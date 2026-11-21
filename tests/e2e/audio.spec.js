import { test, expect } from '@playwright/test';
import { seed, getLesson } from './helpers.js';

// Block the service worker here so page.route() can intercept /audio requests deterministically.
test.use({ serviceWorkers: 'block' });

// Real playback test: instrument HTMLMediaElement so we can observe that the browser actually started and finished
// decoding+playing a clip (not merely that an API exists). Chromium decodes mp3 in headless mode.
const instrument = () => {
  window.__media = [];
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const rec = { src: this.src, playing: false, ended: false, maxTime: 0, duration: 0, error: null };
    window.__media.push(rec);
    this.addEventListener('playing', () => { rec.playing = true; });
    this.addEventListener('timeupdate', () => { rec.maxTime = Math.max(rec.maxTime, this.currentTime); rec.duration = this.duration; });
    this.addEventListener('ended', () => { rec.ended = true; rec.duration = this.duration; });
    this.addEventListener('error', () => { rec.error = this.error && this.error.code; });
    return origPlay.call(this);
  };
};

const cases = [
  ['ar', 'ar-01', 'Modern Standard Arabic'],
  ['sa', 'sa-01', 'Saudi Arabic (Standard Arabic voice)'],
  ['en', 'en-01', 'English'],
  ['id', 'id-01', 'Indonesian'],
];

for (const [track, lessonId, label] of cases) {
  test(`recorded audio actually plays: ${label}`, async ({ page }) => {
    await page.addInitScript(instrument);
    await seed(page, { lang: 'en' });
    const lesson = getLesson(lessonId);
    await page.goto(`/lesson/${lessonId}`);
    await page.locator('[data-testid="start-learn"]').click();
    await page.getByRole('button', { name: 'Listen to the word' }).click();
    await expect.poll(() => page.evaluate(() => window.__media.some((m) => m.ended)), { timeout: 15000 }).toBe(true);
    const rec = await page.evaluate(() => window.__media[0]);
    expect(rec.src).toMatch(/\/audio\/(ar|en|id)\/[0-9a-z]+\.mp3$/);
    expect(rec.src).toContain(track === 'sa' ? '/audio/ar/' : `/audio/${track}/`);
    expect(rec.error).toBeNull();
    expect(rec.playing).toBe(true);
    expect(rec.duration).toBeGreaterThan(0.3);
    expect(rec.maxTime).toBeGreaterThan(0.1);
    await expect(page.locator('.toast-error')).toHaveCount(0);
    void lesson;
  });
}

test('example sentences and exercise audio play too (Arabic)', async ({ page }) => {
  await page.addInitScript(instrument);
  await seed(page, { lang: 'ar' });
  await page.goto('/lesson/ar-02');
  await page.locator('[data-testid="start-learn"]').click();
  await page.locator('.example-block .speak').click();
  await expect.poll(() => page.evaluate(() => window.__media.some((m) => m.ended)), { timeout: 15000 }).toBe(true);
});

test('repeated clicks never overlap: second click stops, rapid different clips keep a single element', async ({ page }) => {
  await page.addInitScript(instrument);
  await seed(page, { lang: 'en' });
  await page.goto('/lesson/ar-02');
  await page.locator('[data-testid="start-learn"]').click();
  const word = page.locator('.word-main .speak');
  await word.click();
  await expect(word).toHaveAttribute('data-status', /loading|playing/);
  await word.click(); // stop
  await expect(word).toHaveAttribute('data-status', 'idle');
  // rapid-fire: word then example
  await word.click();
  await page.locator('.example-block .speak').click();
  await expect.poll(() => page.evaluate(() => window.__media.filter((m) => m.ended).length), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  const playingNow = await page.evaluate(() => [...document.querySelectorAll('.speak')].filter((b) => b.dataset.status === 'playing').length);
  expect(playingNow).toBeLessThanOrEqual(1);
});

const fakeSpeechScript = (voices) => {
  const spoken = [];
  window.__spoken = spoken;
  const synth = {
    getVoices: () => voices,
    cancel() {}, pause() {}, resume() {},
    speak(u) { spoken.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name, rate: u.rate }); setTimeout(() => { u.onstart && u.onstart({}); u.onend && u.onend({}); }, 30); },
    addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
};

test('fallback: missing recording -> device voice with the exact Arabic locale', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.fulfill({ status: 404, body: '' }));
  await page.addInitScript(fakeSpeechScript, [{ lang: 'ar-EG', name: 'Egypt' }, { lang: 'ar-SA', name: 'Saudi' }, { lang: 'en-US', name: 'US' }]);
  await seed(page, { lang: 'en' });
  await page.goto('/lesson/ar-01');
  await page.locator('[data-testid="start-learn"]').click();
  await page.getByRole('button', { name: 'Listen to the word' }).click();
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1);
  const u = await page.evaluate(() => window.__spoken[0]);
  expect(u.lang).toBe('ar-SA');
  expect(u.voice).toBe('Saudi');
  await expect(page.locator('.toast-info')).toContainText('device voice');
});

const noVoiceMsg = { en: 'No Arabic voice is installed', ar: 'لا يوجد صوت العربية مثبّت', id: 'Suara Arab belum terpasang' };
for (const ui of ['en', 'ar', 'id']) {
  test(`no recording and no Arabic voice shows a clear error in ${ui}`, async ({ page }) => {
    await page.route('**/audio/**', (r) => r.fulfill({ status: 404, body: '' }));
    await page.addInitScript(fakeSpeechScript, [{ lang: 'en-US', name: 'US' }]);
    await seed(page, { lang: ui });
    await page.goto('/lesson/ar-01');
    await page.locator('[data-testid="start-learn"]').click();
    await page.locator('.word-main .speak').click();
    await expect(page.locator('.toast-error')).toContainText(noVoiceMsg[ui]);
    await expect(page.locator('.toast-error')).toHaveAttribute('role', 'alert');
  });
}

test('browser without speech support shows an error instead of failing silently', async ({ page }) => {
  await page.route('**/audio/**', (r) => r.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); delete window.SpeechSynthesisUtterance; });
  await seed(page, { lang: 'en' });
  await page.goto('/lesson/en-01');
  await page.locator('[data-testid="start-learn"]').click();
  await page.locator('.word-main .speak').click();
  await expect(page.locator('.toast-error')).toContainText('cannot play speech');
});

test('settings: playback speed is applied to recordings', async ({ page }) => {
  await page.addInitScript(() => {
    window.__rates = [];
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__rates.push(this.playbackRate); return origPlay.call(this); };
  });
  await seed(page, { lang: 'en', state: { settings: { speed: 'slow' } } });
  await page.goto('/lesson/en-01');
  await page.locator('[data-testid="start-learn"]').click();
  await page.locator('.word-main .speak').click();
  await expect.poll(() => page.evaluate(() => window.__rates.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__rates[0])).toBe(0.75);
});
