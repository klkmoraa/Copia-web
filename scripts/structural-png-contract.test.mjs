import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { inspectStructuralPng } from './structural-png-contract.mjs';

const chunk = (type, data) => {
  const buffer = Buffer.alloc(12 + data.length);
  buffer.writeUInt32BE(data.length, 0);
  buffer.write(type, 4, 'ascii');
  data.copy(buffer, 8);
  return buffer;
};

const rgbaPng = (alpha) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  const scanline = Buffer.from([0, 22, 44, 66, alpha]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanline)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

test('reads dimensions and proves transparent pixels in an RGBA PNG', () => {
  assert.deepEqual(inspectStructuralPng(rgbaPng(0)), {
    width: 1,
    height: 1,
    hasAlpha: true,
    hasTransparentPixels: true,
  });
});

test('rejects opaque RGBA pixels as real transparency', () => {
  assert.deepEqual(inspectStructuralPng(rgbaPng(255)), {
    width: 1,
    height: 1,
    hasAlpha: true,
    hasTransparentPixels: false,
  });
});

test('rejects a raster without a PNG signature', () => {
  assert.throws(() => inspectStructuralPng(Buffer.alloc(33)), /PNG signature/);
});
