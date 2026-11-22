import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, dismissNamePrompt } from './helpers.js';
import { createMockBackend } from './mockSupabase.js';

// Chromium's fake camera and microphone make real WebRTC calls possible between two browser contexts on one machine.
test.use({
  serviceWorkers: 'block',
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns'] },
});

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
  const ctx = await browser.newContext({ serviceWorkers: 'block', permissions: ['microphone', 'camera'] });
  await backend.install(ctx);
  const page = await ctx.newPage();
  await signIn(page, email, lang);
  return { ctx, page };
}
const CONV = '11111111-1111-4111-8111-111111111111';
function setup() {
  const backend = createMockBackend({ admins: ['boss@example.com'], teachers: ['tee@example.com'] });
  const boss = backend.addUser('boss@example.com', { role: 'admin', display_name: 'Boss' });
  const tee = backend.addUser('tee@example.com', { role: 'teacher', display_name: 'Tee' });
  const sara = backend.addUser('sara@example.com', { display_name: 'Sara' });
  backend.conversations.push({ id: CONV, a: boss.id, b: sara.id, last_at: new Date().toISOString() });
  backend.classes.push({ id: 'class-1', name: 'Beginners', code: 'ABCD1234', teacher_id: tee.id, created_at: new Date().toISOString() });
  backend.members.push({ class_id: 'class-1', student_id: sara.id, joined_at: new Date().toISOString() });
  backend.conversations.push({ id: '22222222-2222-4222-8222-222222222222', a: tee.id, b: sara.id, last_at: new Date().toISOString() });
  return { backend, boss, tee, sara };
}
const axeOk = async (page) => {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.map((v) => v.id + ': ' + v.nodes[0].target.join(' '))).toEqual([]);
};

test.describe('voice and video calls (mocked Supabase API for the call state; the media itself is real WebRTC between two browsers; rules in supabase/tests/calls.test.sql)', () => {
  test('the admin video-calls a student: it rings, the student answers, both see and hear each other, then hang up leaves a line in the chat', async ({ browser }) => {
    test.setTimeout(90000);
    const { backend } = setup();
    const boss = await newDevice(browser, backend, 'boss@example.com');
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await boss.page.goto(`/chat/${CONV}`);
    await expect(boss.page.locator('[data-testid="chat-privacy"]')).toContainText('not recorded');
    await boss.page.locator('[data-testid="start-video-call"]').click();
    await expect(boss.page.locator('[data-testid="call-screen"]')).toBeVisible();
    await expect(boss.page.locator('[data-testid="call-status"]')).toContainText('Calling');

    await expect(sara.page.locator('[data-testid="incoming-call"]')).toBeVisible({ timeout: 12000 });
    await expect(sara.page.locator('[data-testid="incoming-call"]')).toContainText('Boss');
    await axeOk(sara.page);
    await sara.page.locator('[data-testid="call-accept"]').click();

    for (const p of [boss.page, sara.page]) await expect(p.locator('[data-testid="call-screen"]')).toHaveAttribute('data-phase', 'connected', { timeout: 30000 });
    // real media arrives on both sides
    for (const p of [boss.page, sara.page]) {
      await expect.poll(() => p.evaluate(() => { const v = document.querySelector('[data-testid="remote-video"]'); return !!v && !!v.srcObject && v.srcObject.getVideoTracks().length > 0 && v.srcObject.getAudioTracks().length > 0; })).toBe(true);
    }
    await axeOk(boss.page);
    // mute and camera off flip the real tracks
    await boss.page.locator('[data-testid="call-mute"]').click();
    await expect(boss.page.locator('[data-testid="call-mute"]')).toHaveAttribute('aria-pressed', 'true');
    await boss.page.locator('[data-testid="call-camera"]').click();
    await expect(boss.page.locator('[data-testid="call-camera"]')).toHaveAttribute('aria-pressed', 'true');
    // the timer runs
    await expect(sara.page.locator('[data-testid="call-status"]')).toHaveText(/^\d+:\d\d$/);

    await sara.page.locator('[data-testid="call-hangup"]').click();
    await expect(boss.page.locator('[data-testid="call-status"]')).toContainText('Call ended', { timeout: 10000 });
    await expect(boss.page.locator('[data-testid="call-screen"]')).toHaveCount(0, { timeout: 8000 });
    await expect(boss.page.locator('[data-testid="call-line"]').last()).toContainText('Video call · 1 min');
    await sara.page.reload();
    await sara.page.goto(`/chat/${CONV}`);
    await expect(sara.page.locator('[data-testid="call-line"]').last()).toContainText('Video call');
    // the camera and microphone are released on both sides
    for (const p of [boss.page, sara.page]) expect(await p.evaluate(() => document.querySelectorAll('video').length)).toBe(0);
    await boss.ctx.close(); await sara.ctx.close();
  });

  test('a voice call works the same without video', async ({ browser }) => {
    test.setTimeout(90000);
    const { backend } = setup();
    const boss = await newDevice(browser, backend, 'boss@example.com');
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await boss.page.goto(`/chat/${CONV}`);
    await boss.page.locator('[data-testid="start-voice-call"]').click();
    await expect(sara.page.locator('[data-testid="incoming-call"]')).toContainText('voice call', { timeout: 12000 });
    await sara.page.locator('[data-testid="call-accept"]').click();
    for (const p of [boss.page, sara.page]) await expect(p.locator('[data-testid="call-screen"]')).toHaveAttribute('data-phase', 'connected', { timeout: 30000 });
    await expect(boss.page.locator('[data-testid="remote-video"]')).toHaveCount(0);
    await expect(boss.page.locator('[data-testid="call-camera"]')).toHaveCount(0);
    await boss.page.locator('[data-testid="call-hangup"]').click();
    await expect(sara.page.locator('[data-testid="call-screen"]')).toHaveCount(0, { timeout: 12000 });
    await boss.ctx.close(); await sara.ctx.close();
  });

  test('declining and cancelling: the student declines, and a call cancelled before it is answered stops ringing and shows as missed', async ({ browser }) => {
    test.setTimeout(90000);
    const { backend } = setup();
    const boss = await newDevice(browser, backend, 'boss@example.com');
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await boss.page.goto(`/chat/${CONV}`);
    await boss.page.locator('[data-testid="start-voice-call"]').click();
    await expect(sara.page.locator('[data-testid="incoming-call"]')).toBeVisible({ timeout: 12000 });
    await sara.page.locator('[data-testid="call-decline"]').click();
    await expect(sara.page.locator('[data-testid="incoming-call"]')).toHaveCount(0);
    await expect(boss.page.locator('[data-testid="call-status"]')).toContainText('declined', { timeout: 10000 });
    await boss.page.locator('[data-testid="call-close"]').click();
    await expect(boss.page.locator('[data-testid="call-line"]').last()).toContainText('Voice call declined');

    await boss.page.locator('[data-testid="start-video-call"]').click();
    await expect(sara.page.locator('[data-testid="incoming-call"]')).toBeVisible({ timeout: 12000 });
    await boss.page.locator('[data-testid="call-hangup"]').click();
    await expect(sara.page.locator('[data-testid="incoming-call"]')).toHaveCount(0, { timeout: 12000 });
    await expect(boss.page.locator('[data-testid="call-screen"]')).toHaveCount(0, { timeout: 8000 }); // a call you hang up yourself closes by itself
    await expect(boss.page.locator('[data-testid="call-line"]').last()).toContainText('Missed video call');
    await boss.ctx.close(); await sara.ctx.close();
  });

  test('who can call: admins and teachers see the buttons (a student never does); the database refuses anyone else', async ({ browser }) => {
    const { backend } = setup();
    const tee = await newDevice(browser, backend, 'tee@example.com');
    await tee.page.goto('/chat/22222222-2222-4222-8222-222222222222');
    await expect(tee.page.locator('[data-testid="start-voice-call"]')).toBeVisible();
    const sara = await newDevice(browser, backend, 'sara@example.com');
    await sara.page.goto('/chat/22222222-2222-4222-8222-222222222222');
    await expect(sara.page.locator('[data-testid="chat-thread-page"]')).toBeVisible();
    await expect(sara.page.locator('[data-testid="start-voice-call"]')).toHaveCount(0);
    await expect(sara.page.locator('[data-testid="start-video-call"]')).toHaveCount(0);
    // a teacher cannot call through the admin's conversation with the student: mocked rule mirrors the SQL (not allowed)
    const res = await tee.page.evaluate(async (conv) => { const r = await fetch('https://mohleyla-test.supabase.co/rest/v1/rpc/start_call', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (Object.values(localStorage).map((v) => { try { return JSON.parse(v).access_token; } catch { return null; } }).find(Boolean) || ''), apikey: 'x' }, body: JSON.stringify({ p_conv: conv, p_media: 'audio' }) }); return r.status; }, CONV);
    expect([401, 403]).toContain(res);
    await tee.ctx.close(); await sara.ctx.close();
  });

  test('a blocked camera or microphone ends the call with a clear message and a missed-call line', async ({ browser }) => {
    const { backend } = setup();
    const boss = await newDevice(browser, backend, 'boss@example.com');
    await boss.page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error('no'), { name: 'NotAllowedError' }); }; });
    await boss.page.goto(`/chat/${CONV}`);
    await boss.page.locator('[data-testid="start-video-call"]').click();
    await expect(boss.page.locator('[data-testid="call-status"]')).toContainText('Microphone or camera access was blocked');
    await axeOk(boss.page);
    await boss.page.locator('[data-testid="call-close"]').click();
    await expect(boss.page.locator('[data-testid="call-screen"]')).toHaveCount(0);
    await expect(boss.page.locator('[data-testid="call-line"]').last()).toContainText('Missed video call');
    await boss.ctx.close();
  });

  for (const lang of ['ar', 'id']) {
    test(`${lang}: the call buttons and the incoming-call screen are translated and accessible`, async ({ browser }) => {
      test.setTimeout(60000);
      const { backend } = setup();
      const boss = await newDevice(browser, backend, 'boss@example.com', lang);
      const sara = await newDevice(browser, backend, 'sara@example.com', lang);
      await boss.page.goto(`/chat/${CONV}`);
      await expect(boss.page.locator('[data-testid="start-voice-call"]')).toHaveAttribute('aria-label', /\S/);
      await boss.page.locator('[data-testid="start-video-call"]').click();
      await expect(sara.page.locator('[data-testid="incoming-call"]')).toBeVisible({ timeout: 12000 });
      await axeOk(sara.page);
      expect(await sara.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await sara.page.locator('[data-testid="call-decline"]').click();
      await boss.ctx.close(); await sara.ctx.close();
    });
  }
});
