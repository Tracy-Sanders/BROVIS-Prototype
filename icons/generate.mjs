/**
 * Generates PNG icons from the BROVIS SVG using pure Node.js.
 * Writes icon-192.png and icon-512.png to this directory.
 * Run once: node icons/generate.mjs
 * Requires Node 18+ (built-in fetch is not needed here).
 *
 * Strategy: encode minimal valid PNGs by drawing the design programmatically
 * using raw pixel manipulation + zlib deflate (both built into Node).
 */
import { createDeflateRaw } from 'zlib';
import { writeFileSync } from 'fs';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const deflateRaw = promisify(createDeflateRaw);
const __dirname = dirname(fileURLToPath(import.meta.url));

const BG     = [10,  12,  15,  255];  // #0a0c0f
const ACCENT = [79,  195, 247, 255];  // #4fc3f7
const TRANS  = [0,   0,   0,   0];

// ── PNG encoder ────────────────────────────────────────────────────────────────

function u32be(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = u32be(d.length);
  const crcBuf = Buffer.concat([t, d]);
  return Buffer.concat([len, t, d, u32be(crc32(crcBuf))]);
}

async function encodePNG(pixels, size) {
  // Filter type 0 (None) for every row
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      const p = pixels[y * size + x];
      raw.push(p[0], p[1], p[2], p[3]);
    }
  }
  const deflated = await new Promise((res, rej) => {
    const buf = Buffer.from(raw);
    let out = [];
    const d = createDeflateRaw({ level: 9 });
    d.on('data', c => out.push(c));
    d.on('end', () => res(Buffer.concat(out)));
    d.on('error', rej);
    d.end(buf);
  });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([
    u32be(size), u32be(size),
    Buffer.from([8, 6, 0, 0, 0]) // bit depth 8, RGBA, compression 0, filter 0, interlace 0
  ]));
  const idat = chunk('IDAT', deflated);
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function setPixel(pixels, size, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  pixels[y * size + x] = color;
}

function blend(pixels, size, x, y, color, alpha) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const bg = pixels[y * size + x];
  const a = alpha / 255;
  pixels[y * size + x] = [
    Math.round(bg[0] * (1 - a) + color[0] * a),
    Math.round(bg[1] * (1 - a) + color[1] * a),
    Math.round(bg[2] * (1 - a) + color[2] * a),
    255
  ];
}

function drawCircle(pixels, size, cx, cy, r, strokeW, color, opacity = 1) {
  const steps = Math.ceil(2 * Math.PI * r * 2);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    for (let w = -strokeW / 2; w <= strokeW / 2; w += 0.5) {
      const px = cx + (r + w) * Math.cos(a);
      const py = cy + (r + w) * Math.sin(a);
      blend(pixels, size, px, py, color, Math.round(255 * opacity));
    }
  }
}

function drawLine(pixels, size, x1, y1, x2, y2, strokeW, color, opacity = 1) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    for (let w = -strokeW / 2; w <= strokeW / 2; w += 0.5) {
      const nx = -dy / len, ny = dx / len;
      blend(pixels, size, x + nx * w, y + ny * w, color, Math.round(255 * opacity));
    }
  }
}

function drawDisk(pixels, size, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= r) setPixel(pixels, size, x, y, color);
      else if (d <= r + 1) blend(pixels, size, x, y, color, Math.round(255 * (1 - (d - r))));
    }
  }
}

function roundRect(pixels, size, rx, color) {
  // Fill background with rounded corners
  const s = size;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // distance to nearest corner arc center
      const cx = x < rx ? rx : x > s - rx ? s - rx : x;
      const cy = y < rx ? rx : y > s - rx ? s - rx : y;
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= rx) setPixel(pixels, size, x, y, color);
    }
  }
}

// ── Render BROVIS icon ─────────────────────────────────────────────────────────

function renderIcon(size) {
  const pixels = new Array(size * size).fill(TRANS);
  const s = size;

  // Scale factors (SVG viewBox is 512x512)
  const sc = s / 512;
  const cx = s / 2, cy = s / 2;

  // Background rounded rect (rx=96/512 * size)
  roundRect(pixels, s, 96 * sc, BG);

  // Outer ring r=196, stroke=8
  drawCircle(pixels, s, cx, cy, 196 * sc, 8 * sc, ACCENT);

  // Crosshair lines
  const sw = 8 * sc;
  drawLine(pixels, s, cx, 60 * sc, cx, 130 * sc, sw, ACCENT);
  drawLine(pixels, s, cx, 382 * sc, cx, 452 * sc, sw, ACCENT);
  drawLine(pixels, s, 60 * sc, cy, 130 * sc, cy, sw, ACCENT);
  drawLine(pixels, s, 382 * sc, cy, 452 * sc, cy, sw, ACCENT);

  // Inner ring r=80, stroke=6, opacity=0.5
  drawCircle(pixels, s, cx, cy, 80 * sc, 6 * sc, ACCENT, 0.5);

  // Center dot r=20
  drawDisk(pixels, s, cx, cy, 20 * sc, ACCENT);

  // Corner ticks opacity=0.6
  const tw = 5 * sc;
  drawLine(pixels, s, 142*sc, 142*sc, 166*sc, 166*sc, tw, ACCENT, 0.6);
  drawLine(pixels, s, 370*sc, 142*sc, 346*sc, 166*sc, tw, ACCENT, 0.6);
  drawLine(pixels, s, 142*sc, 370*sc, 166*sc, 346*sc, tw, ACCENT, 0.6);
  drawLine(pixels, s, 370*sc, 370*sc, 346*sc, 346*sc, tw, ACCENT, 0.6);

  return pixels;
}

// ── Main ───────────────────────────────────────────────────────────────────────

const sizes = [192, 512];
for (const size of sizes) {
  const pixels = renderIcon(size);
  const png = await encodePNG(pixels, size);
  const out = join(__dirname, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
