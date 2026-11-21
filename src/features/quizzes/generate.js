// Exercise generation. Pure functions: (lesson, uiLang, rng) -> exercises. Every exercise is self-describing so the UI
// stays dumb, and `evaluate` decides correctness.
//
// Text "lang" markers: 'target' = the language being learned (item.target…), 'ui' = interface language (explanations).
import { trackLang } from '../../data/content.js';
import { shuffle, pick } from '../../utils/random.js';

const unique = (arr, keyFn) => {
  const seen = new Set();
  return arr.filter((x) => {
    const k = keyFn(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/** Build answer choices: the correct one plus `n-1` distinct distractors. No duplicate texts, no duplicate correct answer. */
export function makeChoices(correct, pool, n, rng) {
  const used = new Set([correct.text]);
  const distractors = [];
  for (const c of shuffle(pool, rng)) {
    if (used.has(c.text)) continue;
    used.add(c.text);
    distractors.push(c);
    if (distractors.length === n - 1) break;
  }
  return shuffle([correct, ...distractors], rng);
}

const tokensOf = (sentence) => sentence.split(/\s+/).filter(Boolean);

export function buildExercises(lesson, ui, rng = Math.random) {
  const items = lesson.items;
  const same = trackLang(lesson.track) === ui; // learning language == interface language
  const meaning = (it) => it.tr[ui];
  const rotation = shuffle(items, rng);
  let cursor = 0;
  const nextItem = () => rotation[cursor++ % rotation.length];
  const targetChoice = (it) => ({ id: it.id, text: it.target, lang: 'target' });
  const meaningChoice = (it) => ({ id: it.id, text: meaning(it), lang: 'ui' });
  const exercises = [];
  let n = 0;
  const id = (type) => `${lesson.id}:${type}:${n++}`;

  const meaningEx = () => {
    const it = nextItem();
    return {
      id: id('meaning'), type: 'meaning', itemId: it.id,
      prompt: { key: 'quiz.prompt.meaningOf' },
      stimulus: { text: it.target, lang: 'target', audio: it.target },
      choices: makeChoices(meaningChoice(it), items.filter((x) => x !== it).map(meaningChoice), 4, rng),
      answerId: it.id,
      explain: { key: same ? 'quiz.explainSame' : 'quiz.explainMeaning', params: { target: it.target, meaning: meaning(it) }, audio: it.target },
    };
  };
  const translateToEx = () => {
    const it = nextItem();
    return {
      id: id('translateTo'), type: same ? 'defineSame' : 'translateTo', itemId: it.id,
      prompt: same ? { key: 'quiz.prompt.defineSame' } : { key: 'quiz.prompt.sayIn', lang: true },
      stimulus: { text: meaning(it), lang: 'ui' },
      choices: makeChoices(targetChoice(it), items.filter((x) => x !== it).map(targetChoice), 4, rng),
      answerId: it.id,
      explain: { key: same ? 'quiz.explainSame' : 'quiz.explainMeaning', params: { target: it.target, meaning: meaning(it) }, audio: it.target },
    };
  };
  const listeningEx = () => {
    const it = nextItem();
    return {
      id: id('listening'), type: 'listening', itemId: it.id,
      prompt: { key: 'quiz.prompt.sayHeard' },
      stimulus: { audioOnly: true, audio: it.target },
      choices: makeChoices(targetChoice(it), items.filter((x) => x !== it).map(targetChoice), 4, rng),
      answerId: it.id,
      explain: { key: 'quiz.explainListening', params: { target: it.target, meaning: meaning(it) }, audio: it.target },
    };
  };
  const matchEx = () => {
    const chosen = pick(items, Math.min(5, items.length), rng);
    return {
      id: id('match'), type: 'match', itemIds: chosen.map((c) => c.id),
      prompt: { key: 'quiz.types.match' },
      pairs: chosen.map((c) => ({ id: c.id, left: { text: c.target, lang: 'target', audio: c.target }, right: { text: meaning(c), lang: 'ui' } })),
      leftOrder: shuffle(chosen.map((c) => c.id), rng),
      rightOrder: shuffle(chosen.map((c) => c.id), rng),
      explain: { key: 'quiz.explainMeaning', params: {} },
    };
  };
  const clozes = [...lesson.cloze];
  const fillEx = () => {
    const c = clozes.shift() || lesson.cloze[0];
    const full = c.sentence.replace('___', c.answer);
    return {
      id: id('fill'), type: 'fill', itemId: null,
      prompt: { key: 'quiz.types.fill' },
      stimulus: { text: c.sentence, lang: 'target', blank: true, hint: c.tr[ui], audioAfter: full },
      choices: makeChoices({ id: 'ans', text: c.answer, lang: 'target' }, c.wrong.map((w, i) => ({ id: `w${i}`, text: w, lang: 'target' })), 4, rng),
      answerId: 'ans',
      explain: { text: c.why[ui], audio: full },
    };
  };
  const arrangeCandidates = shuffle(items.filter((it) => { const t = tokensOf(it.example.target).length; return t >= 3 && t <= 9; }), rng);
  const arrangeEx = () => {
    const it = arrangeCandidates.shift();
    if (!it) return null;
    const tokens = tokensOf(it.example.target);
    let bank = shuffle(tokens.map((text, i) => ({ id: `t${i}`, text })), rng);
    for (let tries = 0; tries < 5 && bank.map((b) => b.text).join(' ') === tokens.join(' '); tries++) bank = shuffle(bank, rng);
    return {
      id: id('arrange'), type: 'arrange', itemId: it.id,
      prompt: { key: 'quiz.prompt.arrangeFor', params: { text: it.example.tr[ui] } },
      tokens, bank,
      explain: { key: 'quiz.explainArrange', params: { sentence: it.example.target }, audio: it.example.target },
    };
  };
  const translateEx = () => {
    const it = nextItem();
    const pool = unique(items.filter((x) => x !== it), (x) => x.example.target).map((x) => ({ id: x.id, text: x.example.target, lang: 'target' }));
    return {
      id: id('translate'), type: 'translate', itemId: it.id,
      prompt: { key: 'quiz.prompt.translateSentence' },
      stimulus: { text: it.example.tr[ui], lang: 'ui' },
      choices: makeChoices({ id: it.id, text: it.example.target, lang: 'target' }, pool, 4, rng),
      answerId: it.id,
      explain: { key: 'quiz.explainTranslate', params: { meaning: it.example.tr[ui] }, audio: it.example.target },
    };
  };
  const conversationEx = () => {
    const cv = lesson.conversation;
    const right = cv.turns[cv.gap].target;
    return {
      id: id('conversation'), type: 'conversation', itemId: null,
      prompt: { key: 'quiz.prompt.conversationFor' },
      context: cv.context[ui],
      turns: cv.turns.map((t, i) => ({ who: t.who, text: i === cv.gap ? null : t.target, tr: t.tr[ui], audio: i === cv.gap ? null : t.target })),
      gap: cv.gap,
      choices: makeChoices({ id: 'ans', text: right, lang: 'target' }, cv.wrong.map((w, i) => ({ id: `w${i}`, text: w, lang: 'target' })), 4, rng),
      answerId: 'ans',
      explain: { text: cv.why[ui], audio: right },
    };
  };

  // Interleave types so consecutive questions rarely look alike.
  const plan = [meaningEx, listeningEx, translateToEx, matchEx, fillEx, arrangeEx, meaningEx, listeningEx, translateToEx, fillEx,
    arrangeEx, translateEx, listeningEx, meaningEx, translateToEx, conversationEx];
  for (const make of plan) {
    const ex = make();
    if (ex) exercises.push(ex);
  }
  return exercises;
}

/** @returns {{correct:boolean}} resp: choice -> choice id; arrange -> array of tokens; match -> { mistakes:number } */
export function evaluate(ex, resp) {
  if (ex.type === 'arrange') return { correct: Array.isArray(resp) && resp.join(' ') === ex.tokens.join(' ') };
  if (ex.type === 'match') return { correct: !!resp && resp.mistakes === 0 };
  return { correct: resp === ex.answerId };
}

/** Sanity checks used by the test-suite: valid answers, no duplicate choices. */
export function validateExercise(ex) {
  const errs = [];
  if (ex.choices) {
    const texts = ex.choices.map((c) => c.text);
    if (new Set(texts).size !== texts.length) errs.push(`${ex.id}: duplicate choices`);
    if (ex.choices.length < 3) errs.push(`${ex.id}: fewer than 3 choices`);
    if (ex.choices.filter((c) => c.id === ex.answerId).length !== 1) errs.push(`${ex.id}: answer must appear exactly once`);
  }
  if (ex.type === 'arrange' && ex.tokens.length < 3) errs.push(`${ex.id}: arrange too short`);
  if (ex.type === 'match' && ex.pairs.length < 3) errs.push(`${ex.id}: match too small`);
  return errs;
}
