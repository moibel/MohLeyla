// Generates all brand raster assets from the master logo (assets-src/logo-master.png).
// Run: npm run generate:icons
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'assets-src/logo-master.png');
const out = path.join(root, 'public/icons');
fs.mkdirSync(out, { recursive: true });

const BRAND_DEEP = '#0B2A6F';
const BRAND_BLUE = '#1256C8';
const BRAND_TEAL = '#0FB5A6';

// Trim transparent margin once, keep a tight square mark.
const trimmed = await sharp(src).trim().toBuffer();
const { width, height } = await sharp(trimmed).metadata();
const side = Math.max(width, height);
const square = await sharp(trimmed)
  .extend({
    top: Math.floor((side - height) / 2),
    bottom: Math.ceil((side - height) / 2),
    left: Math.floor((side - width) / 2),
    right: Math.ceil((side - width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .toBuffer();

const mark = (size, padPct = 0) => {
  const inner = Math.round(size * (1 - padPct * 2));
  const pad = Math.floor((size - inner) / 2);
  return sharp(square)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad, background: { r: 0, g: 0, b: 0, alpha: 0 } });
};

const gradientTile = (size, radius) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRAND_DEEP}"/><stop offset=".55" stop-color="${BRAND_BLUE}"/><stop offset="1" stop-color="${BRAND_TEAL}"/></linearGradient></defs><rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/></svg>`,
  );
const lightTile = (size, radius) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#FFFFFF"/></svg>`,
  );

// Mark on a solid tile (used for app icons, where transparency is not allowed or contrast matters).
async function tiled(size, { tile = 'light', pad = 0.14, radiusPct = 0.22 } = {}) {
  const base = tile === 'brand' ? gradientTile(size, Math.round(size * radiusPct)) : lightTile(size, Math.round(size * radiusPct));
  const markBuf = await mark(size, pad).png().toBuffer();
  return sharp(base).composite([{ input: markBuf }]);
}

const write = (name, pipeline, opts = {}) => pipeline.png({ compressionLevel: 9, palette: false, ...opts }).toFile(path.join(out, name));

// Transparent marks (light backgrounds)
await write('logo-mark-512.png', mark(512));
await write('logo-mark-192.png', mark(192));
await mark(512).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(out, 'logo-mark-512.webp'));
await mark(128).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(out, 'logo-mark-128.webp'));
await write('logo-mark-128.png', mark(128));
// Mark on a white tile (dark backgrounds)
await write('logo-mark-on-dark-512.png', await tiled(512, { tile: 'light', pad: 0.1, radiusPct: 0.5 }));
await write('logo-mark-on-dark-128.png', await tiled(128, { tile: 'light', pad: 0.1, radiusPct: 0.5 }));

// App / PWA icons
await write('pwa-192.png', await tiled(192, { tile: 'light', pad: 0.12 }));
await write('pwa-512.png', await tiled(512, { tile: 'light', pad: 0.12 }));
// Maskable: full-bleed background, mark inside the 80% safe zone
await write('pwa-maskable-512.png', await tiled(512, { tile: 'light', pad: 0.2, radiusPct: 0 }));
await write('pwa-maskable-192.png', await tiled(192, { tile: 'light', pad: 0.2, radiusPct: 0 }));
await write('apple-touch-icon.png', await tiled(180, { tile: 'light', pad: 0.14, radiusPct: 0 }));
await write('app-icon-1024.png', await tiled(1024, { tile: 'light', pad: 0.12 }));
await write('favicon-32.png', mark(32, 0.02));
await write('favicon-16.png', mark(16, 0.02));

// favicon.ico (single 32x32 PNG-in-ICO)
const png32 = await mark(32, 0.02).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6);
header.writeUInt8(32, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png32.length, 14);
header.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(root, 'public/favicon.ico'), Buffer.concat([header, png32]));

// Social preview 1200x630
const og = await sharp(gradientTile(1200, 0)).extract({ left: 0, top: 0, width: 1200, height: 630 }).toBuffer();
const ogMark = await (await tiled(420, { tile: 'light', pad: 0.1, radiusPct: 0.22 })).png().toBuffer(); // white tile so the blue bubble stands out on the blue card
const ogText = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><text x="560" y="300" font-family="Arial, Helvetica, sans-serif" font-size="108" font-weight="800" fill="#fff">MohLeyla</text><text x="564" y="370" font-family="Arial, Helvetica, sans-serif" font-size="32" fill="#CFE8FF">Arabic · Saudi · English · Indonesian</text></svg>`,
);
await sharp(og)
  .composite([{ input: ogMark, left: 90, top: 105 }, { input: ogText }])
  .png({ compressionLevel: 9 })
  .toFile(path.join(out, 'og-image.png'));

// Vector tile reused for the SVG favicon fallback
fs.writeFileSync(
  path.join(root, 'public/icons/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRAND_DEEP}"/><stop offset=".55" stop-color="${BRAND_BLUE}"/><stop offset="1" stop-color="${BRAND_TEAL}"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><rect x="6" y="6" width="52" height="44" rx="15" fill="#fff"/><path d="M18 36V19l14 12 14-12v17" fill="none" stroke="url(#g)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 49l-3 9 14-8z" fill="#fff"/><path d="M49 4l1.6 4.4L55 10l-4.400 1.600L49 16l-1.600-4.400L43 10l4.400-1.600z" fill="#FFC83D"/></svg>`,
);
console.log('Icons generated in public/icons');
