import fs from 'node:fs';
import path from 'node:path';

export const lessonsOf = (track) => {
  const dir = path.resolve('src/data/content', track);
  return fs.readdirSync(dir).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
};
export const getLesson = (id) => lessonsOf(id.split('-')[0]).find((l) => l.id === id);

/** Pre-seed storage before the app boots (onboarding skipped, UI language chosen). */
export async function seed(page, { lang = 'en', state = {}, legacy } = {}) {
  await page.addInitScript(({ lang, state, legacy }) => {
    if (sessionStorage.getItem('__seeded')) return; // seed once per tab: reloads keep real data
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('mohleyla-ui-lang', lang);
    if (legacy) localStorage.setItem('mohleyla-v1', JSON.stringify(legacy));
    else {
      const base = { schema: 6, completed: {}, saved: {}, srs: {}, xp: 0, stats: { answered: 0, correct: 0, reviewSessions: 0, reviewAnswered: 0, reviewCorrect: 0 }, days: {}, streak: { current: 0, best: 0, last: null }, settings: { speed: 'normal', source: 'auto', goal: 50, theme: 'light', onboarded: true, lastTrack: null } };
      localStorage.setItem('mohleyla-v6', JSON.stringify({ ...base, ...state, settings: { ...base.settings, ...(state.settings || {}) } }));
    }
  }, { lang, state, legacy });
}

/** Answers the visible exercise correctly (or wrongly when `wrong`). */
export async function solveExercise(page, lesson, ui, { wrong = false } = {}) {
  const opts = page.locator('[data-testid="opt-correct"]');
  if (await opts.count()) {
    if (wrong) await page.locator('[data-testid="opt"]').first().click();
    else await opts.first().click();
    return 'choice';
  }
  if (await page.locator('[data-testid="match-left"]').count()) {
    const ids = await page.locator('[data-testid="match-left"]').evaluateAll((els) => els.map((e) => e.dataset.pair));
    for (const id of ids) {
      await page.locator(`[data-testid="match-left"][data-pair="${id}"]`).click();
      await page.locator(`[data-testid="match-right"][data-pair="${id}"]`).click();
    }
    return 'match';
  }
  if (await page.locator('[data-testid="tile"]').count()) {
    const prompt = await page.locator('.stimulus-text').first().innerText();
    const item = lesson.items.find((i) => prompt.includes(i.example.tr[ui]));
    const tokens = item.example.target.split(/\s+/).filter(Boolean);
    const order = wrong ? [...tokens].reverse() : tokens;
    for (const tok of order) {
      const tile = page.locator('[data-testid="tile"]:not([disabled])').filter({ hasText: new RegExp('^' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();
      await tile.click();
    }
    await page.locator('[data-testid="check"]').click();
    return 'arrange';
  }
  throw new Error('unknown exercise');
}

export async function playThrough(page, lesson, ui, { wrongFirst = false } = {}) {
  await page.locator('[data-testid="start-learn"]').click();
  for (let i = 0; i < lesson.items.length; i++) await page.locator('[data-testid="next-word"]').click();
  let first = true;
  for (let guard = 0; guard < 40; guard++) {
    if (await page.locator('[data-testid="result"]').count()) return;
    const kind = await solveExercise(page, lesson, ui, { wrong: wrongFirst && first });
    first = false;
    await page.locator('[data-testid="feedback"]').waitFor();
    await page.locator('[data-testid="continue"]').click();
  }
  throw new Error('did not finish');
}

/**
 * After an email sign-in the app asks "What should we call you?". Tests that are not about names skip it.
 * Waits for a definite signal (the signed-in avatar is rendered, which happens in the same render as the prompt) instead of a timer.
 */
export async function dismissNamePrompt(page) {
  await page.locator('[data-testid="avatar-link"]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400); // the dialog opens in an effect right after that render
  const skip = page.locator('[data-testid="np-skip"]');
  if (await skip.isVisible()) {
    await skip.click();
    await page.locator('[data-testid="name-prompt"][open]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
}
