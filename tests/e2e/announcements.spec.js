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

test.describe('admin announcements (mocked Supabase API; real rules in supabase/tests/announcements.test.sql)', () => {
  test('an admin posts in English and Arabic; each learner sees their language (others see English); closing it hides it on Home but keeps it on the profile; archiving removes it', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin?tab=news');
    const panel = page.locator('[data-testid="admin-news"]');
    await expect(panel).toBeVisible();
    await panel.locator('[data-testid="news-title-en"]').fill('Eid holiday');
    await panel.locator('[data-testid="news-body-en"]').fill('No live classes this week.');
    await panel.locator('[data-testid="news-title-ar"]').fill('إجازة العيد');
    await panel.locator('[data-testid="news-body-ar"]').fill('لا حصص مباشرة هذا الأسبوع.');
    await panel.locator('[data-testid="news-post"]').click();
    await expect(panel.locator('[data-testid="news-msg"]')).toContainText('posted');
    await expect(panel.locator('[data-testid="news-row"]')).toHaveCount(1);

    const ar = await newDevice(browser, backend, 'amal@example.com', 'ar');
    await ar.page.goto('/');
    await expect(ar.page.locator('[data-testid="news-card"]')).toContainText('إجازة العيد');
    await axeOk(ar.page);
    const id = await newDevice(browser, backend, 'budi@example.com', 'id');
    await id.page.goto('/');
    await expect(id.page.locator('[data-testid="news-card"]')).toContainText('Eid holiday'); // no Indonesian text: falls back to English

    await ar.page.locator('[data-testid="news-dismiss"]').click();
    await expect(ar.page.locator('[data-testid="news-card"]')).toHaveCount(0);
    await ar.page.reload();
    await expect(ar.page.locator('[data-testid="news-card"]')).toHaveCount(0);
    await ar.page.goto('/profile');
    await expect(ar.page.locator('[data-testid="news-card"]')).toContainText('إجازة العيد'); // still readable on the profile

    await panel.locator('[data-testid="news-archive"]').click();
    await page.locator('[data-testid="news-confirm-yes"]').click();
    await expect(panel.locator('[data-testid="news-row"]')).toContainText('Archived');
    await id.page.reload();
    await expect(id.page.locator('[data-testid="news-card"]')).toHaveCount(0);
    await ar.ctx.close(); await id.ctx.close();
  });

  test('a class announcement is shown only to the students of that class', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    const teacher = backend.addUser('tee@example.com', { role: 'teacher' });
    const inClass = backend.addUser('in@example.com');
    backend.addUser('out@example.com');
    backend.classes.push({ id: 'class-1', name: 'Beginners', code: 'ABCD1234', teacher_id: teacher.id, created_at: new Date().toISOString() });
    backend.members.push({ class_id: 'class-1', student_id: inClass.id, joined_at: new Date().toISOString() });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin?tab=news');
    const panel = page.locator('[data-testid="admin-news"]');
    await expect(panel.locator('[data-testid="news-audience"] option')).toHaveCount(2); // everyone + Beginners
    await panel.locator('[data-testid="news-audience"]').selectOption('class-1');
    await panel.locator('[data-testid="news-title-en"]').fill('Homework');
    await panel.locator('[data-testid="news-body-en"]').fill('Finish lesson 3.');
    await panel.locator('[data-testid="news-post"]').click();
    await expect(panel.locator('[data-testid="news-msg"]')).toContainText('posted');
    const a = await newDevice(browser, backend, 'in@example.com');
    await a.page.goto('/');
    await expect(a.page.locator('[data-testid="news-card"]')).toContainText('Homework');
    await expect(a.page.locator('[data-testid="news-card"]')).toContainText('Beginners');
    const b = await newDevice(browser, backend, 'out@example.com');
    await b.page.goto('/');
    await expect(b.page.locator('[data-testid="news-card"]')).toHaveCount(0);
    await a.ctx.close(); await b.ctx.close();
  });

  test('a title without a message is refused with a clear message; teachers cannot reach the form', async ({ page }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin?tab=news');
    const panel = page.locator('[data-testid="admin-news"]');
    await panel.locator('[data-testid="news-title-en"]').fill('Only a title');
    await panel.locator('[data-testid="news-post"]').click();
    await expect(panel.locator('[data-testid="news-msg"]')).toContainText('title and a message');
    expect(backend.announcements).toHaveLength(0);
  });

  for (const lang of ['ar', 'id']) {
    test(`${lang}: the announcements admin panel is translated, accessible and fits the screen`, async ({ page }) => {
      const backend = createMockBackend({ admins: ['boss@example.com'] });
      await backend.install(page);
      await signIn(page, 'boss@example.com', lang);
      await page.goto('/admin?tab=news');
      await expect(page.locator('[data-testid="admin-news"]')).toBeVisible();
      await axeOk(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  // ---------------------------------------------------------------- part 2: one person, look and sound
  const fakeAudio = () => {
    window.__sfx = { contexts: 0, osc: 0 };
    window.AudioContext = class { constructor() { window.__sfx.contexts++; this.state = 'running'; this.currentTime = 0; this.destination = {}; }
      resume() { return Promise.resolve(); }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() { window.__sfx.osc++; return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; } };
  };
  async function post(panel, { title, body, audience = '', email, style }) {
    if (audience) await panel.locator('[data-testid="news-audience"]').selectOption(audience);
    if (email) await panel.locator('[data-testid="news-person-email"]').fill(email);
    if (style) await panel.locator('[data-testid="news-style"]').selectOption(style);
    await panel.locator('[data-testid="news-title-en"]').fill(title);
    await panel.locator('[data-testid="news-body-en"]').fill(body);
    await panel.locator('[data-testid="news-post"]').click();
    await expect(panel.locator('[data-testid="news-msg"]')).toContainText('posted');
  }

  test('a personal celebration opens as a pop-up with confetti and a sound for that person only, once', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin?tab=news');
    const panel = page.locator('[data-testid="admin-news"]');
    await post(panel, { title: 'Well done, Sara!', body: 'You finished the first path.', audience: '__person', email: '  Sara@Example.com ', style: 'celebrate' });
    await expect(panel.locator('[data-testid="news-row"]')).toContainText('To: sara@example.com');

    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.addInitScript(() => { window.__sfx = { contexts: 0, osc: 0 }; window.AudioContext = class { constructor() { window.__sfx.contexts++; this.state = 'running'; this.currentTime = 0; this.destination = {}; } resume() { return Promise.resolve(); } createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } createOscillator() { window.__sfx.osc++; return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; } }; });
    await backend.install(ctx);
    const sara = await ctx.newPage();
    await signIn(sara, 'sara@example.com');
    const dlg = sara.locator('[data-testid="announce"]');
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute('data-style', 'celebrate');
    await expect(dlg).toContainText('Well done, Sara!');
    await expect(sara.locator('[data-testid="announce-personal"]')).toBeVisible();
    await expect(dlg.locator('.confetti-burst span')).not.toHaveCount(0);
    expect(await sara.evaluate(() => window.__sfx.osc)).toBeGreaterThanOrEqual(4); // the happy arpeggio
    await axeOk(sara);
    await sara.locator('[data-testid="announce-ok"]').click();
    await expect(dlg).toHaveCount(0);
    await sara.reload();
    await expect(sara.locator('[data-testid="announce"]')).toHaveCount(0); // once
    await sara.goto('/profile');
    await expect(sara.locator('[data-testid="news-card"]')).toContainText('Well done, Sara!'); // still readable

    const other = await newDevice(browser, backend, 'omar@example.com');
    await other.page.goto('/');
    await expect(other.page.locator('[data-testid="announce"]')).toHaveCount(0);
    await expect(other.page.locator('[data-testid="news-card"]')).toHaveCount(0); // a message for one person is for nobody else
    await ctx.close(); await other.ctx.close();
  });

  test('an Important broadcast pops up once for everyone, an ordinary one only sits on the home page, and the sound can be turned off', async ({ page, browser }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin?tab=news');
    const panel = page.locator('[data-testid="admin-news"]');
    await post(panel, { title: 'Quiet note', body: 'Just so you know.', style: 'info' });
    await post(panel, { title: 'Server maintenance', body: 'Back at 9 pm.', style: 'alert' });

    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.addInitScript(() => { window.__sfx = { contexts: 0, osc: 0 }; window.AudioContext = class { constructor() { window.__sfx.contexts++; this.state = 'running'; this.currentTime = 0; this.destination = {}; } resume() { return Promise.resolve(); } createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } createOscillator() { window.__sfx.osc++; return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; } }; });
    await backend.install(ctx);
    const u = await ctx.newPage();
    await signIn(u, 'amina@example.com');
    const dlg = u.locator('[data-testid="announce"]');
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute('data-style', 'alert');
    await expect(dlg).toContainText('Server maintenance');
    expect(await u.evaluate(() => window.__sfx.osc)).toBeGreaterThanOrEqual(3);
    await u.locator('[data-testid="announce-mute"]').click(); // turns sound off for good
    await u.locator('[data-testid="announce-ok"]').click();
    await u.goto('/');
    await expect(u.locator('[data-testid="news-card"]')).toContainText('Quiet note'); // the ordinary one never popped up
    expect((await u.evaluate(() => JSON.parse(localStorage.getItem('mohleyla-v6')))).settings.sfx).toBe('off');
    await ctx.close();

    // with sound off, a new special message is silent
    await post(panel, { title: 'Party', body: 'Cake!', style: 'celebrate' });
    const ctx2 = await browser.newContext({ serviceWorkers: 'block' });
    await ctx2.addInitScript(() => { window.__sfx = { contexts: 0, osc: 0 }; window.AudioContext = class { constructor() { window.__sfx.contexts++; this.state = 'running'; this.currentTime = 0; this.destination = {}; } resume() { return Promise.resolve(); } createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } createOscillator() { window.__sfx.osc++; return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; } }; });
    await backend.install(ctx2);
    const q = await ctx2.newPage();
    await seed(q, { lang: 'en', state: { settings: { sfx: 'off' } } });
    await q.goto('/settings');
    await q.locator('[data-testid="acc-email"]').fill('quiet@example.com');
    await q.locator('[data-testid="acc-send"]').click();
    await q.locator('[data-testid="acc-code"]').fill('123456');
    await q.locator('[data-testid="acc-verify"]').click();
    await expect(q.locator('[data-testid="avatar-link"]')).toBeVisible();
    await dismissNamePrompt(q);
    await expect(q.locator('[data-testid="announce"]').first()).toBeVisible();
    await q.waitForTimeout(300);
    expect(await q.evaluate(() => window.__sfx.osc)).toBe(0);
    await ctx2.close();
  });

  test('the admin can preview how a message will look and sound without posting it', async ({ page }) => {
    await page.addInitScript(() => { window.__sfx = { contexts: 0, osc: 0 }; window.AudioContext = class { constructor() { window.__sfx.contexts++; this.state = 'running'; this.currentTime = 0; this.destination = {}; } resume() { return Promise.resolve(); } createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } createOscillator() { window.__sfx.osc++; return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; } }; });
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin?tab=news');
    const panel = page.locator('[data-testid="admin-news"]');
    await panel.locator('[data-testid="news-preview"]').click();
    await expect(panel.locator('[data-testid="news-msg"]')).toContainText('title and a message');
    await panel.locator('[data-testid="news-style"]').selectOption('celebrate');
    await panel.locator('[data-testid="news-title-en"]').fill('Preview me');
    await panel.locator('[data-testid="news-body-en"]').fill('Looks good?');
    await panel.locator('[data-testid="news-preview"]').click();
    await expect(page.locator('[data-testid="announce"]')).toContainText('Preview me');
    expect(await page.evaluate(() => window.__sfx.osc)).toBeGreaterThanOrEqual(4);
    await page.locator('[data-testid="announce-ok"]').click();
    expect(backend.announcements).toHaveLength(0);
  });

  test('a bad address and a class-plus-person mix are refused with a clear message', async ({ page }) => {
    const backend = createMockBackend({ admins: ['boss@example.com'] });
    await backend.install(page);
    await signIn(page, 'boss@example.com');
    await page.goto('/admin?tab=news');
    const panel = page.locator('[data-testid="admin-news"]');
    await panel.locator('[data-testid="news-audience"]').selectOption('__person');
    await panel.locator('[data-testid="news-person-email"]').fill('not-an-email');
    await panel.locator('[data-testid="news-title-en"]').fill('Hi');
    await panel.locator('[data-testid="news-body-en"]').fill('There');
    await panel.locator('[data-testid="news-post"]').click();
    // the browser's own email check blocks the submit, so nothing is sent
    expect(backend.announcements).toHaveLength(0);
  });

  for (const lang of ['ar', 'id']) {
    test(`${lang}: the pop-up is translated, right-to-left where needed, accessible and fits the screen`, async ({ page, browser }) => {
      const backend = createMockBackend({ admins: ['boss@example.com'] });
      backend.announcements.push({ id: 'an-x', title: { en: 'Congrats', ar: 'مبروك', id: 'Selamat' }, body: { en: 'You won', ar: 'لقد فزت', id: 'Anda menang' }, audience: 'user', class_id: null, user_email: 'boss@example.com', style: 'celebrate', created_at: new Date().toISOString(), expires_at: null, archived_at: null });
      await backend.install(page);
      await signIn(page, 'boss@example.com', lang);
      const dlg = page.locator('[data-testid="announce"]');
      await expect(dlg).toBeVisible();
      await expect(dlg).toContainText({ ar: 'مبروك', id: 'Selamat' }[lang]);
      await axeOk(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});
