import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, dismissNamePrompt } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

// Chromium's fake microphone makes MediaRecorder really record.
test.use({
  serviceWorkers: 'block',
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

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
  const ctx = await browser.newContext({ serviceWorkers: 'block', permissions: ['microphone'] });
  await backend.install(ctx);
  const page = await ctx.newPage();
  await signIn(page, email, lang);
  return { ctx, page };
}
const axeOk = async (page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
};
function setup() {
  const backend = createMockBackend({ admins: ['boss@example.com'] });
  const boss = backend.addUser('boss@example.com', { role: 'admin', display_name: 'Boss' });
  const sara = backend.addUser('sara@example.com', { display_name: 'Sara' });
  backend.conversations.push({ id: '11111111-1111-4111-8111-111111111111', a: boss.id, b: sara.id, last_at: new Date().toISOString() });
  backend.chatMsgs.push({ id: 'm0', conv: '11111111-1111-4111-8111-111111111111', sender: boss.id, body: 'Hi Sara, send me a voice note when you can.', created_at: new Date().toISOString(), removed_at: null, kind: 'text' });
  return { backend, boss, sara, conv: '11111111-1111-4111-8111-111111111111' };
}

test.describe('chat attachments: voice notes and photos (mocked Supabase API; rules in supabase/tests/chat_attachments.test.sql)', () => {
  test('a student records and sends a voice note; the admin hears it', async ({ browser }) => {
    const { backend, conv } = setup();
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await sara.page.goto(`/chat/${conv}`);
    await expect(sara.page.locator('[data-testid="chat-count"]').first()).toBeVisible();
    await sara.page.locator('[data-testid="record-voice"]').click();
    await expect(sara.page.locator('[data-testid="rec-bar"]')).toBeVisible();
    await sara.page.waitForTimeout(1500);
    await sara.page.locator('[data-testid="rec-stop"]').click();
    await expect(sara.page.locator('[data-testid="pending-file"] audio')).toBeVisible();
    await sara.page.locator('[data-testid="chat-input"]').fill('My answer');
    await sara.page.locator('[data-testid="chat-send"]').click();
    await expect(sara.page.locator('[data-testid="voice-note"]')).toBeVisible();
    await expect(sara.page.locator('[data-testid="voice-audio"]')).toHaveAttribute('src', /\/object\/sign\/chat-files\/11111111-1111-4111-8111-111111111111\/.+\.webm/);
    await expect(sara.page.locator('[data-testid="chat-msg"]').last()).toContainText('My answer');
    expect([...backend.files.values()][0].owner).toBe(backend.known.get([...backend.known.keys()].find((k) => backend.known.get(k).email === 'sara@example.com')).id);
    await axeOk(sara.page);

    const boss = await newDevice(browser, backend, 'boss@example.com');
    await boss.page.goto(`/chat/${conv}`);
    await expect(boss.page.locator('[data-testid="voice-audio"]')).toHaveAttribute('src', /\.webm/);
    await boss.page.goto('/chat');
    await expect(boss.page.locator('[data-testid="chat-row"]').first()).toContainText('Voice note');
    await sara.ctx.close(); await boss.ctx.close();
  });

  test('a student sends a photo with a caption; it is shrunk to JPEG, opens full size, and the admin sees it', async ({ browser }) => {
    const { backend, conv } = setup();
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await sara.page.goto(`/chat/${conv}`);
    await sara.page.locator('[data-testid="photo-input"]').setInputFiles({ name: 'homework.png', mimeType: 'image/png', buffer: PNG });
    await expect(sara.page.locator('[data-testid="pending-file"] img')).toBeVisible();
    await sara.page.locator('[data-testid="chat-input"]').fill('My homework');
    await sara.page.locator('[data-testid="chat-send"]').click();
    await expect(sara.page.locator('[data-testid="photo-img"]')).toBeVisible();
    await expect(sara.page.locator('[data-testid="chat-msg"]').last()).toContainText('My homework');
    const stored = [...backend.files.entries()][0];
    expect(stored[0]).toMatch(/^11111111-1111-4111-8111-111111111111\/[0-9a-f-]{36}\.jpg$/);
    expect(stored[1].mime).toBe('image/jpeg'); // re-encoded, so camera location data is dropped
    await sara.page.locator('[data-testid="photo-open"]').click();
    await expect(sara.page.locator('.photo-dialog img')).toBeVisible();
    await sara.page.keyboard.press('Escape');

    const boss = await newDevice(browser, backend, 'boss@example.com');
    await boss.page.goto(`/chat/${conv}`);
    await expect(boss.page.locator('[data-testid="photo-img"]')).toBeVisible();
    await sara.ctx.close(); await boss.ctx.close();
  });

  test('only photos can be attached: a text file is refused with a clear message, nothing is uploaded', async ({ browser }) => {
    const { backend, conv } = setup();
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await sara.page.goto(`/chat/${conv}`);
    await sara.page.locator('[data-testid="photo-input"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(sara.page.locator('[data-testid="chat-error"]')).toContainText('Only JPEG, PNG or WebP');
    expect(backend.files.size).toBe(0);
    await sara.ctx.close();
  });

  test('a blocked microphone shows a clear message and nothing is recorded', async ({ browser }) => {
    const { backend, conv } = setup();
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await sara.page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error('no'), { name: 'NotAllowedError' }); }; });
    await sara.page.goto(`/chat/${conv}`);
    await sara.page.locator('[data-testid="record-voice"]').click();
    await expect(sara.page.locator('[data-testid="chat-error"]')).toContainText('Microphone access was blocked');
    await expect(sara.page.locator('[data-testid="rec-bar"]')).toHaveCount(0);
    await sara.ctx.close();
  });

  test('recording can be cancelled, and a recorded note can be discarded before sending', async ({ browser }) => {
    const { backend, conv } = setup();
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await sara.page.goto(`/chat/${conv}`);
    await sara.page.locator('[data-testid="record-voice"]').click();
    await sara.page.locator('[data-testid="rec-cancel"]').click();
    await expect(sara.page.locator('[data-testid="rec-bar"]')).toHaveCount(0);
    await sara.page.locator('[data-testid="record-voice"]').click();
    await sara.page.waitForTimeout(1000);
    await sara.page.locator('[data-testid="rec-stop"]').click();
    await sara.page.locator('[data-testid="pending-discard"]').click();
    await expect(sara.page.locator('[data-testid="pending-file"]')).toHaveCount(0);
    expect(backend.files.size).toBe(0);
    await sara.ctx.close();
  });

  test('after 90 days an attachment shows as expired for both people and the admin clean-up deletes the file; the admin can also remove a file with its message', async ({ page, browser }) => {
    const { backend, conv, boss, sara } = setup();
    const old = new Date(Date.now() - 100 * 864e5).toISOString();
    const oldPath = `${conv}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webm`;
    const newPath = `${conv}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg`;
    backend.files.set(oldPath, { owner: sara.id, mime: 'audio/webm', size: 1000, created_at: old, bytes: Buffer.from('x') });
    backend.files.set(newPath, { owner: sara.id, mime: 'image/jpeg', size: 1000, created_at: new Date().toISOString(), bytes: Buffer.from('x') });
    backend.chatMsgs.push({ id: 'old1', conv, sender: sara.id, body: '', created_at: old, removed_at: null, kind: 'voice', file_path: oldPath, file_mime: 'audio/webm', duration_ms: 5000 });
    backend.chatMsgs.push({ id: 'new1', conv, sender: sara.id, body: 'fresh photo', created_at: new Date(Date.now() + 500).toISOString(), removed_at: null, kind: 'image', file_path: newPath, file_mime: 'image/jpeg' });
    await backend.install(page);
    await signIn(page, 'sara@example.com');
    await page.goto(`/chat/${conv}`);
    await expect(page.locator('[data-testid="file-expired"]')).toContainText('90 days');
    await expect(page.locator('[data-testid="photo-img"]')).toBeVisible();

    const admin = await newDevice(browser, backend, 'boss@example.com');
    await admin.page.goto('/admin?tab=chats');
    await expect(admin.page.locator('[data-testid="chats-msg"]')).toContainText('Deleted 1 expired file');
    expect(backend.files.has(oldPath)).toBe(false); // gone for good
    expect(backend.files.has(newPath)).toBe(true);
    await admin.page.locator('[data-testid="admin-chat-read"]').click();
    await expect(admin.page.locator('[data-testid="admin-transcript"] [data-testid="photo-img"]')).toBeVisible();
    await admin.page.locator('[data-testid="admin-msg-row"]', { hasText: 'fresh photo' }).locator('[data-testid="admin-msg-remove"]').click();
    await admin.page.locator('[data-testid="chat-remove-yes"]').click();
    await expect.poll(() => backend.files.has(newPath)).toBe(false); // removing the message deletes its file
    await admin.ctx.close();
  });

  for (const lang of ['ar', 'id']) {
    test(`${lang}: the attach and record controls are translated, labelled and accessible`, async ({ browser }) => {
      const { backend, conv } = setup();
      const u = await newDevice(browser, backend, 'sara@example.com', lang);
      await u.page.goto(`/chat/${conv}`);
      await expect(u.page.locator('[data-testid="attach-photo"]')).toHaveAttribute('aria-label', /\S/);
      await expect(u.page.locator('[data-testid="record-voice"]')).toHaveAttribute('aria-label', /\S/);
      await u.page.locator('[data-testid="record-voice"]').click();
      await expect(u.page.locator('[data-testid="rec-bar"]')).toBeVisible();
      await axeOk(u.page);
      await u.page.locator('[data-testid="rec-cancel"]').click();
      expect(await u.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await u.ctx.close();
    });
  }
});
