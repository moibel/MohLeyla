// Draws the iOS and Android app icons and splash screens from assets-src/logo-master.png.
// The PNGs it writes are committed; run it again only when the logo changes.
// Usage: npm run generate:native-assets
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IOS = path.join(ROOT, 'ios/App/App/Assets.xcassets');
const RES = path.join(ROOT, 'android/app/src/main/res');
const BRAND = '#171E33'; // splash background; same colour as capacitor.config.json

const { data, info } = await sharp(path.join(ROOT, 'assets-src/logo-master.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const N = info.width;
if (info.height !== N) throw new Error('logo-master.png must be square');
const raw = (buf, size, channels = 4) => sharp(buf, { raw: { width: size, height: size, channels } });
const out = async (image, file) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await image.png({ compressionLevel: 9 }).toFile(file);
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const roundedRect = (size, inset, radius, fill = '#fff') => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect x="${inset}" y="${inset}" width="${size - 2 * inset}" height="${size - 2 * inset}" rx="${radius}" fill="${fill}"/></svg>`,
);

// ---- Full-bleed artwork: the logo without its gold frame, its own backdrop continued to any size. ----
// For every row, take the backdrop colour just inside the left and right edges of the framed tile.
function edgeColours(fromRight) {
  const rows = [];
  for (let y = 0; y < N; y++) {
    const sy = clamp(y, 60, N - 61);
    let x = fromRight ? N - 1 : 0;
    while (data[(sy * N + x) * 4 + 3] < 250) x += fromRight ? -1 : 1;
    x += fromRight ? -58 : 58;
    const i = (sy * N + x) * 4;
    rows.push([data[i], data[i + 1], data[i + 2]]);
  }
  return rows.map((_, y) => [0, 1, 2].map((c) => {
    let sum = 0;
    for (let k = -50; k <= 50; k++) sum += rows[clamp(y + k, 0, N - 1)][c];
    return sum / 101;
  }));
}
const left = edgeColours(false);
const right = edgeColours(true);

// Soft-edged mask that keeps everything inside the gold frame.
const mask = await sharp(roundedRect(N, 62, 230)).ensureAlpha().extractChannel('alpha').blur(24).raw().toBuffer();

/** Square RGB image of `size` pixels with the tile drawn `scale` times as wide as the canvas, centred. */
async function fullBleed(size, scale = 1) {
  const span = N / scale; // canvas width measured in logo pixels
  const side = Math.round(span);
  const offset = Math.round((side - N) / 2);
  const rgb = Buffer.alloc(side * side * 3);
  for (let y = 0; y < side; y++) {
    const ly = y - offset;
    for (let x = 0; x < side; x++) {
      const lx = x - offset;
      const t = clamp(lx / (N - 1), 0, 1);
      const row = clamp(ly, 0, N - 1);
      const inside = lx >= 0 && ly >= 0 && lx < N && ly < N;
      const a = inside ? mask[ly * N + lx] / 255 : 0;
      for (let c = 0; c < 3; c++) {
        const bg = left[row][c] * (1 - t) + right[row][c] * t;
        const fg = inside ? data[(ly * N + lx) * 4 + c] : 0;
        rgb[(y * side + x) * 3 + c] = Math.round(bg * (1 - a) + fg * a);
      }
    }
  }
  return sharp(await raw(rgb, side, 3).resize(size, size).raw().toBuffer(), { raw: { width: size, height: size, channels: 3 } });
}

/** The framed logo tile (transparent corners), drawn `tile` pixels wide in the middle of a square canvas. */
async function framed(canvas, tile, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const art = await raw(data, N).resize(tile, tile).png().toBuffer();
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background } }).composite([{ input: art, gravity: 'centre' }]);
}

// ---- iOS ----
// App Store icon: square, opaque (iOS rounds the corners itself).
await out((await fullBleed(1024)).removeAlpha(), path.join(IOS, 'AppIcon.appiconset/AppIcon-512@2x.png'));
// Launch screen: scaled to fill, so the logo stays well inside the narrow middle strip that a tall phone shows.
const splash = await (await framed(2732, 640, BRAND)).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  fs.writeFileSync(path.join(IOS, 'Splash.imageset', name), splash);
}

// ---- Android ----
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, f] of Object.entries(DENSITIES)) {
  const mip = path.join(RES, `mipmap-${density}`);
  const legacy = Math.round(48 * f);
  // Android 7: the framed tile as it is, and a circle.
  await out(await framed(legacy, Math.round(legacy * 0.94)), path.join(mip, 'ic_launcher.png'));
  const circle = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy * 0.47}" fill="#fff"/></svg>`);
  const roundArt = await (await fullBleed(legacy, 0.8)).ensureAlpha().png().toBuffer();
  await out(sharp(roundArt).composite([{ input: circle, blend: 'dest-in' }]), path.join(mip, 'ic_launcher_round.png'));
  // Android 8+: 108dp layer. At 0.65 the hat, books and bubbles sit inside the safe circle that every launcher mask keeps.
  await out(await fullBleed(Math.round(108 * f), 0.65), path.join(mip, 'ic_launcher_foreground.png'));

  const drawable = path.join(RES, `drawable-${density}`);
  // Android 12+ splash icon: 288dp canvas, only the middle 192dp circle is guaranteed to show.
  await out(await framed(Math.round(288 * f), Math.round(150 * f)), path.join(drawable, 'splash_icon.png'));
  // Android 7-11 splash: centred over the brand colour by drawable/splash.xml, so it is never stretched.
  await out(await framed(Math.round(180 * f), Math.round(180 * f)), path.join(drawable, 'splash_logo.png'));
}

// Icon for the Google Play listing (uploaded by hand in Play Console; not part of the app).
await out((await fullBleed(512)).ensureAlpha(), path.join(ROOT, 'android/store-assets/play-icon-512.png'));

console.log('Native icons and splash screens written to ios/ and android/.');
