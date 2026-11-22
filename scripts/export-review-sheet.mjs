// Exports the beta tracks (Egyptian Arabic, French, Spanish, Chinese) as plain-text review sheets for native speakers:
//   node scripts/export-review-sheet.mjs        -> docs/native-review/<track>.md
// One table per lesson: the target text, how it is said, the three explanation-language meanings, the example, then the
// cloze exercises and the conversation, with a checkbox column for the reviewer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAMES = { eg: 'Egyptian Arabic', fr: 'French', es: 'Spanish', zh: 'Chinese (Mandarin)' };
const out = path.join(root, 'docs/native-review');
fs.mkdirSync(out, { recursive: true });
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

for (const track of Object.keys(NAMES)) {
  const dir = path.join(root, 'src/data/content', track);
  const lessons = fs.readdirSync(dir).filter((f) => /^part\d+\.json$/.test(f)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).sort((a, b) => a.order - b.order);
  let md = `# ${NAMES[track]}: review sheet for a native speaker\n\n`;
  md += 'These lessons are a **beta**: written carefully and checked by scripts and a second linguistic pass, but not yet by a native speaker.\n\n';
  md += '**How to review.** For each row: is the target natural and correct? does the pronunciation guide match? do the Arabic, English and Indonesian meanings match? Tick the box when it is right; write the correction in the last column when it is not. Send the sheet back and the lessons are fixed and the Beta label can be removed.\n\n';
  for (const l of lessons) {
    md += `## Lesson ${l.order}: ${l.title.en}\n\n`;
    md += `*${l.description.en}*\n\n`;
    md += '| OK | Id | Target | Pronunciation | Arabic | English | Indonesian | Example | Example meaning (EN) | Correction |\n|---|---|---|---|---|---|---|---|---|---|\n';
    for (const it of l.items) md += `| ☐ | ${it.id} | ${cell(it.target)} | ${cell(it.translit)} | ${cell(it.tr.ar)} | ${cell(it.tr.en)} | ${cell(it.tr.id)} | ${cell(it.example.target)} | ${cell(it.example.tr.en)} |  |\n`;
    md += '\n**Fill-in-the-blank**\n\n| OK | Sentence | Answer | Wrong options | Meaning (EN) | Correction |\n|---|---|---|---|---|---|\n';
    l.cloze.forEach((c, i) => { md += `| ☐ | ${cell(c.sentence)} | ${cell(c.answer)} | ${cell(c.wrong.join(' / '))} | ${cell(c.tr.en)} |  |\n`; void i; });
    md += `\n**Conversation:** ${l.conversation.context.en}\n\n| OK | Who | Line | Meaning (EN) | Correction |\n|---|---|---|---|---|\n`;
    l.conversation.turns.forEach((t, i) => { md += `| ☐ | ${t.who}${i === l.conversation.gap ? ' (learner picks this reply)' : ''} | ${cell(t.target)} | ${cell(t.tr.en)} |  |\n`; });
    md += `\nWrong replies offered: ${l.conversation.wrong.map(cell).join(' / ')}\n\n`;
    md += `**Explanations to check (English):** ${cell(l.intro.en)} ${l.grammar ? '**' + cell(l.grammar.title.en) + ':** ' + cell(l.grammar.body.en) : ''} **Culture:** ${cell(l.culture.en)}\n\n`;
  }
  fs.writeFileSync(path.join(out, `${track}.md`), md);
  console.log(`${track}: ${lessons.length} lessons -> docs/native-review/${track}.md`);
}
