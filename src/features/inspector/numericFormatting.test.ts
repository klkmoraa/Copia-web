import { describe, expect, it } from 'vitest';
import {
  formatInspectorNumber,
  formatInspectorValue,
  parseInspectorNumber,
  serializeInspectorNumber,
} from './numericFormatting';

describe('Inspector numeric formatting', () => {
  it('uses one compact presentational rule and only normalizes negative zero visually', () => {
    expect(formatInspectorNumber(-0)).toBe('0');
    expect(formatInspectorNumber(12.34001)).toBe('12.34');
    expect(formatInspectorNumber(0.0001234567)).toBe('0.000123457');
    expect(formatInspectorNumber(0.00001)).toBe('1e-5');
    expect(formatInspectorNumber(10_000_000)).toBe('1e+7');
    expect(formatInspectorNumber(123_456_789)).toBe('1.23457e+8');
    expect(formatInspectorValue(12.5, 'kN')).toBe('12.5 kN');
  });

  it('allows contextual precision overrides without retaining cosmetic zeros', () => {
    expect(formatInspectorNumber(1.234567, { maximumFractionDigits: 2 })).toBe('1.23');
    expect(formatInspectorNumber(1.234567e8, { significantDigits: 4 })).toBe('1.235e+8');
    expect(formatInspectorNumber(4, { maximumFractionDigits: 4 })).toBe('4');
    expect(formatInspectorNumber(Number.NaN)).toBe('—');
  });

  it('serializes finite values with a non-destructive round trip', () => {
    const values = [0, 0.1, -18.625, 1 / 3, Number.MIN_VALUE, Number.MAX_VALUE];
    for (const value of values) {
      const serialized = serializeInspectorNumber(value);
      expect(Object.is(Number(serialized), value)).toBe(true);
    }
    expect(serializeInspectorNumber(-0)).toBe('0');
    expect(serializeInspectorNumber(Number.POSITIVE_INFINITY)).toBe('');
  });

  it('parses decimal and scientific drafts without coercing blank or malformed input', () => {
    expect(parseInspectorNumber(' -1.25e-3 ')).toEqual({ ok: true, value: -0.00125 });
    expect(parseInspectorNumber('.5')).toEqual({ ok: true, value: 0.5 });
    expect(parseInspectorNumber('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseInspectorNumber('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseInspectorNumber('1e')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseInspectorNumber('0x10')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseInspectorNumber('1,25')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseInspectorNumber('1e400')).toEqual({ ok: false, reason: 'non-finite' });
  });
});
