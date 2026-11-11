// Малює іконку застосунку (блок із травою) і зберігає PNG потрібних розмірів у public/icons.
// Запуск: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const GRID = 16;
const EDGE = [43, 33, 24];
const GRASS = [92, 181, 49];
const GRASS_DARK = [61, 138, 31];
const DIRT = [138, 90, 47];
const DIRT_DARK = [95, 59, 28];

function pixel(x, y) {
  if (x === 0 || y === 0 || x === GRID - 1 || y === GRID - 1) return EDGE;
  if (y <= 4) return (x * 3 + y) % 5 === 0 ? GRASS_DARK : GRASS;
  if (y === 5) return x % 3 === 0 ? GRASS : GRASS_DARK;
  if (y === 6 && x % 4 === 1) return GRASS_DARK;
  return (x * 7 + y * 5) % 6 === 0 ? DIRT_DARK : DIRT;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // без фільтра
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(Math.floor((x * GRID) / size), Math.floor((y * GRID) / size));
      raw.set([r, g, b], row + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 біт, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(`public/icons/${name}`, png(size));
  console.log(`public/icons/${name} ${size}x${size}`);
}
