// Builds src/data/manifest.json (lightweight index: lesson meta + item->lesson map) from the content JSON files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src/data/content');
const lessons = [];
for (const track of fs.readdirSync(dir)) {
  const td = path.join(dir, track);
  if (!fs.statSync(td).isDirectory()) continue;
  for (const f of fs.readdirSync(td).filter((x) => x.endsWith('.json')).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(td, f), 'utf8'));
    for (const l of data) lessons.push(l);
  }
}
lessons.sort((a, b) => a.track.localeCompare(b.track) || a.order - b.order);
const manifest = {
  lessons: lessons.map((l) => ({
    id: l.id, track: l.track, order: l.order, level: l.level, icon: l.icon, title: l.title,
    items: l.items.map((i) => i.id),
  })),
};
fs.writeFileSync(path.join(root, 'src/data/manifest.json'), JSON.stringify(manifest));
console.log(`manifest: ${manifest.lessons.length} lessons`);
