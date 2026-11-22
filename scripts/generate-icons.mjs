// Generates all brand raster assets from the master logo (assets-src/logo-master.png: a rounded-square artwork with transparent corners).
// Run: npm run generate:icons   (the master itself is built from the supplied artwork by scripts/build-logo-v2.mjs)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'assets-src/logo-master.png');
const out = path.join(root, 'public/icons');
fs.mkdirSync(out, { recursive: true });

const INDIGO = '#1B1A62'; // matches the artwork's edge colour; used for full-bleed icons and the social card
const INDIGO_DEEP = '#100F45';
const VIOLET = '#4B2FB8';
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

const art = await sharp(src).trim().toBuffer(); // the rounded tile, corners transparent
const artAt = (size) => sharp(art).resize(size, size, { fit: 'contain', background: CLEAR });
const write = (name, pipeline) => pipeline.png({ compressionLevel: 9, palette: false }).toFile(path.join(out, name));

// Full-bleed square (no transparent corners): the artwork on its own background colour, scaled by `scale` (maskable icons keep a safe zone).
async function fullBleed(size, scale = 1) {
  const inner = Math.round(size * scale);
  const pad = Math.floor((size - inner) / 2);
  const mark = await artAt(inner).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: INDIGO } }).composite([{ input: mark, left: pad, top: pad }]);
}

// In-app marks (transparent corners)
await write('logo-mark-512.png', artAt(512));
await write('logo-mark-192.png', artAt(192));
await artAt(512).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(out, 'logo-mark-512.webp'));
await artAt(128).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(out, 'logo-mark-128.webp'));
await write('logo-mark-128.png', artAt(128));
await write('logo-mark-on-dark-512.png', artAt(512)); // the artwork is already dark; same image
await write('logo-mark-on-dark-128.png', artAt(128));

// App / PWA icons
await write('pwa-192.png', artAt(192));
await write('pwa-512.png', artAt(512));
await write('pwa-maskable-512.png', await fullBleed(512, 0.8)); // inside the 80% safe zone
await write('pwa-maskable-192.png', await fullBleed(192, 0.8));
await write('apple-touch-icon.png', await fullBleed(180, 0.96)); // iOS applies its own rounding
await write('app-icon-1024.png', artAt(1024));
await write('favicon-32.png', artAt(32));
await write('favicon-16.png', artAt(16));

// favicon.ico (single 32x32 PNG-in-ICO)
const png32 = await artAt(32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(root, 'public/favicon.ico'), Buffer.concat([header, png32]));

// SVG favicon: the artwork embedded at 64px
const png64 = await artAt(64).png({ compressionLevel: 9 }).toBuffer();
fs.writeFileSync(path.join(out, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64"><image width="64" height="64" xlink:href="data:image/png;base64,${png64.toString('base64')}"/></svg>`);

// Social preview 1200x630
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${INDIGO_DEEP}"/><stop offset=".6" stop-color="${VIOLET}"/><stop offset="1" stop-color="#1256C8"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`);
const ogMark = await artAt(440).png().toBuffer();
const ogText = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><text x="590" y="300" font-family="Arial, Helvetica, sans-serif" font-size="108" font-weight="800" fill="#fff">MohLeyla</text><text x="594" y="370" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#DCD6FF">Arabic · Saudi · English · Indonesian</text></svg>`,
);
await sharp(bg).composite([{ input: ogMark, left: 90, top: 95 }, { input: ogText }]).png({ compressionLevel: 9 }).toFile(path.join(out, 'og-image.png'));
console.log('Icons generated in public/icons');
