import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, dismissNamePrompt } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

test.use({ serviceWorkers: 'block' });

async function signIn(page, email, lang = 'en') {
  await seed(page, { lang });
  await page.goto('/settings');
  await page.locator('[data-testid="acc-email"]').fill(email);
  await page.locator('[data-testid="acc-send"]').click();
  await page.locator('[data-testid="acc-code"]').fill('123456');
  await page.locator('[data-testid="acc-verify"]').click();
  await expect(page.locator('[data-testid="avatar-link"]')).toBeVisible();
  await dismissNamePrompt(page);
}
async function newDevice(browser, backend, email, lang = 'en') {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await backend.install(ctx);
  const page = await ctx.newPage();
  await signIn(page, email, lang);
  return { ctx, page };
}

test.describe('roles, classes, teacher and admin pages (mocked Supabase API; the real rules are tested in supabase/tests)', () => {
  test('a student sees Classes but no Teaching/Admin; the restricted pages explain why', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await signIn(page, 'sara@example.com');
    await page.goto('/profile');
    await expect(page.locator('[data-testid="link-classes"]')).toBeVisible();
    await expect(page.locator('[data-testid="link-teach"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="link-admin"]')).toHaveCount(0);
    await page.goto('/teach');
    await expect(page.locator('[data-testid="not-allowed"]')).toContainText('Teacher access is needed');
    await page.goto('/admin');
    await expect(page.locator('[data-testid="not-allowed"]')).toContainText('admins only');
  });

  test('signed out: the classes page asks to sign in', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await seed(page, { lang: 'en' });
    await page.goto('/classes');
    await expect(page.locator('[data-testid="needs-signin"]')).toBeVisible();
    await expect(page.locator('[data-testid="acc-email"]')).toBeVisible();
  });

  test('teacher creates a class; a student joins with the code; the teacher sees a progress summary; remove and delete work', async ({ browser }) => {
    const backend = createMockBackend({ teachers: ['tariq@example.com'] });
    const teacher = await newDevice(browser, backend, 'tariq@example.com');
    const student = await newDevice(browser, backend, 'sara@example.com');
    backend.addUser('sara@example.com', { display_name: 'Sara Student', summary: { xp: 120, lessons_done: 2, streak: 3, accuracy: 80, last_active: '2026-11-20', streak_last: '2026-11-20' } });

    await teacher.page.goto('/profile');
    await expect(teacher.page.locator('[data-testid="link-teach"]')).toBeVisible();
    await teacher.page.goto('/teach');
    await teacher.page.locator('[data-testid="class-name"]').fill('Arabic 101');
    await teacher.page.locator('[data-testid="class-create"]').click();
    await expect(teacher.page.locator('[data-testid="class-card"]')).toContainText('Arabic 101');
    const code = (await teacher.page.locator('[data-testid="class-code"]').innerText()).trim();
    expect(code).toMatch(/^[0-9A-F]{8}$/);

    // student: wrong code first, then the right one (lowercase is accepted)
    await student.page.goto('/classes');
    await student.page.locator('[data-testid="join-code"]').fill('ZZZZZZZZ');
    await student.page.locator('[data-testid="join-submit"]').click();
    await expect(student.page.locator('[data-testid="classes-msg"]')).toContainText('not found');
    await student.page.locator('[data-testid="join-code"]').fill(code.toLowerCase());
    await student.page.locator('[data-testid="join-submit"]').click();
    await expect(student.page.locator('[data-testid="classes-msg"]')).toContainText('You joined Arabic 101');
    await expect(student.page.locator('[data-testid="membership"]')).toContainText('Arabic 101');
    await expect(student.page.locator('[data-testid="membership"]')).toContainText('Teacher: tariq');

    // teacher sees the summary (no raw answers) and the privacy line
    await teacher.page.reload();
    await expect(teacher.page.locator('[data-testid="class-card"]')).toContainText('Students: 1');
    await teacher.page.locator('[data-testid="view-students"]').click();
    const row = teacher.page.locator('[data-testid="student-row"]');
    await expect(row).toContainText('Sara Student');
    await expect(row).toContainText('sara@example.com');
    await expect(row).toContainText('120');
    await expect(row).toContainText('80%');
    await expect(teacher.page.locator('[data-testid="roster"]')).toContainText('no recordings and no individual answers');

    // remove with confirmation
    await row.locator('[data-testid="remove-student"]').click();
    await teacher.page.locator('[data-testid="teach-confirm-yes"]').click();
    await expect(teacher.page.locator('[data-testid="student-row"]')).toHaveCount(0);
    await student.page.reload();
    await expect(student.page.locator('[data-testid="membership"]')).toHaveCount(0);

    // delete the class
    await teacher.page.locator('[data-testid="delete-class"]').click();
    await teacher.page.locator('[data-testid="teach-confirm-yes"]').click();
    await expect(teacher.page.locator('[data-testid="class-card"]')).toHaveCount(0);
    expect(backend.classes).toHaveLength(0);
    await teacher.ctx.close(); await student.ctx.close();
  });

  test('a student can leave a class after confirming', async ({ browser }) => {
    const backend = createMockBackend({ teachers: ['tariq@example.com'] });
    const teacher = await newDevice(browser, backend, 'tariq@example.com');
    const student = await newDevice(browser, backend, 'sara@example.com');
    await teacher.page.goto('/teach');
    await teacher.page.locator('[data-testid="class-name"]').fill('Evening class');
    await teacher.page.locator('[data-testid="class-create"]').click();
    const code = (await teacher.page.locator('[data-testid="class-code"]').innerText()).trim();
    await student.page.goto('/classes');
    await student.page.locator('[data-testid="join-code"]').fill(code);
    await student.page.locator('[data-testid="join-submit"]').click();
    await expect(student.page.locator('[data-testid="membership"]')).toBeVisible();
    await student.page.locator('[data-testid="leave"]').click();
    await expect(student.page.getByRole('dialog')).toContainText('no longer see your progress');
    await student.page.locator('[data-testid="leave-confirm"]').click();
    await expect(student.page.locator('[data-testid="membership"]')).toHaveCount(0);
    expect(backend.members).toHaveLength(0);
    await teacher.ctx.close(); await student.ctx.close();
  });

  test('admin lists users, changes a role after confirming, and cannot remove the last admin', async ({ browser }) => {
    const backend = createMockBackend({ admins: ['ada@example.com'] });
    const admin = await newDevice(browser, backend, 'ada@example.com');
    const student = await newDevice(browser, backend, 'sara@example.com');
    backend.addUser('sara@example.com', { display_name: 'Sara Student', summary: { xp: 120, lessons_done: 2 } });
    await admin.page.goto('/profile');
    await expect(admin.page.locator('[data-testid="link-admin"]')).toBeVisible();
    await expect(admin.page.locator('[data-testid="link-teach"]')).toBeVisible();
    await admin.page.goto('/admin');
    await expect(admin.page.locator('[data-testid="user-row"]')).toHaveCount(2);
    await expect(admin.page.locator('[data-testid="user-row"]', { hasText: 'ada@example.com' })).toContainText('You');
    // promote Sara to teacher
    const saraRow = admin.page.locator('[data-testid="user-row"]', { hasText: 'Sara Student' });
    await saraRow.locator('[data-testid="role-select"]').selectOption('teacher');
    await expect(admin.page.locator('[data-testid="admin-confirm"]')).toContainText('Change the role of Sara Student to Teacher?');
    await admin.page.locator('[data-testid="admin-confirm-yes"]').click();
    await expect(admin.page.locator('[data-testid="admin-msg"]')).toContainText('Sara Student is now Teacher');
    expect(backend.known.get('user-' + Buffer.from('sara@example.com').toString('hex').slice(0, 8)).role).toBe('teacher');
    // search
    await admin.page.locator('[data-testid="admin-search"]').fill('sara');
    await expect(admin.page.locator('[data-testid="user-row"]')).toHaveCount(1);
    await admin.page.locator('[data-testid="admin-search"]').fill('');
    // the only admin cannot demote themselves
    const adaRow = admin.page.locator('[data-testid="user-row"]', { hasText: 'ada@example.com' });
    await adaRow.locator('[data-testid="role-select"]').selectOption('student');
    await admin.page.locator('[data-testid="admin-confirm-yes"]').click();
    await expect(admin.page.locator('[data-testid="admin-msg"]')).toContainText('at least one admin');
    await expect(adaRow.locator('[data-testid="role-select"]')).toHaveValue('admin');
    // the promoted teacher now sees Teaching after a reload
    await student.page.reload();
    await student.page.goto('/profile');
    await expect(student.page.locator('[data-testid="link-teach"]')).toBeVisible();
    await admin.ctx.close(); await student.ctx.close();
  });

  test('desktop sidebar shows role links; the phone bar keeps its five tabs', async ({ browser }) => {
    const backend = createMockBackend({ admins: ['ada@example.com'] });
    const admin = await newDevice(browser, backend, 'ada@example.com');
    await admin.page.setViewportSize({ width: 1366, height: 768 });
    await admin.page.goto('/');
    for (const href of ['/classes', '/teach', '/admin']) await expect(admin.page.locator(`.sidebar a[href="${href}"]`)).toBeVisible();
    await admin.page.setViewportSize({ width: 390, height: 844 });
    await expect(admin.page.locator('.bottom-nav a')).toHaveCount(6); // Home, Learn, Review, Progress, Messages, Notifications
    for (const url of ['/classes', '/teach', '/admin']) {
      await admin.page.goto(url);
      expect(await admin.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), url).toBeLessThanOrEqual(0);
    }
    await admin.ctx.close();
  });

  test('Arabic: classes, teaching and admin pages are translated, right-to-left and pass axe', async ({ browser }) => {
    const backend = createMockBackend({ admins: ['ada@example.com'] });
    const admin = await newDevice(browser, backend, 'ada@example.com', 'ar');
    for (const [url, heading] of [['/classes', 'صفوفي'], ['/teach', 'التدريس'], ['/admin', 'الإدارة']]) {
      await admin.page.goto(url);
      await expect(admin.page.getByRole('heading', { level: 1 })).toHaveText(heading);
      expect(await admin.page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      const r = await new AxeBuilder({ page: admin.page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' ')), url).toEqual([]);
    }
    await admin.page.goto('/classes');
    await admin.page.locator('[data-testid="join-code"]').fill('ABCD1234');
    await admin.page.locator('[data-testid="join-submit"]').click();
    await expect(admin.page.locator('[data-testid="classes-msg"]')).toContainText('لم يُعثر على رمز الصف');
    await admin.ctx.close();
  });
});
