import { describe, it, expect, vi } from 'vitest';

vi.mock('../features/sync/index.js', () => ({ sync: { ensureClient: vi.fn() } }));
import { sync } from '../features/sync/index.js';
import { ClassError, joinClass, createClass, adminSetRole, removeMember, liveStreak } from '../features/classes/api.js';

const clientWith = (impl) => { sync.ensureClient.mockResolvedValue(impl); };

describe('classes api', () => {
  it('maps database error codes to translatable codes', async () => {
    for (const [code, expected] of [['42501', 'notAllowed'], ['P0002', 'invalidCode'], ['22023', 'invalidInput'], ['55000', 'lastAdmin'], ['XX', 'failed']]) {
      clientWith({ rpc: async () => ({ data: null, error: { code } }) });
      await expect(createClass('x')).rejects.toMatchObject({ code: expected });
    }
  });
  it('returns the first row of join_class and passes the code through', async () => {
    let args;
    clientWith({ rpc: async (fn, a) => { args = [fn, a]; return { data: [{ class_id: 'c1', class_name: 'Arabic 101' }], error: null }; } });
    expect(await joinClass('ab12cd34')).toEqual({ class_id: 'c1', class_name: 'Arabic 101' });
    expect(args).toEqual(['join_class', { p_code: 'ab12cd34' }]);
  });
  it('network failures become a "failed" error instead of an unhandled rejection', async () => {
    clientWith({ rpc: async () => { throw new TypeError('Failed to fetch'); } });
    await expect(adminSetRole('u', 'teacher')).rejects.toBeInstanceOf(ClassError);
  });
  it('removeMember deletes exactly one membership row', async () => {
    const calls = [];
    const chain = { delete() { calls.push('delete'); return chain; }, eq(c, v) { calls.push([c, v]); return calls.length >= 4 ? Promise.resolve({ error: null }) : chain; } };
    clientWith({ from: (t) => { calls.push(t); return chain; } });
    await removeMember('c1', 's1');
    expect(calls).toEqual(['class_members', 'delete', ['class_id', 'c1'], ['student_id', 's1']]);
  });
  it('liveStreak drops to zero when the last learning day was before yesterday', () => {
    expect(liveStreak(5, '2026-11-20', '2026-11-20')).toBe(5);
    expect(liveStreak(5, '2026-11-19', '2026-11-20')).toBe(5);
    expect(liveStreak(5, '2026-11-18', '2026-11-20')).toBe(0);
    expect(liveStreak(0, '2026-11-20', '2026-11-20')).toBe(0);
    expect(liveStreak(4, null, '2026-11-20')).toBe(0);
  });
});
