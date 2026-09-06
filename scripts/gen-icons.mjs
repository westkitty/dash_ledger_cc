/**
 * Generate Dash Ledger PWA icons as real PNG files with no external deps.
 *
 * Design: deep teal field, a rounded "ledger card" with three ruled lines and a
 * small odometer/coin mark. Flat, legible at small sizes, original.
 *
 * Run: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const TEAL = [15, 118, 110];
const TEAL_DK = [11, 92, 85];
const CARD = [246, 245, 241];
const RULE = [195, 191, 178];
const ACCENT = [45, 212, 191];
const INK = [28, 27, 25];

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function draw(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = maskable ? size * 0.16 : size * 0.12;
  const cardX0 = pad;
  const cardY0 = pad + size * 0.03;
  const cardX1 = size - pad;
  const cardY1 = size - pad - size * 0.03;
  const radius = size * 0.09;

  const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const rx = Math.min(r, (x1 - x0) / 2);
    const dx = x < x0 + rx ? x0 + rx - x : x > x1 - rx ? x - (x1 - rx) : 0;
    const dy = y < y0 + rx ? y0 + rx - y : y > y1 - rx ? y - (y1 - rx) : 0;
    return dx * dx + dy * dy <= rx * rx;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // vertical teal gradient background
      let col = lerp(TEAL, TEAL_DK, y / size);
      let a = 255;

      if (inRoundRect(x, y, cardX0, cardY0, cardX1, cardY1, radius)) {
        col = CARD;
        // three ruled lines
        const lineYs = [0.4, 0.56, 0.72].map((f) => cardY0 + (cardY1 - cardY0) * f);
        for (const ly of lineYs) {
          if (Math.abs(y - ly) < Math.max(1, size * 0.012) && x > cardX0 + size * 0.09 && x < cardX1 - size * 0.09) {
            col = RULE;
          }
        }
        // accent header bar
        if (y < cardY0 + (cardY1 - cardY0) * 0.22 && x > cardX0 + size * 0.09 && x < cardX0 + size * 0.42) {
          col = ACCENT;
        }
        // odometer / coin mark, bottom-right
        const cx = cardX1 - size * 0.16;
        const cy = cardY1 - size * 0.16;
        const rr = size * 0.075;
        const d = Math.hypot(x - cx, y - cy);
        if (d < rr) col = TEAL;
        if (d < rr && d > rr - Math.max(1, size * 0.02)) col = INK;
      }

      buf[i] = col[0];
      buf[i + 1] = col[1];
      buf[i + 2] = col[2];
      buf[i + 3] = a;
    }
  }
  return png(size, size, buf);
}

writeFileSync(join(OUT, 'icon-192.png'), draw(192, { maskable: false }));
writeFileSync(join(OUT, 'icon-512.png'), draw(512, { maskable: false }));
writeFileSync(join(OUT, 'maskable-512.png'), draw(512, { maskable: true }));

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0f766e"/>
  <rect x="12" y="12" width="40" height="40" rx="6" fill="#f6f5f1"/>
  <rect x="18" y="18" width="18" height="6" rx="2" fill="#2dd4bf"/>
  <rect x="18" y="30" width="28" height="3" rx="1.5" fill="#c3bfb2"/>
  <rect x="18" y="38" width="28" height="3" rx="1.5" fill="#c3bfb2"/>
  <circle cx="42" cy="42" r="6" fill="none" stroke="#1c1b19" stroke-width="2.5"/>
</svg>
`;
writeFileSync(join(OUT, 'favicon.svg'), favicon);

console.log('Icons written to', OUT);
