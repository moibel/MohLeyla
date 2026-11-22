import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// The browser calls database functions by name with named parameters. If the app and supabase/migrations/002_roles_classes.sql
// ever disagree, every call fails at runtime. This test keeps them in step.
const sql = ['002_roles_classes.sql', '003_rewards.sql'].map((f) => fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', f), 'utf8')).join('\n');
const api = fs.readFileSync(path.resolve(__dirname, '../features/classes/api.js'), 'utf8');
const sync = fs.readFileSync(path.resolve(__dirname, '../features/sync/syncManager.js'), 'utf8');

function signature(name) {
  const m = sql.match(new RegExp(`create or replace function public\\.${name}\\(([^)]*)\\)`, 's'));
  return m ? m[1].split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean) : null;
}

describe('app <-> database contract', () => {
  const calls = [...api.matchAll(/rpc\('(\w+)'(?:,\s*\{([^}]*)\})?\)/g)].map((m) => ({ fn: m[1], params: (m[2] || '').split(',').map((x) => x.split(':')[0].trim()).filter(Boolean) }));
  it('finds every rpc call in the api module', () => {
    expect(calls.map((c) => c.fn).sort()).toEqual(['admin_grant_reward', 'admin_list_rewards', 'admin_list_users', 'admin_revoke_reward', 'admin_set_role', 'class_roster', 'create_class', 'delete_class', 'join_class', 'my_memberships', 'my_rewards', 'teacher_classes']);
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
    const files = { '002_roles_classes.sql': ['my_role', 'create_class', 'join_class', 'my_memberships', 'teacher_classes', 'class_roster', 'delete_class', 'admin_list_users', 'admin_set_role'], '003_rewards.sql': ['my_rewards', 'admin_grant_reward', 'admin_list_rewards', 'admin_revoke_reward'] };
    for (const [file, fns] of Object.entries(files)) {
      const text = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations', file), 'utf8');
      const grant = text.slice(text.lastIndexOf('grant execute on function'));
      for (const fn of fns) expect(grant, `${file}: ${fn}`).toContain(`public.${fn}(`);
      expect(grant, file).toMatch(/to authenticated;\s*$/);
      expect(text, file).toMatch(/revoke all on function[\s\S]*from public, anon;/);
    }
  });
  it('the rewards table has no direct access for browsers (row level security on, every privilege revoked)', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/003_rewards.sql'), 'utf8');
    expect(text).toMatch(/alter table public\.rewards enable row level security/);
    expect(text).toMatch(/revoke all on public\.rewards from anon, authenticated/);
    expect(text).not.toMatch(/create policy[^;]*public\.rewards/);
  });
});
