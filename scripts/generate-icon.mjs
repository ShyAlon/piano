import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const width = 192;
const height = 192;
const bytes = Buffer.alloc((width * 4 + 1) * height);

for (let y = 0; y < height; y += 1) {
  const row = y * (width * 4 + 1);
  bytes[row] = 0;
  for (let x = 0; x < width; x += 1) {
    const i = row + 1 + x * 4;
    const dx = x - width / 2;
    const dy = y - height / 2;
    const inside = Math.hypot(dx, dy) < 82;
    const keyArea = inside && x >= 42 && x < 150 && y >= 43 && y < 148;
    const key = Math.floor((x - 42) / 18);
    const divider = keyArea && (x - 42) % 18 < 2;
    const black = keyArea && y < 104 && [0, 1, 3, 4].includes(key);
    const accent = inside && Math.hypot(x - 139, y - 133) < 12;
    const color = accent ? [255, 115, 85] : keyArea && !divider && !black ? [246, 243, 235] : inside ? [20, 23, 33] : [9, 11, 17];
    bytes[i] = color[0];
    bytes[i + 1] = color[1];
    bytes[i + 2] = color[2];
    bytes[i + 3] = 255;
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type, data) {
  const name = Buffer.from(type);
  const payload = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of payload) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return output;
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header.set([8, 6, 0, 0, 0], 8);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(bytes)),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(new URL('../public/icon-192.png', import.meta.url), png);
