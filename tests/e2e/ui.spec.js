import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed } from './helpers.js';

const SHOTS = 'test-results/screens';
fs.mkdirSync(SHOTS, { recursive: true });
const PAGES = ['/', '/learn?track=sa', '/lesson/ar-14', '/words', '/progress', '/settings', '/review'];
const VIEWPORTS = { iphone: { width: 390, height: 844 }, android: { width: 360, height: 780 }, tablet: { width: 820, height: 1180 }, laptop: { width: 1366, height: 768 }, desktop: { width: 1920, height: 1080 } };

const visibleText = (page) => page.evaluate(() => {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('noscript,[aria-hidden="true"],select,script,style,.sr-only,[lang="ar"]:not(.ui),.target-text,bdi[lang],[lang="en"],[lang="id"]').forEach((n) => n.remove());
  return clone.innerText;
});

test.describe('responsive layout (no horizontal scroll, correct navigation)', () => {
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    for (const lang of ['en', 'ar']) {
      test(`${name} ${vp.width}px ${lang}`, async ({ page }) => {
        await page.setViewportSize(vp);
        await seed(page, { lang, state: { saved: { a1: 1 }, completed: { 'ar-01': { best: 90, attempts: 1 } }, xp: 70 } });
        for (const url of PAGES) {
          await page.goto(url);
          await page.waitForLoadState('networkidle');
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(overflow, `${url} horizontal overflow`).toBeLessThanOrEqual(0);
          const clipped = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,button,.btn')].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'hidden' && e.clientWidth > 0).map((e) => e.textContent.slice(0, 30)));
          expect(clipped, `${url} clipped text`).toEqual([]);
        }
        const wide = vp.width >= 1024;
        await page.goto('/');
        await expect(page.locator('.sidebar')).toBeVisible({ visible: wide });
        await expect(page.locator('.bottom-nav')).toBeVisible({ visible: !wide });
        await page.screenshot({ path: `${SHOTS}/home-${name}-${lang}.png`, fullPage: false });
        if (name === 'iphone' || name === 'laptop') {
          await page.goto('/lesson/sa-01');
          await page.locator('[data-testid="start-learn"]').click();
          await page.screenshot({ path: `${SHOTS}/lesson-${name}-${lang}.png` });
        }
      });
    }
  }
});

test.describe('RTL', () => {
  test('Arabic sets rtl on <html>, mirrors navigation and arrows', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.iphone);
    await seed(page, { lang: 'ar' });
    await page.goto('/');
    expect(await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang])).toEqual(['rtl', 'ar']);
    const boxes = await page.locator('.bottom-nav .nav-item').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
    expect(boxes[0]).toBeGreaterThan(boxes[boxes.length - 1]); // Home is right-most
    // CTA arrow flips
    await expect(page.locator('.hero .btn svg.lucide-arrow-left')).toHaveCount(1);
    await page.goto('/lesson/ar-01');
    await page.locator('[data-testid="start-learn"]').click();
    const flipped = await page.locator('[data-testid="next-word"] .rtl-flip').first().evaluate((e) => getComputedStyle(e).transform);
    expect(flipped).not.toBe('none');
  });
  test('desktop: sidebar sits on the right in Arabic and left in English', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.laptop);
    await seed(page, { lang: 'ar' });
    await page.goto('/');
    const ar = await page.evaluate(() => ({ s: document.querySelector('.sidebar').getBoundingClientRect().left, m: document.querySelector('.main-col').getBoundingClientRect().left }));
    expect(ar.s).toBeGreaterThan(ar.m);
    await page.evaluate(() => localStorage.setItem('mohleyla-ui-lang', 'en'));
    await page.reload();
    const en = await page.evaluate(() => ({ s: document.querySelector('.sidebar').getBoundingClientRect().left, m: document.querySelector('.main-col').getBoundingClientRect().left }));
    expect(en.s).toBeLessThan(en.m);
  });
  test('mixed text is direction-isolated: Arabic target in English UI is rtl, Latin in Arabic UI is ltr', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await page.goto('/lesson/ar-01');
    await page.locator('[data-testid="start-learn"]').click();
    expect(await page.locator('.word-target').first().evaluate((e) => [e.getAttribute('lang'), e.getAttribute('dir')])).toEqual(['ar', 'rtl']);
    await page.evaluate(() => localStorage.setItem('mohleyla-ui-lang', 'ar'));
    await page.goto('/lesson/en-01');
    await page.locator('[data-testid="start-learn"]').click();
    expect(await page.locator('.word-target').first().evaluate((e) => [e.getAttribute('lang'), e.getAttribute('dir')])).toEqual(['en', 'ltr']);
  });
});

test.describe('interface language controls everything', () => {
  const idWords = /\b(Beranda|Pelajaran|Mulai belajar|Kosakata|Progres|Selamat datang|Belajar|Lanjut)\b/;
  const enWords = /\b(Home|Lessons|Start learning|Progress|Welcome|Continue|Settings)\b/;
  for (const url of ['/', '/learn', '/words', '/progress', '/settings', '/review', '/lesson/id-01']) {
    test(`ar interface has no Latin/Indonesian UI text: ${url}`, async ({ page }) => {
      await seed(page, { lang: 'ar' });
      await page.goto(url);
      if (url.startsWith('/lesson')) await page.locator('[data-testid="start-learn"]').click();
      await page.waitForLoadState('networkidle');
      const text = await visibleText(page);
      const latin = (text.match(/[A-Za-z]{3,}/g) || []).filter((w) => !['MohLeyla', 'XP'].includes(w));
      expect(latin, `Latin words in Arabic UI on ${url}`).toEqual([]);
    });
    test(`en interface has no Indonesian/Arabic UI text: ${url}`, async ({ page }) => {
      await seed(page, { lang: 'en' });
      await page.goto(url);
      if (url.startsWith('/lesson')) await page.locator('[data-testid="start-learn"]').click();
      const text = await visibleText(page);
      expect(text).not.toMatch(idWords);
      expect(text).not.toMatch(/[؀-ۿ]/);
    });
    test(`id interface has no English UI text: ${url}`, async ({ page }) => {
      await seed(page, { lang: 'id' });
      await page.goto(url);
      if (url.startsWith('/lesson')) await page.locator('[data-testid="start-learn"]').click();
      const text = await visibleText(page);
      expect(text).not.toMatch(enWords);
      expect(text).not.toMatch(/[؀-ۿ]/);
    });
  }
  test('switching language updates the whole page live and survives reload', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await page.goto('/learn');
    await page.locator('[data-testid="lang-switch"]').selectOption('id');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jalur belajar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jalur belajar');
    await page.locator('[data-testid="lang-switch"]').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('مسارات التعلّم');
  });
  test('lesson content (titles, explanations, exercises) follows the interface language, learning language independent', async ({ page }) => {
    await seed(page, { lang: 'ar' });
    await page.goto('/lesson/id-01');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/[؀-ۿ]/);
    await page.locator('[data-testid="start-learn"]').click();
    await expect(page.locator('.meaning').first()).toContainText(/[؀-ۿ]/);
    expect(await page.locator('.word-target').first().getAttribute('lang')).toBe('id');
  });
});

test.describe('accessibility', () => {
  for (const lang of ['en', 'ar']) {
    for (const url of ['/', '/learn', '/words', '/progress', '/settings']) {
      test(`axe: ${url} (${lang})`, async ({ page }) => {
        await seed(page, { lang, state: { saved: { a1: 1 } } });
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
      });
    }
  }
  test('axe: lesson learn card + exercise (en, dark)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await seed(page, { lang: 'en', state: { settings: { theme: 'system' } } });
    await page.goto('/lesson/ar-01');
    await page.locator('[data-testid="start-learn"]').click();
    let r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
    for (let i = 0; i < 6; i++) await page.locator('[data-testid="next-word"]').click();
    r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
  });
  test('keyboard: skip link, visible focus, and exercise answerable by keyboard', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    expect(outline).not.toBe('none');
    await page.goto('/lesson/en-01');
    await page.locator('[data-testid="start-learn"]').focus();
    await page.keyboard.press('Enter');
    for (let i = 0; i < 6; i++) { await page.locator('[data-testid="next-word"]').focus(); await page.keyboard.press('Enter'); }
    await page.locator('[data-testid="opt-correct"], [data-testid="match-left"], [data-testid="tile"]').first().waitFor();
    await page.locator('[data-testid="opt-correct"]').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="feedback"]')).toBeFocused();
  });
  test('reduced motion removes animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page, { lang: 'en' });
    await page.goto('/');
    const d = await page.locator('.hero-mark').evaluate((e) => getComputedStyle(e).animationDuration);
    expect(parseFloat(d)).toBeLessThan(0.01);
  });
});

test.describe('assets & branding', () => {
  test('every image on every page loads; favicon and manifest icons exist', async ({ page, request }) => {
    await seed(page, { lang: 'en' });
    const failed = [];
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    for (const url of ['/', '/learn', '/lesson/ar-01', '/words', '/progress', '/settings']) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
      expect(broken, url).toEqual([]);
    }
    expect(failed).toEqual([]);
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.name).toBe('MohLeyla');
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    for (const p of ['/favicon.ico', '/icons/favicon-32.png', '/icons/apple-touch-icon.png', '/icons/logo-mark-512.png', '/icons/og-image.png']) expect((await request.get(p)).status(), p).toBe(200);
  });
});

test.describe('PWA', () => {
  test('service worker registers and the app shell + visited lesson work offline', async ({ page, context }) => {
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.goto('/lesson/ar-01');
    await expect(page.locator('[data-testid="overview"]')).toBeVisible();
    await page.goto('/');
    await context.setOffline(true);
    await page.goto('/lesson/ar-01');
    await expect(page.locator('[data-testid="overview"]')).toBeVisible();
    await expect(page.locator('.offline-bar')).toBeVisible();
    await context.setOffline(false);
  });
});
