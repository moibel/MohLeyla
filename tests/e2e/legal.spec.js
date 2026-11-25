import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed } from './helpers.js';

test.use({ serviceWorkers: 'block' });

// The privacy policy and terms are static pages (no sign-in, no script) in Arabic, English and Indonesian, linked from the footer.
test.describe('privacy policy and terms', () => {
  for (const [lang, privacy, terms] of [['en', 'Privacy policy', 'Terms of use'], ['ar', 'سياسة الخصوصية', 'شروط الاستخدام'], ['id', 'Kebijakan privasi', 'Ketentuan penggunaan']]) {
    test(`${lang}: the footer links open both pages`, async ({ page }) => {
      await seed(page, { lang });
      await page.goto('/');
      const links = page.locator('[data-testid="legal-links"]').first();
      await expect(links.getByRole('link', { name: privacy })).toHaveAttribute('href', '/privacy.html');
      await expect(links.getByRole('link', { name: terms })).toHaveAttribute('href', '/terms.html');
      await links.getByRole('link', { name: privacy }).click();
      await expect(page).toHaveURL(/\/privacy(\.html)?$/);
      await expect(page.locator('h1')).toContainText('Privacy policy');
    });
  }

  for (const path of ['/privacy.html', '/terms.html']) {
    test(`${path} works without signing in, has all three languages, and has no accessibility violations`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res.status()).toBe(200);
      for (const [id, dir] of [['en', 'ltr'], ['ar', 'rtl'], ['id', 'ltr']]) await expect(page.locator(`section#${id}[dir="${dir}"]`)).toBeVisible();
      expect(await page.locator('script').count()).toBe(0);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.map((v) => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('the privacy page says what matters: administrators can read chats, voice practice stays on the device, and how to delete', async ({ page }) => {
    await page.goto('/privacy.html');
    const en = page.locator('section#en');
    await expect(en).toContainText('administrators can also read chats');
    await expect(en).toContainText('stay on your device');
    await expect(en.getByRole('link', { name: 'how to delete your account' })).toHaveAttribute('href', '/delete-account.html');
  });
});
