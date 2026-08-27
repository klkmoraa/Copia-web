import fs from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const paeth = (left, above, upperLeft) => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
};

const decodeAlphaPixels = (buffer, { width, height, bitDepth, colorType, interlace }) => {
  if (colorType !== 4 && colorType !== 6) return false;
  if (bitDepth !== 8 || interlace !== 0) throw new Error('Structural PNG must use non-interlaced 8-bit alpha pixels');
  const bytesPerPixel = colorType === 6 ? 4 : 2;
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error(`Truncated PNG ${type} chunk`);
    if (type === 'IDAT') chunks.push(buffer.subarray(dataStart, dataEnd));
    offset = dataEnd + 4;
    if (type === 'IEND') break;
  }
  if (!chunks.length) throw new Error('PNG is missing IDAT pixel data');

  const inflated = inflateSync(Buffer.concat(chunks));
  const stride = width * bytesPerPixel;
  if (inflated.length !== height * (stride + 1)) throw new Error('PNG pixel payload does not match its dimensions');
  let previous = Buffer.alloc(stride);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    const current = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[cursor + x];
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const above = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? above
            : filter === 3 ? Math.floor((left + above) / 2)
              : filter === 4 ? paeth(left, above, upperLeft)
                : null;
      if (predictor === null) throw new Error(`Unsupported PNG filter ${filter}`);
      current[x] = (raw + predictor) & 0xff;
    }
    const alphaOffset = bytesPerPixel - 1;
    for (let x = alphaOffset; x < stride; x += bytesPerPixel) if (current[x] < 255) return true;
    cursor += stride;
    previous = current;
  }
  return false;
};

export const inspectStructuralPng = (buffer) => {
  if (buffer.length < 26 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature');
  }
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') throw new Error('PNG is missing its IHDR header');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const interlace = buffer[28];
  const hasAlpha = colorType === 4 || colorType === 6;
  return {
    width,
    height,
    hasAlpha,
    hasTransparentPixels: hasAlpha && decodeAlphaPixels(buffer, { width, height, bitDepth, colorType, interlace }),
  };
};

export const collectStructuralPngs = (root) => {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name.endsWith('.png')) files.push(target);
    }
  };
  visit(root);
  return files.sort();
};

export const validateStructuralPngBundle = (assetRoot) => {
  const files = collectStructuralPngs(assetRoot);
  const failures = [];
  if (files.length !== 80) failures.push(`expected 80 PNG files, found ${files.length}`);

  for (const theme of ['day', 'night']) {
    const themeFiles = files.filter((file) => path.relative(assetRoot, file).split(path.sep)[0] === theme);
    if (themeFiles.length !== 40) failures.push(`${theme}: expected 40 files, found ${themeFiles.length}`);
    const families = new Map();
    for (const file of themeFiles) {
      const [, family] = path.relative(assetRoot, file).split(path.sep);
      families.set(family, (families.get(family) ?? 0) + 1);
    }
    if (families.size !== 10) failures.push(`${theme}: expected 10 families, found ${families.size}`);
    for (const [family, count] of families) if (count !== 4) failures.push(`${theme}/${family}: expected 4 files, found ${count}`);
  }

  for (const file of files) {
    const metadata = inspectStructuralPng(fs.readFileSync(file));
    const relative = path.relative(assetRoot, file);
    if (metadata.width !== 900 || metadata.height !== 600) failures.push(`${relative}: ${metadata.width}x${metadata.height}`);
    if (!metadata.hasAlpha) failures.push(`${relative}: missing alpha channel`);
    else if (!metadata.hasTransparentPixels) failures.push(`${relative}: alpha channel has no transparent pixels`);
  }
  if (failures.length) throw new Error(`Three.js structural render contract failed:\n${failures.join('\n')}`);
  return { files: files.length, day: 40, night: 40, width: 900, height: 600 };
};
