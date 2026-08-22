import { describe, expect, it } from 'vitest';
import {
  MAX_SPACING_DIVISIONS,
  isUniformSpacing,
  resolveSpacingSegments,
  resolveSpacingStations,
  spacingTotalLength,
} from './generatorSpacing';

describe('resolveSpacingSegments', () => {
  it('expands a uniform specification into equal segments', () => {
    expect(resolveSpacingSegments({ kind: 'uniform', count: 3, spacing: 5 }, 'Claros')).toEqual([5, 5, 5]);
  });

  it('preserves a non-uniform list in the declared order', () => {
    expect(resolveSpacingSegments({ kind: 'list', values: [4, 6, 3.5] }, 'Claros')).toEqual([4, 6, 3.5]);
  });

  it('returns an independent copy so callers cannot mutate the specification', () => {
    const values = [4, 6];
    const segments = resolveSpacingSegments({ kind: 'list', values }, 'Claros');
    segments[0] = 99;
    expect(values).toEqual([4, 6]);
  });

  it('rejects a non-integer uniform count', () => {
    expect(() => resolveSpacingSegments({ kind: 'uniform', count: 2.5, spacing: 5 }, 'Claros'))
      .toThrow('Claros: la cantidad de divisiones debe ser un entero mayor o igual que 1.');
  });

  it('rejects a uniform count below one', () => {
    expect(() => resolveSpacingSegments({ kind: 'uniform', count: 0, spacing: 5 }, 'Niveles'))
      .toThrow('Niveles: la cantidad de divisiones debe ser un entero mayor o igual que 1.');
  });

  it('rejects a non-positive uniform spacing', () => {
    expect(() => resolveSpacingSegments({ kind: 'uniform', count: 2, spacing: 0 }, 'Claros'))
      .toThrow('Claros: la separación debe ser un número finito mayor que cero.');
  });

  it('rejects a non-finite uniform spacing', () => {
    expect(() => resolveSpacingSegments({ kind: 'uniform', count: 2, spacing: Number.NaN }, 'Claros'))
      .toThrow('Claros: la separación debe ser un número finito mayor que cero.');
  });

  it('rejects an empty list', () => {
    expect(() => resolveSpacingSegments({ kind: 'list', values: [] }, 'Claros'))
      .toThrow('Claros: la lista de separaciones no puede estar vacía.');
  });

  it('names the offending entry of a non-positive list value', () => {
    expect(() => resolveSpacingSegments({ kind: 'list', values: [4, -2, 3] }, 'Claros'))
      .toThrow('Claros: la separación 2 debe ser un número finito mayor que cero.');
  });

  it('rejects more divisions than the generation budget allows', () => {
    expect(() => resolveSpacingSegments({ kind: 'uniform', count: MAX_SPACING_DIVISIONS + 1, spacing: 1 }, 'Claros'))
      .toThrow(`Claros: admite hasta ${MAX_SPACING_DIVISIONS} divisiones.`);
  });

  it('rejects an unknown specification kind', () => {
    expect(() => resolveSpacingSegments({ kind: 'gradual' } as never, 'Claros'))
      .toThrow('Claros: el tipo de separación no es válido.');
  });
});

describe('resolveSpacingStations', () => {
  it('accumulates uniform segments starting at the origin', () => {
    expect(resolveSpacingStations({ kind: 'uniform', count: 3, spacing: 5 }, 'Claros')).toEqual([0, 5, 10, 15]);
  });

  it('accumulates a non-uniform list', () => {
    expect(resolveSpacingStations({ kind: 'list', values: [4, 6, 3.5] }, 'Claros')).toEqual([0, 4, 10, 13.5]);
  });

  it('removes floating point noise from accumulated stations', () => {
    expect(resolveSpacingStations({ kind: 'uniform', count: 3, spacing: 0.1 }, 'Claros')[3]).toBe(0.3);
  });

  it('always returns one more station than segments', () => {
    const spec = { kind: 'list', values: [1, 2, 3, 4] } as const;
    expect(resolveSpacingStations(spec, 'Claros')).toHaveLength(resolveSpacingSegments(spec, 'Claros').length + 1);
  });
});

describe('spacing helpers', () => {
  it('reports the total length of a list specification', () => {
    expect(spacingTotalLength({ kind: 'list', values: [4, 6, 3.5] }, 'Claros')).toBe(13.5);
  });

  it('recognises a uniform specification', () => {
    expect(isUniformSpacing({ kind: 'uniform', count: 3, spacing: 5 }, 'Claros')).toBe(true);
  });

  it('recognises a list whose values are all equal as uniform', () => {
    expect(isUniformSpacing({ kind: 'list', values: [5, 5, 5] }, 'Claros')).toBe(true);
  });

  it('recognises a list with differing values as non-uniform', () => {
    expect(isUniformSpacing({ kind: 'list', values: [5, 4] }, 'Claros')).toBe(false);
  });
});
