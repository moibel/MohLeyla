// Content-addressed audio file names: the same text always maps to the same file, so clips can be
// generated once, cached forever, and looked up without a database. Shared by the app and scripts/generate-audio.mjs.
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export const normalizeSpeech = (text) => String(text).normalize('NFC').replace(/\s+/g, ' ').trim();

/** @param {'ar'|'en'|'id'} lang  speech language (Saudi Arabic uses 'ar') */
export function audioKey(text, lang) {
  return cyrb53(`${lang}|${normalizeSpeech(text)}`).toString(36);
}
export const audioPath = (text, lang) => `/audio/${lang}/${audioKey(text, lang)}.mp3`;
