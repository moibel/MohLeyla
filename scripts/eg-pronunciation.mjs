// What the Egyptian voice is SENT (the lesson text on screen does not change).
// Cairo says ق as a short glottal stop (hamza) and ج as a hard "g" (gamīl, gaww, ginēh); the lessons' own Latin spelling uses ʾ and g the same way.
// A text-to-speech voice reads the letters ق and ج the Standard Arabic way (q, j), so for the voice only:
//   ق  ->  أ   (qahwa -> ʾahwa; a following long ā becomes the single letter آ)
//   ج  ->  گ   (Persian gaf, which reads as g)
// Words that Egyptians really do say with "q" keep their ق (KEEP_Q, compared without vowel marks and without the article/prefixes' marks).
// The clip file name is still made from the lesson text, so nothing else changes.
const MARKS = /[ً-ْ]/g;
const WORD = /[ء-يٱً-ْ]+/g;
export const KEEP_Q = new Set(['القاهرة', 'القاهره', 'والقاهرة', 'بالقاهرة', 'للقاهرة']);
const soften = (w) => w.replace(/ق/g, 'أ').replace(/أَ?ا/g, 'آ'); // أَا -> آ (hamza + fatha + long a)
export function toCairene(text) {
  return String(text).replace(WORD, (w) => (KEEP_Q.has(w.replace(MARKS, '')) ? w.replace(/ج/g, 'گ') : soften(w).replace(/ج/g, 'گ')));
}
