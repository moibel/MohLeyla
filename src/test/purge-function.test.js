// The daily clean-up of chat files (supabase/functions/purge-files), tested without a server.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { authorised, pathsOf, purge } from '../../supabase/functions/purge-files/lib.js';

const SECRET = 'x'.repeat(32);

describe('purge-files', () => {
  it('refuses a wrong secret, and refuses everyone when the configured secret is missing or short', () => {
    expect(authorised(SECRET, SECRET)).toBe(true);
    for (const [given, set] of [['', SECRET], [`${SECRET}y`, SECRET], ['', ''], [undefined, undefined], ['short', 'short']]) expect(authorised(given, set)).toBe(false);
    const index = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/purge-files/index.ts'), 'utf8');
    expect(index.indexOf('authorised(')).toBeLessThan(index.indexOf('createClient(env'));
  });
  it('ignores unsafe or broken paths', () => {
    expect(pathsOf([{ path: 'a/b.jpg' }, { path: 'a/b.jpg' }, { path: '/etc' }, { path: 'a/../b' }, { path: '' }, {}, null])).toEqual(['a/b.jpg']);
  });
  it('removes until nothing is left, and stops instead of looping when removal fails', async () => {
    let files = Array.from({ length: 230 }, (_, i) => ({ path: `c/${i}.jpg` }));
    const ok = await purge({ list: async () => ({ data: files }), remove: async (p) => { files = files.filter((f) => !p.includes(f.path)); return { data: p }; } });
    expect(ok).toMatchObject({ removed: 230, failed: 0, error: null });
    const list = vi.fn(async () => ({ data: [{ path: 'c/stuck.jpg' }] }));
    const bad = await purge({ list, remove: async () => ({ error: { message: 'no' } }) });
    expect(bad.error).toBe('remove');
    expect(list).toHaveBeenCalledTimes(1);
  });
});
