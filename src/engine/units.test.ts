import { describe, expect, it } from 'vitest';
import { fromDisplay, toDisplay, unitLabel, type UnitQuantity } from './units';
import type { UnitSystemId } from '../types';

const systems: UnitSystemId[] = ['kN-m', 'N-mm', 'kgf-m', 'kip-ft'];
const quantities: UnitQuantity[] = ['length', 'force', 'moment', 'distributedForce', 'elasticModulus', 'area', 'inertia', 'translationalStiffness', 'rotationalStiffness', 'density'];

describe('unidades coherentes', () => {
  it('convierte ida y vuelta sin modificar el valor físico', () => {
    for (const system of systems) {
      for (const quantity of quantities) {
        const value = quantity === 'inertia' ? 8.333e-6 : 123.456;
        const recovered = fromDisplay(toDisplay(value, system, quantity), system, quantity);
        expect(Math.abs(recovered - value)).toBeLessThan(1e-12 * Math.max(1, Math.abs(value)));
        expect(unitLabel(system, quantity).length).toBeGreaterThan(0);
      }
    }
  });

  it('usa equivalencias físicas conocidas', () => {
    expect(toDisplay(1, 'N-mm', 'force')).toBeCloseTo(1000, 12);
    expect(toDisplay(1, 'N-mm', 'length')).toBeCloseTo(1000, 12);
    expect(toDisplay(1, 'N-mm', 'moment')).toBeCloseTo(1_000_000, 8);
    expect(toDisplay(1, 'kgf-m', 'force')).toBeCloseTo(101.9716213, 7);
    expect(toDisplay(1, 'kip-ft', 'force')).toBeCloseTo(0.224808944, 8);
  });
});
