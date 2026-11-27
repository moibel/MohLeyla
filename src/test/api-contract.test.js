import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// The browser calls database functions by name with named parameters. If the app and supabase/migrations/002_roles_classes.sql
// ever disagree, every call fails at runtime. This test keeps them in step.
const sql = ['002_roles_classes.sql', '003_rewards.sql', '004_announcements.sql', '005_content_switch.sql', '006_announcements_pro.sql', '007_chat.sql', '008_chat_attachments.sql', '009_content_switch_languages.sql', '010_calls.sql', '014_security_hardening.sql'].map((f) => fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', f), 'utf8')).join('\n');
const api = fs.readFileSync(path.resolve(__dirname, '../features/classes/api.js'), 'utf8');
const sync = fs.readFileSync(path.resolve(__dirname, '../features/sync/syncManager.js'), 'utf8');

function signature(name) {
  // the latest definition wins (a later migration may replace a function)
  const all = [...sql.matchAll(new RegExp(`create or replace function public\\.${name}\\(([^)]*)\\)`, 'gs'))];
  const m = all[all.length - 1];
  return m ? m[1].split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean) : null;
}

describe('app <-> database contract', () => {
  const calls = [...api.matchAll(/rpc\('(\w+)'(?:,\s*\{([^}]*)\})?\)/g)].map((m) => ({ fn: m[1], params: (m[2] || '').split(',').map((x) => x.split(':')[0].trim()).filter(Boolean) }));
  it('finds every rpc call in the api module', () => {
    expect(calls.map((c) => c.fn).sort()).toEqual([...['admin_archive_announcement', 'admin_chat_messages', 'admin_create_announcement', 'admin_grant_reward', 'admin_list_chats', 'admin_list_announcements', 'admin_list_rewards', 'admin_list_users', 'admin_remove_message', 'admin_revoke_reward', 'admin_set_content_enabled', 'admin_set_role', 'answer_call', 'call_poll', 'call_signal_send', 'chat_messages_of', 'chat_unread_total', 'class_roster', 'content_disabled', 'create_class', 'delete_class', 'end_call', 'join_class', 'mark_chat_read', 'my_announcements', 'my_chats', 'my_incoming_calls', 'my_memberships', 'my_rewards', 'send_attachment', 'send_message', 'start_call', 'start_chat', 'teacher_classes', 'report_chat', 'block_chat', 'unblock_chat', 'admin_list_reports', 'admin_resolve_report', 'admin_set_suspended', 'rotate_class_code', 'teacher_class_bans', 'teacher_unban'].sort()]);
  });
  for (const c of calls) {
    it(`${c.fn}: the function exists and takes exactly the parameters the app sends`, () => {
      expect(signature(c.fn), `function ${c.fn} in SQL`).not.toBeNull();
      expect(signature(c.fn).sort()).toEqual([...c.params].sort());
    });
  }
  it('my_role (called by the sync manager) exists and takes no parameters', () => {
    expect(sync).toMatch(/rpc\('my_role'\)/);
    expect(signature('my_role')).toEqual([]);
  });
  it('the membership table the app deletes from exists with the columns it filters on', () => {
    expect(api).toMatch(/from\('class_members'\)\.delete\(\)\.eq\('class_id'/);
    expect(sql).toMatch(/create table if not exists public\.class_members[\s\S]*class_id[\s\S]*student_id/);
  });
  it('every function the app can call is granted to signed-in users only (never to anon or public)', () => {
    const files = { '002_roles_classes.sql': ['my_role', 'create_class', 'join_class', 'my_memberships', 'teacher_classes', 'class_roster', 'delete_class', 'admin_list_users', 'admin_set_role'], '003_rewards.sql': ['my_rewards', 'admin_grant_reward', 'admin_list_rewards', 'admin_revoke_reward'], '004_announcements.sql': ['my_announcements', 'admin_create_announcement', 'admin_list_announcements', 'admin_archive_announcement'], '005_content_switch.sql': ['admin_set_content_enabled'], '008_chat_attachments.sql': ['send_attachment', 'admin_expired_files'], '010_calls.sql': ['start_call', 'answer_call', 'end_call', 'call_signal_send', 'call_poll', 'my_incoming_calls'], '007_chat.sql': ['start_chat', 'send_message', 'my_chats', 'chat_messages_of', 'mark_chat_read', 'chat_unread_total', 'admin_list_chats', 'admin_chat_messages', 'admin_remove_message'] }; // content_disabled is public on purpose and checked in its own test below
    for (const [file, fns] of Object.entries(files)) {
      const text = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', file), 'utf8');
      const grant = text.slice(text.lastIndexOf('grant execute on function'));
      for (const fn of fns) expect(grant, `${file}: ${fn}`).toContain(`public.${fn}(`);
      expect(grant, file).toMatch(/to authenticated;\s*$/);
      expect(text, file).toMatch(/revoke all on function[\s\S]*from public, anon(, authenticated)?;/);
    }
  });
  it('the terms acceptance the sync manager records exists with that parameter, and nothing new in 014 is open to signed-out visitors', () => {
    expect(sync).toMatch(/rpc\('accept_terms', \{ p_version: version \}\)/);
    expect(signature('accept_terms')).toEqual(['p_version']);
    const text = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/014_security_hardening.sql'), 'utf8');
    for (const g of text.match(/grant execute on function[^;]*;/g)) expect(g).not.toMatch(/\bto\b[^;]*\b(anon|public)\b(?!\.)/);
    expect(text).toMatch(/revoke all on function[\s\S]*?from public, anon/);
  });
  it('the announcements table has no direct access for browsers either', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/004_announcements.sql'), 'utf8');
    expect(text).toMatch(/alter table public\.announcements enable row level security/);
    expect(text).toMatch(/revoke all on public\.announcements from anon, authenticated/);
    expect(text).not.toMatch(/create policy[^;]*public\.announcements/);
  });
  it('the content-switch table has no direct access; only the public read function is open to signed-out visitors', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/005_content_switch.sql'), 'utf8');
    expect(text).toMatch(/alter table public\.content_switches enable row level security/);
    expect(text).toMatch(/revoke all on public\.content_switches from anon, authenticated/);
    expect(text).not.toMatch(/create policy[^;]*public\.content_switches/);
    expect(text).toMatch(/grant execute on function public\.content_disabled\(\) to anon, authenticated;/);
    expect(text).toMatch(/grant execute on function public\.admin_set_content_enabled\(text, text, boolean\) to authenticated;/);
    expect(text).not.toMatch(/admin_set_content_enabled[^;]*to[^;]*anon/);
  });
  it('the chat tables have no direct access for browsers (row level security on, every privilege revoked, no policies)', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/007_chat.sql'), 'utf8');
    for (const t of ['conversations', 'chat_messages', 'chat_reads']) expect(text).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
    expect(text).toMatch(/revoke all on public\.conversations, public\.chat_messages, public\.chat_reads from anon, authenticated/);
    expect(text).not.toMatch(/create policy/);
  });
  it('the call tables have no direct access for browsers', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/010_calls.sql'), 'utf8');
    for (const t of ['calls', 'call_signals']) expect(text).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
    expect(text).toMatch(/revoke all on public\.calls, public\.call_signals from anon, authenticated/);
    expect(text).not.toMatch(/create policy/);
  });
  it('the rewards table has no direct access for browsers (row level security on, every privilege revoked)', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/003_rewards.sql'), 'utf8');
    expect(text).toMatch(/alter table public\.rewards enable row level security/);
    expect(text).toMatch(/revoke all on public\.rewards from anon, authenticated/);
    expect(text).not.toMatch(/create policy[^;]*public\.rewards/);
  });
});
