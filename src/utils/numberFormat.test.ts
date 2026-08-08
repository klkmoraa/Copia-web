import { describe, expect, it } from 'vitest';
import {
  formatFixed,
  formatMachineNumber,
  formatNearZero,
  formatNumber,
  formatValue,
  NUMBER_FORMATS,
  serializeNumber,
  type NumberFormatContext,
} from './numberFormat';

const CONTEXTS = Object.keys(NUMBER_FORMATS) as NumberFormatContext[];

/** The value table required by the 0.8.1 numeric policy. */
const POLICY_VALUES: Array<number | undefined | null> = [
  0, -0, 1e-15, -1e-15, 0.000123, -0.000123, 123.456789, 12_500, 1e9, -1e9,
  Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined, null,
];

describe('policy invariants across every context', () => {
  it('never renders -0, NaN or Infinity as a value', () => {
    for (const context of CONTEXTS) {
      for (const value of POLICY_VALUES) {
        const text = formatNumber(value, context);
        expect(text).not.toMatch(/^-0$/);
        expect(text).not.toContain('NaN');
        expect(text).not.toContain('Infinity');
        expect(text).not.toContain('undefined');
      }
    }
  });

  it('renders both zeros identically and keeps absence distinguishable from zero', () => {
    for (const context of CONTEXTS) {
      expect(formatNumber(0, context)).toBe('0');
      expect(formatNumber(-0, context)).toBe('0');
      expect(formatNumber(Number.NaN, context)).toBe(NUMBER_FORMATS[context].notAvailable);
      expect(formatNumber(undefined, context)).toBe(NUMBER_FORMATS[context].notAvailable);
      expect(formatNumber(Number.NaN, context)).not.toBe(formatNumber(0, context));
    }
  });

  it('keeps the sign of a small negative value instead of collapsing it to zero', () => {
    for (const context of CONTEXTS) {
      expect(formatNumber(-1e-15, context).startsWith('-')).toBe(true);
      expect(formatNumber(-0.000123, context).startsWith('-')).toBe(true);
    }
  });

  it('never emits a trailing zero that only pads the column', () => {
    for (const context of CONTEXTS) {
      for (const value of [1.5, 1e-15, 12_500, 0.000123, 1e9]) {
        expect(formatNumber(value, context)).not.toMatch(/\.\d*0$/);
      }
    }
  });

  it('signs the exponent so 1e+7 and 1e-7 cannot be confused at a glance', () => {
    expect(formatNumber(1e9, 'inspector')).toBe('1e+9');
    expect(formatNumber(1e-15, 'inspector')).toBe('1e-15');
  });
});

describe('per-context precision', () => {
  it('gives a canvas label four digits and a tooltip eight', () => {
    expect(formatNumber(123.456789, 'canvas')).toBe('123.5');
    expect(formatNumber(123.456789, 'inspector')).toBe('123.457');
    expect(formatNumber(123.456789, 'tooltip')).toBe('123.45679');
  });

  it('keeps the Inspector rule that Results now shares', () => {
    expect(formatNumber(1e-14, 'inspector')).toBe('1e-14');
    expect(formatNumber(1e-14, 'table')).toBe('1e-14');
    expect(formatNumber(0.0001234567, 'inspector')).toBe('0.000123457');
    expect(formatNumber(10_000_000, 'inspector')).toBe('1e+7');
  });

  it('honours a fraction-digit cap without keeping cosmetic zeros', () => {
    expect(formatNumber(1.234567, 'inspector', { maximumFractionDigits: 2 })).toBe('1.23');
    expect(formatNumber(4, 'inspector', { maximumFractionDigits: 4 })).toBe('4');
    expect(formatNumber(-0.004, 'inspector', { maximumFractionDigits: 2 })).toBe('0');
  });

  it('reports 12500 as a plain integer in every reading context', () => {
    for (const context of CONTEXTS) expect(formatNumber(12_500, context)).toBe('12500');
  });
});

describe('formatValue', () => {
  it('joins value and unit, and omits an empty unit', () => {
    expect(formatValue(12.5, 'kN')).toBe('12.5 kN');
    expect(formatValue(12.5)).toBe('12.5');
    expect(formatValue(Number.NaN, 'kN', 'inspector')).toBe('— kN');
  });
});

describe('serializeNumber', () => {
  it('round-trips every finite double without losing a bit', () => {
    for (const value of [0, 0.1, -18.625, 1 / 3, Number.MIN_VALUE, Number.MAX_VALUE, 123.456789]) {
      expect(Object.is(Number(serializeNumber(value)), value)).toBe(true);
    }
  });

  it('emits nothing for values that are not finite, and never a signed zero', () => {
    expect(serializeNumber(-0)).toBe('0');
    expect(serializeNumber(Number.POSITIVE_INFINITY)).toBe('');
    expect(serializeNumber(Number.NaN)).toBe('');
    expect(serializeNumber(undefined)).toBe('');
  });
});

describe('formatFixed', () => {
  it('keeps the column aligned', () => {
    expect(formatFixed(12.5, 3)).toBe('12.500');
    expect(formatFixed(0, 3)).toBe('0.000');
  });

  it('never shows a negative zero when a result rounds down to nothing', () => {
    // Shear crossing zero produces exactly this: toFixed alone would print "-0.000".
    expect(formatFixed(-0.0004, 3)).toBe('0.000');
    expect(formatFixed(-0, 2)).toBe('0.00');
    expect(formatFixed(-0.4, 0)).toBe('0');
    expect(formatFixed(-0.6, 0)).toBe('-1');
  });

  it('keeps a small negative value that survives rounding', () => {
    expect(formatFixed(-0.0006, 3)).toBe('-0.001');
  });

  it('marks a non-finite value instead of printing NaN', () => {
    expect(formatFixed(Number.NaN, 3)).toBe('—');
    expect(formatFixed(Number.POSITIVE_INFINITY, 3, 'report')).toBe('n/d');
    expect(formatFixed(undefined, 3)).toBe('—');
  });
});

describe('formatMachineNumber', () => {
  it('leaves a CSV cell blank rather than writing a fake number', () => {
    expect(formatMachineNumber(Number.NaN)).toBe('');
    expect(formatMachineNumber(Number.POSITIVE_INFINITY)).toBe('');
    expect(formatMachineNumber(undefined)).toBe('');
  });

  it('writes plain machine-readable digits with no locale separators', () => {
    expect(formatMachineNumber(-0)).toBe('0');
    expect(formatMachineNumber(12_500)).toBe('12500');
    expect(formatMachineNumber(123.456789)).toBe('123.456789');
    expect(formatMachineNumber(1234.5678)).not.toContain(',');
  });

  it('keeps enough digits to re-read the analysis outside the app', () => {
    expect(Number(formatMachineNumber(4.123456789012345))).toBeCloseTo(4.123456789012345, 12);
  });
});

describe('formatNearZero', () => {
  it('collapses a solver residual relative to the magnitude beside it', () => {
    expect(formatNearZero(-3.2e-17, 48)).toBe('0');
    expect(formatNearZero(1e-12, 1e6)).toBe('0');
  });

  it('does not collapse a small value that is genuinely the answer', () => {
    expect(formatNearZero(1e-5, 1)).not.toBe('0');
    expect(formatNearZero(0.000123, 1)).toBe('0.000123');
  });

  it('falls back to the plain marker for non-finite input', () => {
    expect(formatNearZero(Number.NaN, 10)).toBe('n/d');
    expect(formatNearZero(Number.NaN, 10, 'inspector')).toBe('—');
  });

  it('treats a non-finite reference as unit scale instead of throwing', () => {
    expect(formatNearZero(5, Number.NaN)).toBe('5');
  });
});
