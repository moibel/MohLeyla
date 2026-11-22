import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

test.use({ serviceWorkers: 'block' });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function signInWithCode(page, email, code = '123456') {
  await page.goto('/');
  await page.locator('a[href="/settings"]').first().click();
  await page.locator('[data-testid="acc-email"]').fill(email);
  await page.locator('[data-testid="acc-send"]').click();
  await page.locator('[data-testid="acc-code"]').fill(code);
  await page.locator('[data-testid="acc-verify"]').click();
  await expect(page.locator('[data-testid="avatar-link"]')).toBeVisible(); // signed in (profile available)
}

async function setName(page, name) {
  await page.locator('[data-testid="np-input"]').fill(name);
  await page.locator('[data-testid="np-save"]').click();
  await expect(page.locator('[data-testid="name-prompt"][open]')).toHaveCount(0); // saved in the account
}

test.describe('profile: greeting, name, avatar', () => {
  test('an email user is asked for a name once; the greeting, avatar and profile page use it', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await signInWithCode(page, 'amina@example.com');
    await expect(page.locator('[data-testid="name-prompt"][open]')).toBeVisible();
    await setName(page, 'Amina');
    expect(backend.profiles['amina@example.com']).toEqual({ display_name: 'Amina' }); // saved in the account
    await page.goto('/');
    await expect(page.locator('[data-testid="greeting"]')).toContainText('Hi, Amina');
    await expect(page.locator('[data-testid="avatar-initials"]').first()).toHaveText('A');
    await page.locator('[data-testid="avatar-link"]').click();
    await expect(page.locator('[data-testid="profile-name"]')).toHaveText('Amina');
    await expect(page.locator('[data-testid="profile"]')).toContainText('amina@example.com');
    await expect(page.locator('[data-testid="profile"]')).toContainText('Member since November 1, 2026');
    // rename
    await page.locator('[data-testid="profile-input"]').fill('Amina K');
    await page.locator('[data-testid="profile-save"]').click();
    await expect(page.locator('[data-testid="profile-saved"]')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('[data-testid="greeting"]')).toContainText('Hi, Amina K');
    await expect(page.locator('[data-testid="avatar-initials"]').first()).toHaveText('AK');
    // reload: greeting is immediate and the prompt never comes back
    await page.reload();
    await expect(page.locator('[data-testid="greeting"]')).toContainText('Hi, Amina K');
    await expect(page.locator('[data-testid="name-prompt"][open]')).toHaveCount(0);
  });

  test('the name follows the account to a second device (no prompt there)', async ({ browser }) => {
    const backend = createMockBackend();
    const a = await browser.newContext({ serviceWorkers: 'block' });
    await backend.install(a);
    const phone = await a.newPage();
    await seed(phone, { lang: 'en' });
    await signInWithCode(phone, 'amina@example.com');
    await setName(phone, 'Amina');
    const b = await browser.newContext({ serviceWorkers: 'block' });
    await backend.install(b);
    const laptop = await b.newPage();
    await seed(laptop, { lang: 'id' });
    await signInWithCode(laptop, 'amina@example.com');
    await laptop.goto('/');
    await expect(laptop.locator('[data-testid="greeting"]')).toContainText('Hai, Amina');
    await expect(laptop.locator('[data-testid="name-prompt"][open]')).toHaveCount(0);
    await a.close(); await b.close();
  });

  test('skipping the name uses the readable part of the email, and the prompt does not return', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await signInWithCode(page, 'omar.salem@example.com');
    await page.locator('[data-testid="np-skip"]').click();
    await expect(page.locator('[data-testid="name-prompt"][open]')).toHaveCount(0);
    await page.goto('/');
    await expect(page.locator('[data-testid="greeting"]')).toContainText('Hi, omar salem');
    await page.reload();
    await expect(page.locator('[data-testid="name-prompt"][open]')).toHaveCount(0);
    expect(backend.stats.nameUpdates || 0).toBe(0);
  });

  test('a Google user gets their Google name and photo, with no name prompt', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await page.route('https://lh3.googleusercontent.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await seed(page, { lang: 'en' });
    await page.goto('/settings');
    await page.locator('[data-testid="acc-google"]').click();
    await expect(page.locator('[data-testid="greeting"]')).toContainText('Hi, Google Learner'); // OAuth returns to the home page
    await expect(page.locator('[data-testid="avatar-img"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="name-prompt"][open]')).toHaveCount(0);
    const loaded = await page.locator('[data-testid="avatar-img"]').first().evaluate((i) => i.complete && i.naturalWidth > 0);
    expect(loaded).toBe(true);
    expect(await page.locator('[data-testid="avatar-img"]').first().getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  test('a photo that fails to load falls back to initials', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await page.route('https://lh3.googleusercontent.com/**', (r) => r.abort());
    await seed(page, { lang: 'en' });
    await page.goto('/settings');
    await page.locator('[data-testid="acc-google"]').click();
    await expect(page.locator('[data-testid="greeting"]')).toContainText('Hi, Google Learner');
    await expect(page.locator('[data-testid="avatar-initials"]').first()).toHaveText('GL');
  });

  test('Arabic: the greeting reads right-to-left with the name isolated; profile passes axe', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'ar' });
    await signInWithCode(page, 'layla@example.com');
    await setName(page, 'ليلى');
    await page.goto('/');
    await expect(page.locator('[data-testid="greeting"]')).toContainText('مرحبًا، ليلى');
    await expect(page.locator('[data-testid="avatar-initials"]').first()).toHaveText('ل');
    await page.goto('/profile');
    await expect(page.locator('[data-testid="profile"]')).toContainText('ملفك الشخصي');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
  });

  test('a failed rename shows a translated error and keeps the old name', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await signInWithCode(page, 'amina@example.com');
    await setName(page, 'Amina');
    await page.goto('/profile');
    backend.state.failNameUpdate = true;
    await page.locator('[data-testid="profile-input"]').fill('Somebody Else');
    await page.locator('[data-testid="profile-save"]').click();
    await expect(page.getByRole('alert')).toContainText('could not save your name');
    await expect(page.locator('[data-testid="profile-name"]')).toHaveText('Amina');
  });

  test('signed out: the profile page invites sign-in; phones show the avatar without overflowing', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await page.goto('/profile');
    await expect(page.locator('[data-testid="profile-signed-out"]')).toBeVisible();
    await expect(page.locator('[data-testid="avatar-link"]')).toHaveCount(0);
    await page.setViewportSize({ width: 360, height: 780 });
    await signInWithCode(page, 'amina@example.com');
    await setName(page, 'Amina');
    for (const url of ['/', '/profile', '/learn']) {
      await page.goto(url);
      await expect(page.locator('[data-testid="avatar-link"]')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), url).toBeLessThanOrEqual(0);
    }
  });
});
