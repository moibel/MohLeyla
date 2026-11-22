// Content validator shared by `npm run validate:content` and the Vitest suite.
// Pure JS, no DOM: it can run in Node directly.

export const UI_LANGS = ['ar', 'en', 'id'];
export const TRACKS = ['ar', 'sa', 'eg', 'en', 'id', 'fr', 'es', 'zh'];
/** Dialect tracks teach a spoken variety of Arabic; their text is Arabic script and their audio is a Standard Arabic voice. */
export const DIALECT_TRACKS = ['sa', 'eg'];
/** Tracks not yet reviewed by a native speaker, and how many lessons each is expected to have in this release. */
export const BETA_TRACKS = ['eg', 'fr', 'es', 'zh'];
export const TRACK_SIZES = { ar: 30, sa: 30, en: 30, id: 30, eg: 10, fr: 10, es: 10, zh: 10 };
export const LEVELS = ['beginner', 'elementary', 'intermediate'];
const ARABIC = /[؀-ۿ]/;
const CJK = /[\u3400-\u9fff]/;
const PINYIN_TONE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
const LATIN = /[A-Za-z]/;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

/** The language a track teaches ('sa' and 'eg' teach Arabic). */
export const trackLang = (track) => (track === 'sa' || track === 'eg' ? 'ar' : track);

function checkTri(obj, path, errors, { allowSame } = {}) {
  if (!obj || typeof obj !== 'object') {
    errors.push(`${path}: missing trilingual object`);
    return;
  }
  for (const l of UI_LANGS) {
    if (!isStr(obj[l])) errors.push(`${path}.${l}: empty or missing`);
  }
  if (isStr(obj.ar) && !ARABIC.test(obj.ar)) errors.push(`${path}.ar: contains no Arabic script`);
  if (isStr(obj.en) && ARABIC.test(obj.en)) errors.push(`${path}.en: contains Arabic script`);
  if (isStr(obj.id) && ARABIC.test(obj.id)) errors.push(`${path}.id: contains Arabic script`);
  void allowSame;
}

function checkTarget(text, track, path, errors) {
  if (!isStr(text)) {
    errors.push(`${path}: empty target text`);
    return;
  }
  const lang = trackLang(track);
  if (lang === 'ar' && !ARABIC.test(text)) errors.push(`${path}: Arabic track text has no Arabic script`);
  if (lang !== 'ar' && ARABIC.test(text)) errors.push(`${path}: non-Arabic track text contains Arabic script`);
  if (lang === 'zh') { if (!CJK.test(text)) errors.push(`${path}: Chinese track text has no Chinese characters`); if (/\s/.test(text.trim())) errors.push(`${path}: Chinese text must not contain spaces`); }
  else if (lang !== 'ar' && !LATIN.test(text)) errors.push(`${path}: no Latin letters`);
}

export function validateLesson(lesson, ctx = {}) {
  const errors = [];
  const p = `lesson ${lesson?.id ?? '?'}`;
  if (!lesson || typeof lesson !== 'object') return [`${p}: not an object`];
  if (!isStr(lesson.id) || !/^(ar|sa|eg|en|id|fr|es|zh)-\d{2}$/.test(lesson.id)) errors.push(`${p}: bad id`);
  if (!TRACKS.includes(lesson.track)) errors.push(`${p}: bad track`);
  if (lesson.id && lesson.track && !lesson.id.startsWith(lesson.track + '-')) errors.push(`${p}: id/track mismatch`);
  if (!LEVELS.includes(lesson.level)) errors.push(`${p}: bad level ${lesson.level}`);
  if (!Number.isInteger(lesson.order) || lesson.order < 1 || lesson.order > 30) errors.push(`${p}: order must be 1..30`);
  if (!isStr(lesson.icon)) errors.push(`${p}: icon missing`);
  if (!isStr(lesson.topic)) errors.push(`${p}: topic missing`);
  for (const k of ['title', 'description', 'intro', 'culture', 'summary']) checkTri(lesson[k], `${p}.${k}`, errors);
  if (!Array.isArray(lesson.objectives) || lesson.objectives.length < 3) errors.push(`${p}: need >=3 objectives`);
  else lesson.objectives.forEach((o, i) => checkTri(o, `${p}.objectives[${i}]`, errors));
  if (lesson.grammar) {
    checkTri(lesson.grammar.title, `${p}.grammar.title`, errors);
    checkTri(lesson.grammar.body, `${p}.grammar.body`, errors);
  }

  const items = lesson.items;
  if (!Array.isArray(items) || items.length < 6) errors.push(`${p}: need >=6 items (has ${items?.length ?? 0})`);
  else {
    const seenTargets = new Set();
    items.forEach((it, i) => {
      const ip = `${p}.items[${i}](${it?.id})`;
      if (!isStr(it.id) || !/^[a-z0-9]+$/i.test(it.id)) errors.push(`${ip}: bad id`);
      if (ctx.seenItemIds) {
        if (ctx.seenItemIds.has(it.id)) errors.push(`${ip}: duplicate item id`);
        ctx.seenItemIds.add(it.id);
      }
      checkTarget(it.target, lesson.track, `${ip}.target`, errors);
      if (seenTargets.has(it.target)) errors.push(`${ip}: duplicate target within lesson`);
      seenTargets.add(it.target);
      if (!isStr(it.translit)) errors.push(`${ip}.translit missing`);
      else if (trackLang(lesson.track) === 'zh' && it.target.length > 1 && !PINYIN_TONE.test(it.translit)) errors.push(`${ip}.translit: pinyin needs tone marks (e.g. nǐ hǎo)`);
      else if (trackLang(lesson.track) === 'zh' && CJK.test(it.translit)) errors.push(`${ip}.translit: must be pinyin, not Chinese characters`);
      checkTri(it.tr, `${ip}.tr`, errors);
      const tl = trackLang(lesson.track);
      if (it.tr && isStr(it.tr[tl]) && it.tr[tl].trim() === it.target.trim()) {
        errors.push(`${ip}.tr.${tl}: must be a short gloss, not a copy of the target`);
      }
      if (!it.example) errors.push(`${ip}.example missing`);
      else {
        checkTarget(it.example.target, lesson.track, `${ip}.example.target`, errors);
        checkTri(it.example.tr, `${ip}.example.tr`, errors);
      }
    });
  }

  if (!Array.isArray(lesson.cloze) || lesson.cloze.length < 2) errors.push(`${p}: need >=2 cloze`);
  else {
    lesson.cloze.forEach((c, i) => {
      const cp = `${p}.cloze[${i}]`;
      if (!isStr(c.sentence) || (c.sentence.match(/___/g) || []).length !== 1) errors.push(`${cp}: sentence needs exactly one ___`);
      else checkTarget(c.sentence.replace('___', ''), lesson.track, `${cp}.sentence`, errors);
      if (!isStr(c.answer)) errors.push(`${cp}: answer missing`);
      if (!Array.isArray(c.wrong) || c.wrong.length < 2) errors.push(`${cp}: need >=2 wrong`);
      else {
        const all = [c.answer, ...c.wrong];
        if (new Set(all).size !== all.length) errors.push(`${cp}: duplicate options`);
      }
      checkTri(c.tr, `${cp}.tr`, errors);
      checkTri(c.why, `${cp}.why`, errors);
    });
  }

  const cv = lesson.conversation;
  if (!cv) errors.push(`${p}: conversation missing`);
  else {
    checkTri(cv.context, `${p}.conversation.context`, errors);
    if (!Array.isArray(cv.turns) || cv.turns.length < 2) errors.push(`${p}.conversation: need >=2 turns`);
    else {
      cv.turns.forEach((t, i) => {
        checkTarget(t.target, lesson.track, `${p}.conversation.turns[${i}]`, errors);
        checkTri(t.tr, `${p}.conversation.turns[${i}].tr`, errors);
      });
    }
    if (!Number.isInteger(cv.gap) || !cv.turns || cv.gap < 1 || cv.gap >= cv.turns.length + 0) {
      errors.push(`${p}.conversation.gap invalid`);
    }
    if (!Array.isArray(cv.wrong) || cv.wrong.length < 2) errors.push(`${p}.conversation: need >=2 wrong`);
    else if (cv.turns && Number.isInteger(cv.gap) && cv.turns[cv.gap]) {
      const all = [cv.turns[cv.gap].target, ...cv.wrong];
      if (new Set(all).size !== all.length) errors.push(`${p}.conversation: duplicate options`);
    }
    checkTri(cv.why, `${p}.conversation.why`, errors);
  }
  return errors;
}

export function validateLessons(lessons) {
  const errors = [];
  const ids = new Set();
  const ctx = { seenItemIds: new Set() };
  for (const l of lessons) {
    if (ids.has(l.id)) errors.push(`duplicate lesson id ${l.id}`);
    ids.add(l.id);
    errors.push(...validateLesson(l, ctx));
  }
  return errors;
}
