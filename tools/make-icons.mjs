/* Generates the app icons as real PNGs — no dependencies, just zlib.
   Renders at 4x and box-downsamples, which gives clean anti-aliasing.
   Run:  node tools/make-icons.mjs                                    */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'icons');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- PNG encoder ---------- */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- tiny shape rasteriser ---------- */
const inRoundRect = (x, y, rx, ry, rw, rh, r) => {
  if (x < rx || y < ry || x > rx + rw || y > ry + rh) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + rw - r);
  const cy = Math.min(Math.max(y, ry + r), ry + rh - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r + 0.0001 || (x >= rx + r && x <= rx + rw - r) || (y >= ry + r && y <= ry + rh - r);
};

/* the dumbbell mark, in 0..1 space, centred */
function markHit(u, v, scale) {
  const s = scale;                      /* overall size of the mark */
  const cx = 0.5, cy = 0.5;
  const x = (u - cx) / s + 0.5, y = (v - cy) / s + 0.5;   /* back to mark space */
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  const bar = inRoundRect(x, y, 0.18, 0.455, 0.64, 0.09, 0.045);
  const outL = inRoundRect(x, y, 0.035, 0.315, 0.115, 0.37, 0.045);
  const outR = inRoundRect(x, y, 0.85, 0.315, 0.115, 0.37, 0.045);
  const inL = inRoundRect(x, y, 0.185, 0.375, 0.085, 0.25, 0.035);
  const inR = inRoundRect(x, y, 0.73, 0.375, 0.085, 0.25, 0.035);
  return bar || outL || outR || inL || inR;
}

const BG_A = [0x2a, 0x66, 0xc4];   /* deep blue  */
const BG_B = [0x4f, 0x97, 0xef];   /* light blue */

function render(size, { rounded, markScale }) {
  const SS = 4, W = size * SS;
  const acc = new Float32Array(size * size * 4);
  const radius = rounded ? W * 0.22 : 0;

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / W;
      const inside = rounded ? inRoundRect(x, y, 0, 0, W - 1, W - 1, radius) : true;
      let r = 0, g = 0, b = 0, a = 0;
      if (inside) {
        const t = (u * 0.35 + v * 0.65);                  /* soft diagonal gradient */
        r = BG_A[0] + (BG_B[0] - BG_A[0]) * (1 - t);
        g = BG_A[1] + (BG_B[1] - BG_A[1]) * (1 - t);
        b = BG_A[2] + (BG_B[2] - BG_A[2]) * (1 - t);
        a = 255;
        if (markHit(u, v, markScale)) { r = 255; g = 255; b = 255; }
      }
      const px = ((y / SS | 0) * size + (x / SS | 0)) * 4;
      acc[px] += r; acc[px + 1] += g; acc[px + 2] += b; acc[px + 3] += a;
    }
  }
  const out = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let i = 0; i < out.length; i++) out[i] = Math.round(acc[i] / n);
  return encodePNG(size, size, out);
}

const jobs = [
  ['icon-192.png', 192, { rounded: true, markScale: 0.66 }],
  ['icon-512.png', 512, { rounded: true, markScale: 0.66 }],
  ['maskable-512.png', 512, { rounded: false, markScale: 0.54 }],
  ['apple-touch-icon.png', 180, { rounded: false, markScale: 0.64 }],
  ['favicon-64.png', 64, { rounded: true, markScale: 0.7 }]
];
for (const [name, size, opts] of jobs) {
  const buf = render(size, opts);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('wrote icons/' + name, size + 'px', (buf.length / 1024).toFixed(1) + 'kB');
}
console.log('done');
