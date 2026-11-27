import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, dismissNamePrompt, completeSetup } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

// Account deletion from Settings (mocked Supabase API; the deletion rules are tested in supabase/tests/account_deletion.test.sql).
test.use({ serviceWorkers: 'block' });
const state = () => JSON.parse(localStorage.getItem('mohleyla-v6'));

async function signIn(page, email = 'amina@example.com') {
  await page.goto('/settings');
  await page.locator('[data-testid="acc-email"]').fill(email);
  await page.locator('[data-testid="acc-send"]').click();
  await page.locator('[data-testid="acc-code"]').fill('123456');
  await page.locator('[data-testid="acc-verify"]').click();
  await dismissNamePrompt(page);
  await expect(page.locator('[data-testid="acc-delete-account"]')).toBeVisible();
}
const openDialog = async (page) => { await page.locator('[data-testid="acc-delete-account"]').click(); await expect(page.locator('[data-testid="acc-delete-account-dialog"]')).toBeVisible(); };

test.describe('delete my account', () => {
  test('the dialog says what is deleted, needs the checkbox, deletes, signs out, and keeps progress that is only on the device', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en', state: { xp: 70, xpLedger: { d: 70 }, completed: { 'ar-01': { best: 100, attempts: 1 } } } });
    await signIn(page);
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Up to date');
    expect(backend.rows.size).toBe(1);

    await openDialog(page);
    const dialog = page.locator('[data-testid="acc-delete-account-dialog"]');
    await expect(dialog).toContainText('permanently deletes your account');
    await expect(dialog).toContainText('the other person loses that chat too');
    const confirm = page.locator('[data-testid="acc-delete-account-confirm"]');
    await expect(confirm).toBeDisabled();
    await page.locator('[data-testid="acc-delete-account-check"]').check();
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.locator('[data-testid="acc-account-deleted"]')).toContainText('Your account was deleted');
    await expect(page.locator('[data-testid="acc-email"]')).toBeVisible(); // signed out
    expect(backend.rows.size).toBe(0);
    expect(backend.state.deletedUsers).toHaveLength(1);
    expect(backend.stats.deleteCalls).toEqual([{ confirm: true, appleCode: null, hasToken: true }]);
    expect((await page.evaluate(state)).xp).toBe(70); // device progress kept
    expect(await page.evaluate(() => localStorage.getItem('mohleyla-auth'))).toBeNull();
  });

  test('cancel closes the dialog and deletes nothing; the checkbox resets', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await signIn(page);
    await openDialog(page);
    await page.locator('[data-testid="acc-delete-account-check"]').check();
    await page.getByRole('button', { name: 'Cancel' }).last().click();
    await expect(page.locator('[data-testid="acc-delete-account-dialog"]')).toBeHidden();
    expect(backend.stats.deleteCalls).toBeUndefined();
    await openDialog(page);
    await expect(page.locator('[data-testid="acc-delete-account-check"]')).not.toBeChecked();
  });

  test('a server failure keeps the person signed in, says nothing was removed, and allows another try', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await signIn(page);
    backend.state.deleteAccount = 'fail';
    await openDialog(page);
    await page.locator('[data-testid="acc-delete-account-check"]').check();
    await page.locator('[data-testid="acc-delete-account-confirm"]').click();
    await expect(page.locator('[data-testid="acc-delete-account-error"]')).toContainText('Nothing was removed');
    await expect(page.locator('[data-testid="acc-delete-account-dialog"]')).toBeVisible();
    expect(backend.state.deletedUsers).toBeUndefined(); // nothing was deleted
    backend.state.deleteAccount = null;
    await page.locator('[data-testid="acc-delete-account-confirm"]').click();
    await expect(page.locator('[data-testid="acc-account-deleted"]')).toBeVisible();
  });

  test('the only administrator is told why the account cannot be deleted', async ({ page }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await signIn(page, 'boss@example.com');
    backend.state.deleteAccount = 'lastAdmin';
    await openDialog(page);
    await page.locator('[data-testid="acc-delete-account-check"]').check();
    await page.locator('[data-testid="acc-delete-account-confirm"]').click();
    await expect(page.locator('[data-testid="acc-delete-account-error"]')).toContainText('only administrator');
    await expect(page.locator('[data-testid="acc-email"]')).toHaveCount(0); // still signed in
  });

  test('deleting cleans up what the cascade removes: memberships and chats of that person only', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await signIn(page);
    const me = [...backend.known.keys()][0];
    backend.conversations.push({ id: 'c-mine', a: me, b: 'someone', last_at: 1 }, { id: 'c-other', a: 'x', b: 'y', last_at: 1 });
    backend.chatMsgs.push({ id: 'm1', conv: 'c-mine', sender: 'someone', body: 'hi' }, { id: 'm2', conv: 'c-other', sender: 'x', body: 'yo' });
    await openDialog(page);
    await page.locator('[data-testid="acc-delete-account-check"]').check();
    await page.locator('[data-testid="acc-delete-account-confirm"]').click();
    await expect(page.locator('[data-testid="acc-account-deleted"]')).toBeVisible();
    expect(backend.conversations.map((c) => c.id)).toEqual(['c-other']);
    expect(backend.chatMsgs.map((m) => m.id)).toEqual(['m2']);
  });

  for (const lang of ['en', 'ar', 'id']) {
    test(`${lang}: the dialog is translated, accessible (axe) and has no horizontal scroll on a phone`, async ({ page }) => {
      const backend = createMockBackend();
      await backend.install(page);
      await page.setViewportSize({ width: 360, height: 740 });
      await seed(page, { lang });
      await page.goto('/settings');
      await page.locator('[data-testid="acc-email"]').fill('amina@example.com');
      await page.locator('[data-testid="acc-send"]').click();
      await page.locator('[data-testid="acc-code"]').fill('123456');
      await page.locator('[data-testid="acc-verify"]').click();
      await dismissNamePrompt(page);
      await openDialog(page);
      const dialog = page.locator('[data-testid="acc-delete-account-dialog"]');
      await expect(dialog.locator('li')).toHaveCount(4);
      const text = await dialog.innerText();
      expect(text).not.toMatch(/account\.|deleteAccount/); // no missing-translation keys
      if (lang === 'ar') expect(text).toMatch(/[؀-ۿ]/);
      await page.waitForTimeout(600); // let the dialog's entrance animation finish before measuring contrast
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0].target.join(' ')}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const box = await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    });
  }
});
