import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateVaultPng(size, isMaskable = false) {
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  const center = size / 2;
  const maxR = size * (isMaskable ? 0.36 : 0.42);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    rawData[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Deep Obsidian background (#0F172A -> 15, 23, 42)
      let r = 15, g = 23, b = 42, a = 255;

      // Shield ring / emblem in Emerald (#10B981 -> 16, 185, 129)
      if (dist < maxR && dist > maxR * 0.78) {
        r = 16; g = 185; b = 129;
      } else if (dist <= maxR * 0.78) {
        // Inner dark surface (#1E293B -> 30, 41, 59)
        r = 30; g = 41; b = 59;
        // Horizontal receipt lines in crisp white
        const relY = (y - center) / maxR;
        const relX = Math.abs(x - center) / maxR;
        if (relX < 0.42 && (Math.abs(relY + 0.22) < 0.05 || Math.abs(relY) < 0.05 || Math.abs(relY - 0.22) < 0.05)) {
          r = 248; g = 250; b = 252;
        }
      }

      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
      rawData[idx + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(rawData);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', iend),
  ]);
}

fs.mkdirSync('public', { recursive: true });
fs.writeFileSync(path.join('public', 'pwa-192x192.png'), generateVaultPng(192, false));
fs.writeFileSync(path.join('public', 'pwa-512x512.png'), generateVaultPng(512, false));
fs.writeFileSync(path.join('public', 'pwa-maskable-512x512.png'), generateVaultPng(512, true));
fs.writeFileSync(path.join('public', 'apple-touch-icon.png'), generateVaultPng(180, false));
console.log('Generated PWA PNG icons successfully.');
