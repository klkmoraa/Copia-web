import { describe, expect, it } from 'vitest';
import { fromDisplay, toDisplay, unitLabel, type UnitQuantity } from './units';
import type { UnitSystemId } from '../types';

const systems: UnitSystemId[] = ['kN-m', 'N-mm', 'kgf-m', 'kip-ft'];
const quantities: UnitQuantity[] = ['length', 'force', 'moment', 'distributedForce', 'elasticModulus', 'area', 'inertia', 'sectionModulus', 'sectionDimension', 'translationalStiffness', 'rotationalStiffness', 'density'];

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

  it('presenta el módulo elástico de sección como un volumen, no como un m³ fijo', () => {
    // W entra en η como |M*|/W; sólo se convierte para leerlo. 1 m³ = 1e6 cm³ =
    // 1e9 mm³ = 61 023,74 in³.
    expect(toDisplay(1, 'kN-m', 'sectionModulus')).toBeCloseTo(1, 12);
    expect(toDisplay(1, 'N-mm', 'sectionModulus')).toBeCloseTo(1e9, 3);
    expect(toDisplay(1, 'kgf-m', 'sectionModulus')).toBeCloseTo(1e6, 6);
    expect(toDisplay(1, 'kip-ft', 'sectionModulus')).toBeCloseTo(61_023.7440947323, 6);
    expect(unitLabel('kip-ft', 'sectionModulus')).toBe('in³');
  });

  it('presenta una dimensión de sección en la unidad en la que se publica, no en la del modelo', () => {
    /* El alma de un IPE 300 son 7,1 mm. Escrita como `length` sería 0,0071 en
       kN-m y 0,0233 en kip-ft; escrita como dimensión de sección es 7,1 mm y
       0,2795 in. La cantidad existe para esa diferencia. */
    const web = 0.0071;
    expect(toDisplay(web, 'kN-m', 'sectionDimension')).toBeCloseTo(7.1, 9);
    expect(toDisplay(web, 'N-mm', 'sectionDimension')).toBeCloseTo(7.1, 9);
    expect(toDisplay(web, 'kgf-m', 'sectionDimension')).toBeCloseTo(0.71, 9);
    expect(toDisplay(web, 'kip-ft', 'sectionDimension')).toBeCloseTo(0.2795275590551, 9);
    expect([unitLabel('kN-m', 'sectionDimension'), unitLabel('kgf-m', 'sectionDimension'), unitLabel('kip-ft', 'sectionDimension')])
      .toEqual(['mm', 'cm', 'in']);
  });

  it('ata la dimensión de sección a la longitud del modelo por la equivalencia de sus unidades', () => {
    /* Presentación distinta, física idéntica. Lo que esto comprueba no es un
       viaje de ida y vuelta —eso se cumple con cualquier factor— sino que los
       DOS factores de cada sistema son consistentes entre sí: 1000 mm son un
       metro y 12 in son un pie. Si alguno se tocara por separado, una sección
       construida dejaría de encajar en el modelo que la usa. */
    expect(fromDisplay(1000, 'kN-m', 'sectionDimension')).toBeCloseTo(fromDisplay(1, 'kN-m', 'length'), 12);
    expect(fromDisplay(1, 'N-mm', 'sectionDimension')).toBeCloseTo(fromDisplay(1, 'N-mm', 'length'), 12);
    expect(fromDisplay(100, 'kgf-m', 'sectionDimension')).toBeCloseTo(fromDisplay(1, 'kgf-m', 'length'), 12);
    expect(fromDisplay(12, 'kip-ft', 'sectionDimension')).toBeCloseTo(fromDisplay(1, 'kip-ft', 'length'), 12);
  });
});
