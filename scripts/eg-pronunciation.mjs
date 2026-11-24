// What the Egyptian voice is SENT (the lesson text on screen does not change). Rules set by the course owner:
//   ق as the FIRST letter of a word  ->  أ  (a short glottal stop: قوي -> أوي, قهوة -> أهوة, قريب -> أريب)
//   ق anywhere else                  ->  stays ق, a real q (القاهرة, السوق, دلوقتي, موافق, وقف ...)
//   ج                                ->  گ  (Persian gaf, which reads as a hard g: جميل -> گميل)
// A text-to-speech voice reads ج as j, so it needs the changed letter. Text without ق or ج is sent as it is.
// A "word" is one run of letters (with their vowel marks); a prefix such as ال or و is part of the word, so the ق of القهوة is not first.
// The clip file name is still made from the lesson text, so nothing else changes.
const WORD = /[ء-يٱً-ْ]+/g;
const startQ = (w) => (w[0] === 'ق' ? ('أ' + w.slice(1)).replace(/^أَ?ا/, 'آ') : w); // a following long ā becomes the single letter آ
export function toCairene(text) {
  return String(text).replace(WORD, (w) => startQ(w).replace(/ج/g, 'گ'));
}
