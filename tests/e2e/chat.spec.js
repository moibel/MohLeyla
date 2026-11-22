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
const axeOk = async (page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
};
async function adminWritesTo(page, backend, email, text) {
  await page.goto('/admin');
  const row = page.locator('[data-testid="user-row"]', { hasText: email });
  await row.locator('[data-testid="message-user"]').click();
  await expect(page.locator('[data-testid="chat-thread-page"]')).toBeVisible();
  await page.locator('[data-testid="chat-input"]').fill(text);
  await page.locator('[data-testid="chat-send"]').click();
  await expect(page.locator('[data-testid="chat-msg"]').last()).toContainText(text);
}

test.describe('chat and notifications (mocked Supabase API; the real rules are in supabase/tests/chat.test.sql)', () => {
  test('the admin messages a learner; the learner is notified, reads and replies; nobody else can open the chat', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    backend.addUser('sara@example.com', { display_name: 'Sara' });
    backend.addUser('omar@example.com', { display_name: 'Omar' });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await adminWritesTo(page, backend, 'sara@example.com', 'Welcome to MohLeyla, Sara!');
    await expect(page.locator('[data-testid="chat-privacy"]')).toContainText('admins can also read');

    const sara = await newDevice(browser, backend, 'sara@example.com');
    await expect(sara.page.locator('[data-testid="bell-count"]')).toHaveText('1');
    await sara.page.goto('/notifications');
    await expect(sara.page.locator('[data-testid="notif-chat"]')).toContainText('Welcome to MohLeyla');
    await sara.page.locator('[data-testid="notif-chat"]').click();
    await expect(sara.page.locator('[data-testid="chat-msg"]')).toContainText('Welcome to MohLeyla, Sara!');
    await expect(sara.page.locator('[data-testid="chat-privacy"]')).toBeVisible();
    await axeOk(sara.page);
    await sara.page.locator('[data-testid="chat-input"]').fill('Thank you!');
    await sara.page.keyboard.press('Enter');
    await expect(sara.page.locator('[data-testid="chat-msg"]').last()).toContainText('Thank you!');
    await sara.page.goto('/chat');
    await expect(sara.page.locator('[data-testid="chat-unread"]')).toHaveCount(0); // she read it

    // the admin sees the reply and an unread count
    await page.goto('/chat');
    await expect(page.locator('[data-testid="chat-row"]').first()).toContainText('Thank you!');
    await expect(page.locator('[data-testid="chat-unread"]')).toHaveText('1');

    // an outsider cannot see or open it
    const omar = await newDevice(browser, backend, 'omar@example.com');
    await omar.page.goto('/chat');
    await expect(omar.page.locator('[data-testid="chat-row"]')).toHaveCount(0);
    await omar.page.goto(`/chat/${backend.conversations[0].id}`);
    await expect(omar.page).toHaveURL(/\/chat$/); // sent back to their own list
    await expect(omar.page.locator('[data-testid="chat-msg"]')).toHaveCount(0);
    await sara.ctx.close(); await omar.ctx.close();
  });

  test('the admin reads every chat (read-only) and can remove a message, which both people then see as removed', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    const tee = backend.addUser('tee@example.com', { role: 'teacher', display_name: 'Tee' });
    const sara = backend.addUser('sara@example.com', { display_name: 'Sara' });
    backend.classes.push({ id: 'class-1', name: 'Beginners', code: 'ABCD1234', teacher_id: tee.id, created_at: new Date().toISOString() });
    backend.members.push({ class_id: 'class-1', student_id: sara.id, joined_at: new Date().toISOString() });
    await backend.install(page);
    // the teacher starts a chat with their student from the class roster
    const teacher = await newDevice(browser, backend, 'tee@example.com');
    await teacher.page.goto('/teach');
    await teacher.page.locator('[data-testid="view-students"]').click();
    await teacher.page.locator('[data-testid="message-student"]').click();
    await teacher.page.locator('[data-testid="chat-input"]').fill('Please finish lesson 2 by Friday.');
    await teacher.page.locator('[data-testid="chat-send"]').click();
    await expect(teacher.page.locator('[data-testid="chat-msg"]')).toContainText('lesson 2');

    await signIn(page, 'boss@example.com');
    await page.goto('/admin?tab=chats');
    const panel = page.locator('[data-testid="admin-chats"]');
    await expect(panel.locator('[data-testid="admin-chat-row"]')).toHaveCount(1);
    await expect(panel.locator('[data-testid="admin-chat-row"]')).toContainText('Tee');
    await panel.locator('[data-testid="admin-chat-read"]').click();
    await expect(panel.locator('[data-testid="admin-msg-row"]')).toContainText('Please finish lesson 2');
    await expect(panel.locator('[data-testid="admin-transcript"]')).toContainText('Read-only');
    await expect(panel.locator('[data-testid="chat-input"]')).toHaveCount(0); // no way to write into someone else's chat
    await axeOk(page);
    await panel.locator('[data-testid="admin-msg-remove"]').click();
    await page.locator('[data-testid="chat-remove-yes"]').click();
    await expect(panel.locator('[data-testid="admin-msg-row"]')).toContainText('Removed');

    const s = await newDevice(browser, backend, 'sara@example.com');
    await s.page.goto(`/chat/${backend.conversations[0].id}`);
    await expect(s.page.locator('[data-testid="chat-msg"]')).toContainText('This message was removed.');
    await expect(s.page.locator('[data-testid="chat-msg"]')).not.toContainText('lesson 2');
    await teacher.ctx.close(); await s.ctx.close();
  });

  test('the bell counts new announcements and rewards, lists them on the Notifications page and clears after a visit', async ({ page }) => {
    const backend = createMockBackend();
    await backend.install(page);
    await signIn(page, 'amina@example.com');
    await expect(page.locator('[data-testid="bell"]')).toBeVisible();
    await expect(page.locator('[data-testid="bell-count"]')).toHaveCount(0); // nothing new yet
    backend.rewards.push({ id: 'rw-n', email: 'amina@example.com', kind: 'star', amount: 3, label: null, reason: 'Great effort', created_at: new Date(Date.now() + 200).toISOString(), granted_by_email: 'a@b.cc', revoked_at: null });
    backend.announcements.push({ id: 'an-n', title: { en: 'Holiday' }, body: { en: 'No class Friday.' }, audience: 'all', class_id: null, user_email: null, style: 'info', created_at: new Date(Date.now() + 400).toISOString(), expires_at: null, archived_at: null });
    await page.reload();
    await expect(page.locator('[data-testid="bell-count"]')).toHaveText('2');
    await expect(page.locator('[data-testid="bell"]')).toHaveAttribute('aria-label', /2 new/);
    await page.locator('[data-testid="bell"]').click();
    await expect(page.locator('[data-testid="notifications-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="notif-reward"]')).toContainText('Stars: +3');
    await expect(page.locator('[data-testid="notif-news"]')).toContainText('Holiday');
    await expect(page.locator('[data-testid="notif-news"]').getByText('New')).toBeVisible();
    await page.locator('[data-testid="reward-dismiss"]').click(); // the reward pop-in fades in; dismiss it so axe does not read half-transparent text
    await axeOk(page);
    await expect(page.locator('[data-testid="bell-count"]')).toHaveCount(0); // cleared after the visit
  });

  test('students and teachers get no "message anyone" control: only admins (People list) and teachers (their own class roster) can start a chat', async ({ page }) => {
    const backend = createMockBackend({ teachers: ['tee@example.com'] });
    await backend.install(page);
    await signIn(page, 'tee@example.com');
    await page.goto('/chat');
    await expect(page.locator('[data-testid="chat-list-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-user"]')).toHaveCount(0);
    await page.goto('/admin');
    await expect(page.locator('[data-testid="not-allowed"]')).toBeVisible(); // no People list, so no way to pick anyone
  });

  for (const lang of ['ar', 'id']) {
    test(`${lang}: chat list, thread and notifications are translated, accessible and fit the screen`, async ({ page }) => {
      const backend = createMockBackend({ admins: ['boss@example.com'] });
      const boss = backend.addUser('boss@example.com', { role: 'admin', display_name: 'Boss' });
      const u = backend.addUser('amal@example.com', { display_name: 'Amal' });
      backend.conversations.push({ id: 'conv-1', a: boss.id, b: u.id, last_at: new Date().toISOString() });
      backend.chatMsgs.push({ id: 'msg-1', conv: 'conv-1', sender: boss.id, body: 'Hello Amal', created_at: new Date().toISOString(), removed_at: null });
      await backend.install(page);
      await signIn(page, 'amal@example.com', lang);
      for (const path of ['/chat', '/chat/conv-1', '/notifications']) {
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
        await page.waitForTimeout(400);
        await axeOk(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
      }
      await page.goto('/chat/conv-1');
      await expect(page.locator('[data-testid="chat-privacy"]')).not.toContainText('admins can also read');
    });
  }
});
