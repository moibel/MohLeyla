// Builds assets-src/logo-master.png from the supplied artwork (assets-src/logo-v2-source.png).
// The artwork's speech bubbles show French, Chinese and Latin letters; MohLeyla teaches Arabic, Saudi Arabic, English and Indonesian,
// so three bubbles are re-drawn in the same style: Saudi (green, س), Indonesian (red, Id) and Arabic ب (purple, in place of "B").
// Run: node scripts/build-logo-v2.mjs  (then npm run generate:icons)
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'assets-src/logo-v2-source.png');
const out = path.join(root, 'assets-src/logo-master.png');

const AR = "Geeza Pro, 'Arial Unicode MS', Arial, sans-serif";
const LAT = "Helvetica Neue, Arial, sans-serif";
// A glossy bubble like the artwork's: rounded body, tail, light edge, soft inner highlight.
const bubble = ({ id, x, y, w, h, tail, c1, c2, glow, label, font, size, weight = 800, dy = 0 }) => `
  <defs>
    <linearGradient id="g${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <linearGradient id="h${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="f${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <g>
    <rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" rx="${h * 0.42}" fill="${glow}" opacity=".55" filter="url(#f${id})"/>
    <path d="${tail}" fill="${c2}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * 0.42}" fill="url(#g${id})" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>
    <path d="${tail}" fill="url(#g${id})"/>
    <rect x="${x + w * 0.1}" y="${y + h * 0.07}" width="${w * 0.8}" height="${h * 0.38}" rx="${h * 0.19}" fill="url(#h${id})"/>
    <text x="${x + w / 2}" y="${y + h / 2 + dy}" text-anchor="middle" dominant-baseline="central" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="#fff" stroke="rgba(0,0,0,.18)" stroke-width="2" paint-order="stroke">${label}</text>
  </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">
${bubble({ id: 1, x: 136, y: 440, w: 196, h: 166, tail: 'M300 590 L338 628 L262 604 Z', c1: '#2BCB8A', c2: '#0B7A53', glow: '#19B87A', label: 'س', font: AR, size: 120, weight: 700, dy: 6 })}
${bubble({ id: 2, x: 838, y: 236, w: 226, h: 188, tail: 'M880 400 L850 468 L930 418 Z', c1: '#FF6B6E', c2: '#B3202E', glow: '#E8484F', label: 'Id', font: LAT, size: 118, dy: 4 })}
${bubble({ id: 3, x: 932, y: 444, w: 184, h: 156, tail: 'M962 580 L940 628 L1004 596 Z', c1: '#9B6BFF', c2: '#5B2FC9', glow: '#8A5CFF', label: 'ب', font: AR, size: 112, weight: 700, dy: 6 })}
</svg>`;

await sharp(src).composite([{ input: Buffer.from(svg) }]).png({ compressionLevel: 9 }).toFile(out);
console.log('wrote', out);
