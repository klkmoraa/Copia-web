import { describe, expect, it } from 'vitest';
import type { ProjectModel, SupportDefinition } from '../types';
import { analyzeBuckling } from './buckling';

const baseProject = (): ProjectModel => ({
  schemaVersion: 1,
  id: 'test',
  name: 'test',
  nodes: [],
  members: [],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
    showNodeLabels: true, showMemberLabels: false, showLocalAxes: false, showLoads: true,
    showDimensions: true, showResultValues: true, diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
  },
});

const E = 2e8;      // kN/m²
const I = 1e-4;     // m⁴
const A = 0.01;     // m²
const L = 3;        // m
const EI = E * I;
/** Carga de referencia: 1 kN de compresión en la cabeza, así que λcr es Pcr en kN. */
const REFERENCE_LOAD = 1;

/**
 * Columna vertical de longitud L partida en `elements` barras, con la carga de
 * referencia comprimiendo la cabeza. `topSupport` es lo que distingue las
 * cuatro condiciones de borde clásicas.
 */
const column = (elements: number, baseSupport: SupportDefinition, topSupport: SupportDefinition): ProjectModel => {
  const project = baseProject();
  for (let index = 0; index <= elements; index += 1) {
    const support = index === 0 ? baseSupport : index === elements ? topSupport : { type: 'none' as const };
    project.nodes.push({ id: `N${index}`, x: 0, y: (L * index) / elements, support });
  }
  for (let index = 0; index < elements; index += 1) {
    project.members.push({ id: `M${index}`, i: `N${index}`, j: `N${index + 1}`, type: 'frame', E, A, I });
  }
  project.nodalLoads = [{ id: 'P', nodeId: `N${elements}`, caseId: 'LC1', fx: 0, fy: -REFERENCE_LOAD, mz: 0 }];
  return project;
};

const FIXED: SupportDefinition = { type: 'fixed' };
const PIN: SupportDefinition = { type: 'pin' };
/** Deslizadera que sólo impide el movimiento horizontal: la normal restringida apunta según +X. */
const HORIZONTAL_ROLLER: SupportDefinition = { type: 'roller', angleDeg: 0 };
/** Empotramiento deslizante: impide giro y desplazamiento horizontal, deja bajar la cabeza. */
const GUIDED: SupportDefinition = { type: 'custom', restrainX: true, restrainR: true };

/** Pcr = C·π²EI/L² — los cuatro casos de Euler con su factor de longitud efectiva. */
const euler = (factor: number) => (factor * Math.PI ** 2 * EI) / L ** 2;

const relativeError = (actual: number, expected: number) => Math.abs(actual - expected) / Math.abs(expected);

describe('pandeo lineal · columna de Euler', () => {
  it.each([
    ['en voladizo (empotrada-libre)', FIXED, { type: 'none' } as SupportDefinition, 0.25],
    ['biarticulada', PIN, HORIZONTAL_ROLLER, 1],
    ['empotrada-articulada', FIXED, HORIZONTAL_ROLLER, 2.0457],
    ['biempotrada (cabeza guiada)', FIXED, GUIDED, 4],
  ])('reproduce la carga crítica de la columna %s', (_name, baseSupport, topSupport, factor) => {
    const result = analyzeBuckling(column(16, baseSupport, topSupport), null, { modes: 1 });
    expect(result.success, result.reason).toBe(true);
    expect(result.converged).toBe(true);
    // Con 16 elementos el error de discretización queda por debajo del 0.1 %.
    expect(relativeError(result.criticalLoadFactor!, euler(factor))).toBeLessThan(1e-3);
  });

  it('converge al valor exacto al refinar, y siempre por arriba', () => {
    const exact = euler(0.25);
    const errors = [1, 2, 4, 8].map((elements) => {
      const result = analyzeBuckling(column(elements, FIXED, { type: 'none' }), null, { modes: 1 });
      expect(result.success, result.reason).toBe(true);
      return { elements, value: result.criticalLoadFactor!, error: (result.criticalLoadFactor! - exact) / exact };
    });
    // El elemento de viga sobrestima la rigidez, así que la carga crítica
    // calculada es siempre mayor que la exacta: el error es positivo y se
    // reduce monótonamente. Un error negativo significaría que la formulación
    // ablanda la estructura, que sería un defecto de ensamblaje.
    for (const { error, elements } of errors) expect(error, `${elements} elementos`).toBeGreaterThan(0);
    for (let index = 1; index < errors.length; index += 1) {
      expect(errors[index].error).toBeLessThan(errors[index - 1].error);
    }
    // Un solo elemento sobrestima un 0.75 %, la cifra que `pDelta.ts` ya
    // declara para esta misma discretización.
    expect(errors[0].error).toBeGreaterThan(0.005);
    expect(errors[0].error).toBeLessThan(0.01);
    expect(errors[3].error).toBeLessThan(1e-4);
  });

  it('da varios modos, ordenados y distintos', () => {
    const result = analyzeBuckling(column(16, PIN, HORIZONTAL_ROLLER), null, { modes: 3 });
    expect(result.success, result.reason).toBe(true);
    expect(result.modes).toHaveLength(3);
    for (let index = 1; index < result.modes.length; index += 1) {
      expect(result.modes[index].criticalLoadFactor).toBeGreaterThan(result.modes[index - 1].criticalLoadFactor);
    }
    // Los modos de la biarticulada son Pcr,n = n²·π²EI/L².
    [1, 2, 3].forEach((n, index) => {
      expect(relativeError(result.modes[index].criticalLoadFactor, euler(n * n))).toBeLessThan(5e-3);
    });
  });

  it('normaliza la forma del modo a traslación máxima unidad', () => {
    const result = analyzeBuckling(column(8, FIXED, { type: 'none' }), null, { modes: 1 });
    const peak = Math.max(...result.modes[0].shape.map((node) => Math.max(Math.abs(node.ux), Math.abs(node.uy))));
    expect(peak).toBeCloseTo(1, 9);
  });

  it('deja quieto el nudo empotrado en la forma del modo', () => {
    const result = analyzeBuckling(column(8, FIXED, { type: 'none' }), null, { modes: 1 });
    const base = result.modes[0].shape.find((node) => node.nodeId === 'N0')!;
    expect(Math.abs(base.ux)).toBeLessThan(1e-12);
    expect(Math.abs(base.uy)).toBeLessThan(1e-12);
    expect(Math.abs(base.rz)).toBeLessThan(1e-12);
  });

  it('escala como la carga de referencia: doblarla parte λcr por la mitad', () => {
    const single = analyzeBuckling(column(8, FIXED, { type: 'none' }), null, { modes: 1 });
    const doubled = column(8, FIXED, { type: 'none' });
    doubled.nodalLoads[0].fy = -2 * REFERENCE_LOAD;
    const twice = analyzeBuckling(doubled, null, { modes: 1 });
    expect(twice.criticalLoadFactor!).toBeCloseTo(single.criticalLoadFactor! / 2, 6);
  });
});

describe('pandeo lineal · lo que se niega a calcular', () => {
  it('no calcula pandeo sin compresión en ninguna barra', () => {
    const project = column(4, FIXED, { type: 'none' });
    project.nodalLoads[0].fy = REFERENCE_LOAD; // tracción
    const result = analyzeBuckling(project, null, { modes: 1 });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('comprimido');
  });

  it('no calcula pandeo si el análisis de primer orden no vale', () => {
    const project = column(4, { type: 'none' }, { type: 'none' });
    const result = analyzeBuckling(project, null, { modes: 1 });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('primer orden');
  });

  it('no calcula pandeo por flexión en una armadura, que no la tiene', () => {
    /* Un triángulo de barras de dos fuerzas, estable y con las diagonales
       comprimidas. Tiene que rechazarse por no tener rigidez a flexión, no por
       ser un mecanismo: una columna de armadura con nudo intermedio sí lo es, y
       entonces la negativa vendría del guardián anterior y esta prueba no
       estaría comprobando lo que dice comprobar. */
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: PIN },
      { id: 'B', x: 3, y: 0, support: { type: 'roller' } },
      { id: 'C', x: 1.5, y: 2, support: { type: 'none' } },
    ];
    project.members = [
      { id: 'AB', i: 'A', j: 'B', type: 'truss', E, A, I },
      { id: 'AC', i: 'A', j: 'C', type: 'truss', E, A, I },
      { id: 'BC', i: 'B', j: 'C', type: 'truss', E, A, I },
    ];
    project.nodalLoads = [{ id: 'P', nodeId: 'C', caseId: 'LC1', fx: 0, fy: -REFERENCE_LOAD, mz: 0 }];
    const result = analyzeBuckling(project, null, { modes: 1 });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('pórtico');
  });

  it('avisa cuando la carga aplicada ya supera la crítica', () => {
    const project = column(8, FIXED, { type: 'none' });
    // Diez veces la carga crítica del voladizo.
    project.nodalLoads[0].fy = -10 * euler(0.25);
    const result = analyzeBuckling(project, null, { modes: 1 });
    expect(result.success).toBe(true);
    expect(result.criticalLoadFactor!).toBeLessThan(1);
    expect(result.issues.map((issue) => issue.id)).toContain('buckling-below-applied-load');
  });
});
