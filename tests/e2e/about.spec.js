import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed } from './helpers.js';

test.use({ serviceWorkers: 'block' });

test.describe('creator credit and About page', () => {
  for (const [lang, made, title] of [['en', 'Made with care by', 'About MohLeyla'], ['ar', 'صُنع بعناية بواسطة', 'حول MohLeyla'], ['id', 'Dibuat dengan sepenuh hati oleh', 'Tentang MohLeyla']]) {
    test(`${lang}: the footer credit links to the About page, which names the creator and has no accessibility violations`, async ({ page }) => {
      await seed(page, { lang });
      await page.goto('/');
      const credit = page.locator('[data-testid="made-by"]');
      await expect(credit).toContainText(made);
      await credit.click();
      await expect(page).toHaveURL(/\/about$/);
      const about = page.locator('[data-testid="about-page"]');
      await expect(about.locator('h1')).toHaveText(title);
      await expect(about).toContainText('Mohamed Ebrahim');
      await expect(about).toContainText('محمد إبراهيم');
      const res = await new AxeBuilder({ page }).analyze();
      expect(res.violations.map((v) => v.id)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});
