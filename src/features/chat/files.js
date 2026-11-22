// Voice notes and photos for chat. Files go to the private "chat-files" storage area, in a folder named after the conversation;
// the database decides who may read them (the two people, and admins) and refuses anything else (see supabase/migrations/008).
import { sync } from '../sync/index.js';

export const MAX_FILE = 5 * 1024 * 1024;
export const MAX_VOICE_MS = 120000;
const BUCKET = 'chat-files';

export class FileError extends Error { constructor(code) { super(code); this.code = code; } }

const AUDIO = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/aac': 'aac' };
/** "audio/webm;codecs=opus" -> { mime: "audio/webm", ext: "webm" }; null when the browser made a type the chat does not accept. */
export function audioFormat(type) {
  const mime = String(type || '').split(';')[0].trim().toLowerCase();
  return AUDIO[mime] ? { mime, ext: AUDIO[mime] } : null;
}

async function storage() {
  const c = await sync.ensureClient();
  return c.storage.from(BUCKET);
}

/** Uploads a Blob into the conversation's folder; resolves the stored path. */
export async function uploadChatFile(conv, blob, { mime, ext }) {
  if (!blob || blob.size < 1) throw new FileError('empty');
  if (blob.size > MAX_FILE) throw new FileError('tooBig');
  const path = `${conv}/${crypto.randomUUID()}.${ext}`;
  let res;
  try { res = await (await storage()).upload(path, blob, { contentType: mime, upsert: false }); } catch { throw new FileError(navigator.onLine === false ? 'network' : 'upload'); }
  if (res.error) throw new FileError(navigator.onLine === false ? 'network' : 'upload');
  return path;
}

const urls = new Map(); // path -> { url, until }
/** A one-hour link to a file the signed-in person is allowed to read. */
export async function fileUrl(path) {
  const hit = urls.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  let res;
  try { res = await (await storage()).createSignedUrl(path, 3600); } catch { throw new FileError('network'); }
  if (res.error || !res.data?.signedUrl) throw new FileError('unavailable');
  urls.set(path, { url: res.data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return res.data.signedUrl;
}

export async function removeFiles(paths) {
  if (!paths.length) return;
  const res = await (await storage()).remove(paths);
  if (res.error) throw new FileError('remove');
}

/** Photos are shrunk (longest side 1280 px) and re-encoded as JPEG: small to upload, and the camera's location data is dropped. */
export async function shrinkImage(file, { maxSide = 1280, quality = 0.82 } = {}) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new FileError('badType');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new FileError('badType');
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale)); const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new FileError('badType');
  if (blob.size > MAX_FILE) throw new FileError('tooBig');
  return { blob, mime: 'image/jpeg', ext: 'jpg', width: w, height: h };
}
