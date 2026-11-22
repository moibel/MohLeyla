import { describe, it, expect } from 'vitest';
import { profileFromUser, displayName, initialsOf, cleanName, colorIndex, MAX_NAME } from '../features/sync/profile.js';
import { SyncManager, NAME_ASKED_KEY } from '../features/sync/syncManager.js';

describe('profile helpers', () => {
  it('reads Google metadata (full_name/picture) and email display_name', () => {
    const g = profileFromUser({ email: 'a@b.co', user_metadata: { full_name: 'Aisha Khan', picture: 'https://lh3.googleusercontent.com/x' }, created_at: '2026-11-01' });
    expect(g).toMatchObject({ name: 'Aisha Khan', email: 'a@b.co', avatarUrl: 'https://lh3.googleusercontent.com/x', createdAt: '2026-11-01' });
    expect(profileFromUser({ email: 'a@b.co', user_metadata: { display_name: 'Amina' } }).name).toBe('Amina');
    expect(profileFromUser({ email: 'a@b.co' })).toMatchObject({ name: '', avatarUrl: null });
    expect(profileFromUser(null)).toMatchObject({ name: '', email: '' });
  });
  it('display_name wins over the Google name; only https avatars are used', () => {
    expect(profileFromUser({ user_metadata: { display_name: 'Mimi', full_name: 'Maria Lopez' } }).name).toBe('Mimi');
    expect(profileFromUser({ user_metadata: { avatar_url: 'http://insecure/x.png' } }).avatarUrl).toBeNull();
    expect(profileFromUser({ user_metadata: { avatar_url: 'javascript:alert(1)' } }).avatarUrl).toBeNull();
  });
  it('cleans names: control chars, angle brackets, spaces, length', () => {
    expect(cleanName('  <b>Omar</b>\n  Salem  ')).toBe('bOmar/b Salem');
    expect(cleanName('x'.repeat(100))).toHaveLength(MAX_NAME);
    expect(cleanName(null)).toBe('');
  });
  it('falls back to the readable part of the email', () => {
    expect(displayName({ name: '', email: 'omar.salem@example.com' })).toBe('omar salem');
    expect(displayName({ name: 'Layla', email: 'x@y.co' })).toBe('Layla');
    expect(displayName(null)).toBe('');
  });
  it('makes initials for Latin and Arabic names, and a stable colour', () => {
    expect(initialsOf('Amina Khan')).toBe('AK');
    expect(initialsOf('Omar')).toBe('O');
    expect(initialsOf('ليلى أحمد')).toBe('لأ');
    expect(initialsOf('')).toBe('?');
    expect(colorIndex('a@b.co')).toBe(colorIndex('a@b.co'));
    expect(colorIndex('x', 6)).toBeLessThan(6);
  });
});

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) }; };

describe('SyncManager profile', () => {
  const user = { id: 'u1', email: 'a@b.co', user_metadata: {} };
  const manager = (updateUser, online = true) => {
    const storage = mem();
    const mgr = new SyncManager({ createClient: async () => ({ auth: { onAuthStateChange() {}, updateUser, getSession: async () => ({ data: { session: null } }) } }), configured: true, storage, getOnline: () => online });
    mgr.setUser(user, { status: 'synced' });
    return { mgr, storage };
  };
  it('updateName stores the name in the account, updates the profile and remembers the answer', async () => {
    let sent;
    const { mgr, storage } = manager(async (payload) => { sent = payload; return { data: { user: { ...user, user_metadata: { display_name: payload.data.display_name } } }, error: null }; });
    expect(mgr.nameAsked()).toBe(false);
    expect(await mgr.updateName('  Amina  ')).toBe(true);
    expect(sent).toEqual({ data: { display_name: 'Amina' } });
    expect(mgr.getSnapshot().profile.name).toBe('Amina');
    expect(mgr.nameAsked()).toBe(true);
    expect(JSON.parse(storage.getItem('mohleyla-session-hint')).profile.name).toBe('Amina'); // available offline next start
  });
  it('rejects empty names and reports failures without changing the profile', async () => {
    const { mgr } = manager(async () => ({ data: {}, error: { message: 'boom' } }));
    expect(await mgr.updateName('   ')).toBe(false);
    expect(mgr.getSnapshot().error).toBe('nameInvalid');
    expect(await mgr.updateName('Amina')).toBe(false);
    expect(mgr.getSnapshot().error).toBe('nameFailed');
    expect(mgr.getSnapshot().profile.name).toBe('');
  });
  it('skipping the prompt is remembered per user', () => {
    const { mgr, storage } = manager(async () => ({}));
    mgr.skipNamePrompt();
    expect(mgr.nameAsked()).toBe(true);
    expect(JSON.parse(storage.getItem(NAME_ASKED_KEY))).toEqual(['u1']);
  });
  it('the profile is restored from the remembered session, so the greeting works offline', () => {
    const storage = mem();
    storage.setItem('mohleyla-session-hint', JSON.stringify({ userId: 'u1', email: 'a@b.co', profile: { name: 'Amina', email: 'a@b.co', avatarUrl: null } }));
    const mgr = new SyncManager({ createClient: async () => ({}), configured: true, storage, getOnline: () => false });
    expect(mgr.getSnapshot().profile.name).toBe('Amina');
  });
});
