// Generates all brand raster assets from the master logo (assets-src/logo-master.png: the navy-and-gold artwork, transparent corners).
// Run: npm run generate:icons   (the master itself is built from the supplied artwork by scripts/build-logo-v3.mjs)
// Two versions of the mark: the full artwork (home screen, install icons, large uses) and a simplified drawing of the same idea
// (hat, books, bubbles, gold ring) that stays readable at 16-64 px (favicon, top bar, sidebar).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'assets-src/logo-master.png');
const out = path.join(root, 'public/icons');
fs.mkdirSync(out, { recursive: true });

const NAVY = '#171E33'; // the artwork's background; full-bleed icons use it
const NAVY_DEEP = '#0D1222';
const NAVY_MID = '#26324F';
const GOLD = '#C9A24D';
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

const art = await sharp(src).trim().toBuffer();
const artAt = (size) => sharp(art).resize(size, size, { fit: 'contain', background: CLEAR });
const write = (name, pipeline) => pipeline.png({ compressionLevel: 9, palette: false }).toFile(path.join(out, name));

// The simplified mark, drawn as a vector so it is crisp at any small size.
const SIMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NAVY_MID}"/><stop offset="1" stop-color="${NAVY_DEEP}"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D58A"/><stop offset=".5" stop-color="${GOLD}"/><stop offset="1" stop-color="#8E6B25"/></linearGradient>
    <linearGradient id="hat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#46547E"/><stop offset="1" stop-color="#1D2642"/></linearGradient>
    <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF3E2"/><stop offset="1" stop-color="#D9C7A4"/></linearGradient>
  </defs>
  <rect x="2" y="2" width="124" height="124" rx="30" fill="url(#bg)"/>
  <rect x="3.5" y="3.5" width="121" height="121" rx="28.5" fill="none" stroke="url(#gold)" stroke-width="3"/>
  <circle cx="50" cy="66" r="34" fill="#ffffff" fill-opacity=".05" stroke="${GOLD}" stroke-opacity=".35" stroke-width="1.5"/>
  <path d="M16 86 C30 66 84 54 112 70" fill="none" stroke="url(#gold)" stroke-width="3" stroke-linecap="round"/>
  <path d="M46 76 C52 60 58 40 70 22 C76 32 72 42 80 50 C88 60 94 70 98 78 Z" fill="url(#hat)" stroke="url(#gold)" stroke-width="2" stroke-linejoin="round"/>
  <path d="M25 82 C42 70 90 70 106 82 C92 94 40 94 25 82 Z" fill="url(#hat)" stroke="url(#gold)" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M47 72 L90 72 L93 78 L44 78 Z" fill="url(#gold)"/>
  <path d="M68 46 l2.6 5.4 5.4 2.6 -5.4 2.6 -2.6 5.4 -2.6 -5.4 -5.4 -2.6 5.4 -2.6 Z" fill="url(#gold)"/>
  <rect x="33" y="92" width="64" height="11" rx="2.5" fill="#101830" stroke="url(#gold)" stroke-width="1.6"/>
  <rect x="29" y="103" width="72" height="11" rx="2.5" fill="#0C1328" stroke="url(#gold)" stroke-width="1.6"/>
  <path d="M44 103 v14 l5 -4 5 4 v-14 Z" fill="url(#gold)"/>
  <path d="M24 22 h20 a9 9 0 0 1 9 9 v2 a9 9 0 0 1 -9 9 h-6 l-8 7 v-7 h-6 a9 9 0 0 1 -9 -9 v-2 a9 9 0 0 1 9 -9 Z" fill="url(#cream)"/>
  <path d="M80 14 h22 a8 8 0 0 1 8 8 v3 a8 8 0 0 1 -8 8 h-4 l-7 6 v-6 h-11 a8 8 0 0 1 -8 -8 v-3 a8 8 0 0 1 8 -8 Z" fill="url(#cream)"/>
  <path d="M92 52 h20 a8 8 0 0 1 8 8 v2 a8 8 0 0 1 -8 8 h-3 l-7 6 v-6 h-10 a8 8 0 0 1 -8 -8 v-2 a8 8 0 0 1 8 -8 Z" fill="url(#cream)"/>
</svg>`;
const simpleAt = (size) => sharp(Buffer.from(SIMPLE_SVG), { density: Math.max(72, Math.round((size / 128) * 72 * 4)) }).resize(size, size);

// Full-bleed square (no transparent corners, no visible frame): the artwork enlarged a little and cropped to the canvas, so its rounded
// corners fall outside and the navy background runs to the edge. The hat, books and bubbles stay inside the 80% safe zone.
async function fullBleed(size, scale = 1.1) {
  const inner = Math.round(size * scale);
  const flat = await sharp(art).resize(inner, inner, { fit: 'contain', background: CLEAR }).flatten({ background: NAVY }).png().toBuffer();
  const off = Math.floor((inner - size) / 2);
  return sharp(flat).extract({ left: off, top: off, width: size, height: size });
}

// In-app marks: the full artwork for large uses, the simplified drawing for small ones (the Logo component picks by size)
await write('logo-mark-512.png', artAt(512));
await write('logo-mark-192.png', artAt(192));
await artAt(512).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(out, 'logo-mark-512.webp'));
await artAt(160).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(out, 'logo-mark-128.webp'));
await write('logo-mark-128.png', artAt(128));
await simpleAt(128).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(out, 'logo-mark-simple-128.webp'));
await write('logo-mark-on-dark-512.png', artAt(512));
await write('logo-mark-on-dark-128.png', simpleAt(128));

// App / PWA icons
await write('pwa-192.png', artAt(192));
await write('pwa-512.png', artAt(512));
await write('pwa-maskable-512.png', await fullBleed(512, 1.1)); // phones apply their own mask (circle, squircle...)
await write('pwa-maskable-192.png', await fullBleed(192, 1.1));
await write('apple-touch-icon.png', await fullBleed(180, 1.1)); // iOS applies its own rounding
await write('app-icon-1024.png', artAt(1024));
await write('favicon-32.png', simpleAt(32));
await write('favicon-16.png', simpleAt(16));

// favicon.ico (single 32x32 PNG-in-ICO) and the SVG favicon (the simplified drawing, as a real vector)
const png32 = await simpleAt(32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(root, 'public/favicon.ico'), Buffer.concat([header, png32]));
fs.writeFileSync(path.join(out, 'favicon.svg'), SIMPLE_SVG);

// Social preview 1200x630
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY_DEEP}"/><stop offset=".6" stop-color="${NAVY_MID}"/><stop offset="1" stop-color="#1B2A4A"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><rect x="14" y="14" width="1172" height="602" rx="26" fill="none" stroke="${GOLD}" stroke-opacity=".55" stroke-width="2"/></svg>`);
const ogMark = await artAt(440).png().toBuffer();
const ogText = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><text x="590" y="300" font-family="Arial, Helvetica, sans-serif" font-size="108" font-weight="800" fill="#fff">MohLeyla</text><text x="594" y="376" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#E6D3A2">Arabic · English · Indonesian</text><text x="594" y="422" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#E6D3A2">French · Spanish · Chinese</text></svg>`,
);
await sharp(bg).composite([{ input: ogMark, left: 90, top: 95 }, { input: ogText }]).png({ compressionLevel: 9 }).toFile(path.join(out, 'og-image.png'));
console.log('Icons generated in public/icons');
