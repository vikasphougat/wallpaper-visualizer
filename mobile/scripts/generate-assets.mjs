/**
 * Generates Expo icon / splash PNGs (no external deps).
 * Run: node scripts/generate-assets.mjs
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "assets");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function png(size, draw) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1) + 1;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const i = row + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function iconPixel(x, y, size) {
  const bg = [15, 17, 21, 255];
  const accent = [61, 125, 251, 255];
  const soft = [110, 168, 254, 255];
  const cx = size / 2;
  const cy = size / 2;
  const r = Math.hypot(x - cx, y - cy);
  const outer = size * 0.46;
  const inner = size * 0.28;
  if (r > outer) return bg;
  if (r < inner) return accent;
  const stripe = Math.floor((x + y) / (size * 0.06)) % 2 === 0;
  return stripe ? soft : accent;
}

function splashPixel(x, y, size) {
  const t = y / size;
  const r = Math.round(15 + t * 8);
  const g = Math.round(17 + t * 10);
  const b = Math.round(21 + t * 14);
  const cx = size / 2;
  const cy = size * 0.42;
  const r0 = Math.hypot(x - cx, y - cy);
  if (r0 < size * 0.12) return [61, 125, 251, 255];
  if (r0 < size * 0.18) return [110, 168, 254, 220];
  return [r, g, b, 255];
}

fs.mkdirSync(OUT, { recursive: true });
const files = [
  ["icon.png", 1024, iconPixel],
  ["adaptive-icon.png", 1024, iconPixel],
  ["splash-icon.png", 512, splashPixel],
];
for (const [name, size, fn] of files) {
  fs.writeFileSync(path.join(OUT, name), png(size, fn));
  console.log("wrote", name, size + "x" + size);
}
