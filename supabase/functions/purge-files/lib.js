// Pure helpers for the purge-files Edge Function (no network, no Deno-only APIs), so they can be unit-tested in Node.

export const BUCKET = 'chat-files';
export const LIST_SIZE = 500;
export const REMOVE_SIZE = 100;
export const MAX_ROUNDS = 20; // at most 10,000 files a run; the next run takes the rest
export const MIN_SECRET = 24;

/** Constant-time string comparison for the shared secret. */
export function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a ?? ''));
  const y = new TextEncoder().encode(String(b ?? ''));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Is the request allowed? A missing or short configured secret refuses everyone. */
export const authorised = (given, configured) => String(configured ?? '').length >= MIN_SECRET && safeEqual(given, configured);

export const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

/** The paths in the rows of expired_chat_files(). Deliberately lenient about shape: oddly named old uploads must go too. */
export const pathsOf = (rows) => (Array.isArray(rows)
  ? [...new Set(rows.map((r) => r?.path).filter((p) => typeof p === 'string' && p.length > 0 && p.length <= 1024 && !p.startsWith('/') && !p.split('/').includes('..')))]
  : []);

/**
 * List, remove in batches, repeat until nothing is left. Stops on an error, or when a round removes nothing (so a file that
 * cannot be removed never makes it loop). list(limit) -> { data, error }; remove(paths) -> { data, error }.
 */
export async function purge({ list, remove }) {
  const stats = { removed: 0, failed: 0, error: null };
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await list(LIST_SIZE);
    if (error) { stats.error = 'list'; break; }
    const paths = pathsOf(data);
    if (!paths.length) break;
    let gone = 0;
    for (const part of chunk(paths, REMOVE_SIZE)) {
      const res = await remove(part);
      if (res.error) { stats.failed += part.length; stats.error = 'remove'; } else gone += res.data?.length || 0;
    }
    stats.removed += gone;
    if (!gone || stats.error) break;
  }
  return stats;
}
