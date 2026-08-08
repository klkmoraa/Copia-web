import { describe, expect, it } from 'vitest';
import { catalogs, es, translate, type TranslationKey } from './catalogs';

describe('i18n catalogs', () => {
  it('keeps the Spanish and English catalogs structurally identical', () => {
    const expected = Object.keys(es).sort();
    expect(Object.keys(catalogs.en).sort()).toEqual(expected);
  });

  it('resolves every declared key in both languages', () => {
    for (const key of Object.keys(es) as TranslationKey[]) {
      expect(translate('es', key)).not.toBe('');
      expect(translate('en', key)).not.toBe('');
    }
  });

  it('keeps interpolation placeholders identical between languages', () => {
    const placeholders = (value: string) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
      .map((match) => match[1])
      .sort();
    for (const key of Object.keys(es) as TranslationKey[]) {
      expect(placeholders(catalogs.en[key]), key).toEqual(placeholders(es[key]));
    }
  });

  it('preserves technical identifiers and magnitudes during interpolation', () => {
    const variables = { completed: 'N-07', total: '12.50 kN' };
    expect(translate('es', 'classroom.progressCount', variables)).toContain('N-07');
    expect(translate('es', 'classroom.progressCount', variables)).toContain('12.50 kN');
    expect(translate('en', 'classroom.progressCount', variables)).toContain('N-07');
    expect(translate('en', 'classroom.progressCount', variables)).toContain('12.50 kN');
  });

  it('interpolates named values without evaluating input', () => {
    const key = 'app.name';
    expect(translate('en', key, { unused: '<script>' })).toBe('structureCo');
  });
});
