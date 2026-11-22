// Builds assets-src/logo-master.png from the supplied artwork (assets-src/logo-v3-source.png: navy and gold wizard hat, books, speech bubbles).
// Retouching, so the logo suits the app:
//   * the white corners become transparent (rounded-square tile),
//   * the English words "Learn Languages" on the book are removed (text does not belong in an icon, and the app is not English-only),
//   * the second Arabic bubble (أ) becomes a French É, so the bubbles show a wider range of the app's languages (A, 文, ض, É).
// Run: node scripts/build-logo-v3.mjs   (then npm run generate:icons)
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'assets-src/logo-v3-source.png');
const out = path.join(root, 'assets-src/logo-master.png');

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width; const H = info.height;
const buf = Buffer.from(data);
const at = (x, y) => (y * W + x) * 4;

// 1) transparent corners: flood-fill the near-white background connected to the image edge
const bright = (i) => buf[i] > 236 && buf[i + 1] > 236 && buf[i + 2] > 236;
const seen = new Uint8Array(W * H); const stack = [];
for (let x = 0; x < W; x++) { stack.push([x, 0], [x, H - 1]); }
for (let y = 0; y < H; y++) { stack.push([0, y], [W - 1, y]); }
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue;
  if (!bright(at(x, y))) continue;
  seen[y * W + x] = 1;
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (seen[y * W + x]) buf[at(x, y) + 3] = 0;
// soften the edge: pixels touching the cleared area become partly transparent in proportion to how bright they are
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
  if (seen[y * W + x]) continue;
  if (seen[y * W + x + 1] || seen[y * W + x - 1] || seen[(y + 1) * W + x] || seen[(y - 1) * W + x]) {
    const i = at(x, y); const l = (buf[i] + buf[i + 1] + buf[i + 2]) / 3;
    buf[i + 3] = Math.round(255 * Math.min(1, Math.max(0.25, 1 - (l - 150) / 140)));
  }
}

// 2) remove the words on the book: rebuild each column from the dark leather just above and below the text
const lerp = (a, b, t) => a + (b - a) * t;
const TX0 = 462; const TX1 = 790; const TY0 = 878; const TY1 = 948;
for (let x = TX0; x <= TX1; x++) {
  const a = at(x, TY0 - 4); const b = at(x, TY1 + 4);
  for (let y = TY0; y <= TY1; y++) {
    const t = (y - TY0) / (TY1 - TY0); const i = at(x, y);
    for (let k = 0; k < 3; k++) buf[i + k] = Math.round(lerp(buf[a + k], buf[b + k], t));
  }
}

// 3) the أ bubble: rebuild the glyph area from the bubble's cream on its left and right, then draw a French É
const GX0 = 948; const GX1 = 1040; const GY0 = 436; const GY1 = 548;
for (let y = GY0; y <= GY1; y++) {
  const a = at(GX0 - 6, y); const b = at(GX1 + 6, y);
  for (let x = GX0; x <= GX1; x++) {
    const t = (x - GX0) / (GX1 - GX0); const i = at(x, y);
    for (let k = 0; k < 3; k++) buf[i + k] = Math.round(lerp(buf[a + k], buf[b + k], t));
  }
}
const letter = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><text x="994" y="520" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="104" font-weight="700" fill="#43322A">É</text></svg>`);
const patched = await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).composite([{ input: letter }]).png().toBuffer();
await sharp(patched).png({ compressionLevel: 9 }).toFile(out);
console.log('wrote', out);
