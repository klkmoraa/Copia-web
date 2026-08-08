import { describe, expect, it } from 'vitest';
import { rasterScaleFor } from './export';

describe('rasterScaleFor', () => {
  it('exports above screen resolution by default', () => {
    expect(rasterScaleFor(1000, 640, undefined)).toBeGreaterThanOrEqual(2);
  });

  it('honours an explicit presentation scale', () => {
    expect(rasterScaleFor(1000, 640, 3)).toBe(3);
    expect(rasterScaleFor(1000, 640, 1)).toBe(1);
  });

  it('caps a large drawing to what the browser canvas can hold', () => {
    // 4000 x 3000 at 4x would be 192 megapixels; browsers refuse to read that back.
    const scale = rasterScaleFor(4000, 3000, 4);
    expect(scale).toBeLessThan(4);
    expect(4000 * scale * 3000 * scale).toBeLessThanOrEqual(64_000_001);
  });

  it('never renders smaller than the drawing itself', () => {
    // A drawing whose natural size already exceeds the limit is not silently shrunk:
    // downscaling an engineering drawing loses information. It stays at 1x and, if the
    // browser then refuses, exportSvgAsPng rejects with an explicit message.
    expect(rasterScaleFor(20_000, 20_000, 4)).toBe(1);
    expect(rasterScaleFor(40_000, 40_000, 4)).toBe(1);
  });

  it('ignores a scale that is not a usable number', () => {
    for (const requested of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(rasterScaleFor(1000, 640, requested)).toBeGreaterThanOrEqual(2);
    }
  });

  it('does not divide by zero on an empty drawing', () => {
    expect(Number.isFinite(rasterScaleFor(0, 0, 2))).toBe(true);
  });
});
