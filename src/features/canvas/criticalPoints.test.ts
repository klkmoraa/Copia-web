import { describe, expect, it } from 'vitest';
import type { DiagramCriticalPoint } from '../../types';
import { criticalExtremesFor } from './CanvasResultLayer';

const point = (x: number, value: number, quantity: DiagramCriticalPoint['quantity'] = 'moment'): DiagramCriticalPoint =>
  ({ x, value, quantity, kind: 'maximum' });

describe('critical M/V stamps', () => {
  it('takes the extremes the analysis already resolved, with their own station', () => {
    const marks = criticalExtremesFor(
      [point(0, 0), point(1.5, 42), point(3, -18), point(4, 12)],
      'moment',
      1,
    );
    expect(marks.map((mark) => [mark.extreme, mark.point.x, mark.point.value])).toEqual([
      ['max', 1.5, 42],
      ['min', 3, -18],
    ]);
  });

  it('ignores the quantity that is not being looked at', () => {
    const marks = criticalExtremesFor(
      [point(1, 99, 'shear'), point(2, 30, 'moment')],
      'moment',
      1,
    );
    expect(marks).toHaveLength(1);
    expect(marks[0].point.value).toBe(30);
  });

  it('stamps a constant-sign diagram once, not twice on the same reading', () => {
    // Con Mmax = Mmin el sello se apilaría sobre sí mismo.
    const marks = criticalExtremesFor([point(0, 25), point(2, 25)], 'moment', 1);
    expect(marks).toHaveLength(1);
    expect(marks[0].extreme).toBe('max');
  });

  it('drops the extremes that do not clear the significance floor', () => {
    // El filtro es lo que evita que treinta barras cubran el lienzo de sellos.
    expect(criticalExtremesFor([point(1, 4), point(2, -3)], 'moment', 10)).toEqual([]);
    expect(criticalExtremesFor([point(1, 40), point(2, -3)], 'moment', 10)).toHaveLength(1);
  });

  it('returns nothing when the member has no critical points for that quantity', () => {
    expect(criticalExtremesFor([], 'shear', 0)).toEqual([]);
  });
});
