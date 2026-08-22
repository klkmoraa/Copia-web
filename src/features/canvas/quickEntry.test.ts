import { describe, expect, it } from 'vitest';
import { parseQuickEntryPair } from './quickEntry';

describe('parseQuickEntryPair', () => {
  it.each([
    ['1.25', '-3.5', { first: 1.25, second: -3.5 }],
    ['1,25', '-3,5', { first: 1.25, second: -3.5 }],
    [' 0,125 ', '90', { first: 0.125, second: 90 }],
  ])('accepts point or comma decimals', (first, second, expected) => {
    expect(parseQuickEntryPair(first, second)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['', '1'],
    ['1,2.3', '4'],
    ['1e3', '4'],
    ['NaN', '4'],
  ])('rejects ambiguous or incomplete values without coercion', (first, second) => {
    expect(parseQuickEntryPair(first, second)).toEqual({ ok: false });
  });
});
