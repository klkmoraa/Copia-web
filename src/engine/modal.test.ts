import { describe, expect, it } from 'vitest';
import type { ProjectModel, SupportDefinition } from '../types';
import { analyzeModal } from './modal';
import { frameConsistentMass, linearMass, lumpedMass } from './mass';

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

const E = 2e8;        // kN/m²
const I = 1e-4;       // m⁴
const A = 0.01;       // m²
const DENSITY = 7850; // kg/m³
const L = 6;          // m
const EI = E * I;
/** Masa por unidad de longitud en Mg/m — las unidades del motor para que ω salga en rad/s. */
const MASS_PER_LENGTH = (DENSITY * A) / 1000;

const PIN: SupportDefinition = { type: 'pin' };
const VERTICAL_ROLLER: SupportDefinition = { type: 'roller' };

/** Viga horizontal partida en `elements` barras, con apoyos en los extremos. */
const beam = (elements: number, left: SupportDefinition, right: SupportDefinition, density = DENSITY): ProjectModel => {
  const project = baseProject();
  for (let index = 0; index <= elements; index += 1) {
    const support = index === 0 ? left : index === elements ? right : { type: 'none' as const };
    project.nodes.push({ id: `N${index}`, x: (L * index) / elements, y: 0, support });
  }
  for (let index = 0; index < elements; index += 1) {
    project.members.push({ id: `M${index}`, i: `N${index}`, j: `N${index + 1}`, type: 'frame', E, A, I, density });
  }
  return project;
};

/** ωₙ de la viga biapoyada: (nπ/L)²·√(EI/m). */
const simplySupportedOmega = (n: number) => ((n * Math.PI) / L) ** 2 * Math.sqrt(EI / MASS_PER_LENGTH);
/** ω₁ del voladizo: (1.875104/L)²·√(EI/m). */
const cantileverOmega1 = () => (1.8751040687 / L) ** 2 * Math.sqrt(EI / MASS_PER_LENGTH);

const relativeError = (actual: number, expected: number) => Math.abs(actual - expected) / Math.abs(expected);

describe('matriz de masa', () => {
  it('convierte kg/m³ a Mg/m, que es lo que hace que ω salga en rad/s', () => {
    expect(linearMass({ id: 'M', i: 'A', j: 'B', type: 'frame', E, A, I, density: DENSITY })).toBeCloseTo(0.0785, 12);
  });

  it('no inventa masa donde no hay densidad', () => {
    expect(linearMass({ id: 'M', i: 'A', j: 'B', type: 'frame', E, A, I })).toBe(0);
  });

  it('reparte la misma masa total en las dos formulaciones', () => {
    const m = 0.0785;
    const length = 4;
    const total = (matrix: number[][]) => matrix[0][0] + matrix[3][3];
    // La traza traslacional axial vale la masa entera del elemento en ambas.
    expect(total(lumpedMass(m, length))).toBeCloseTo(m * length, 12);
    const consistent = frameConsistentMass(m, length);
    expect(consistent[0][0] + consistent[3][3] + 2 * consistent[0][3]).toBeCloseTo(m * length, 12);
  });
});

describe('análisis modal · viga biapoyada', () => {
  it('reproduce las tres primeras frecuencias de flexión con forma cerrada', () => {
    const result = analyzeModal(beam(16, PIN, VERTICAL_ROLLER), { modes: 3 });
    expect(result.success, result.reason).toBe(true);
    expect(result.converged).toBe(true);
    [1, 2, 3].forEach((n, index) => {
      expect(relativeError(result.modes[index].angularFrequency, simplySupportedOmega(n)), `modo ${n}`).toBeLessThan(2e-3);
    });
  });

  it('publica periodo y frecuencia coherentes entre sí', () => {
    const [mode] = analyzeModal(beam(12, PIN, VERTICAL_ROLLER), { modes: 1 }).modes;
    expect(mode.frequency).toBeCloseTo(mode.angularFrequency / (2 * Math.PI), 9);
    expect(mode.period).toBeCloseTo(1 / mode.frequency, 9);
  });

  it('acota la solución por los dos lados: la consistente por arriba, la concentrada por abajo', () => {
    const exact = simplySupportedOmega(1);
    const consistent = analyzeModal(beam(8, PIN, VERTICAL_ROLLER), { modes: 1, formulation: 'consistent' });
    const lumped = analyzeModal(beam(8, PIN, VERTICAL_ROLLER), { modes: 1, formulation: 'lumped' });
    expect(consistent.modes[0].angularFrequency).toBeGreaterThan(exact);
    expect(lumped.modes[0].angularFrequency).toBeLessThan(exact);
  });

  it('converge al refinar', () => {
    const exact = simplySupportedOmega(1);
    const errors = [2, 4, 8, 16].map((elements) =>
      relativeError(analyzeModal(beam(elements, PIN, VERTICAL_ROLLER), { modes: 1 }).modes[0].angularFrequency, exact));
    for (let index = 1; index < errors.length; index += 1) expect(errors[index]).toBeLessThan(errors[index - 1]);
    expect(errors[3]).toBeLessThan(1e-5);
  });

  it('escala con la masa: cuadruplicar la densidad divide ω por dos', () => {
    const single = analyzeModal(beam(8, PIN, VERTICAL_ROLLER), { modes: 1 });
    const heavy = analyzeModal(beam(8, PIN, VERTICAL_ROLLER, DENSITY * 4), { modes: 1 });
    expect(heavy.modes[0].angularFrequency).toBeCloseTo(single.modes[0].angularFrequency / 2, 6);
  });
});

describe('análisis modal · voladizo', () => {
  it('reproduce la primera frecuencia del voladizo con forma cerrada', () => {
    const result = analyzeModal(beam(16, { type: 'fixed' }, { type: 'none' }), { modes: 1 });
    expect(result.success, result.reason).toBe(true);
    expect(relativeError(result.modes[0].angularFrequency, cantileverOmega1())).toBeLessThan(2e-3);
  });
});

describe('análisis modal · masa participante', () => {
  it('la masa participante acumulada no supera el total y crece con los modos', () => {
    const few = analyzeModal(beam(16, PIN, VERTICAL_ROLLER), { modes: 2 });
    const many = analyzeModal(beam(16, PIN, VERTICAL_ROLLER), { modes: 6 });
    expect(few.cumulativeMassRatioY).toBeGreaterThan(0);
    expect(many.cumulativeMassRatioY).toBeGreaterThanOrEqual(few.cumulativeMassRatioY);
    expect(many.cumulativeMassRatioY).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('el primer modo de la biapoyada mueve la mayor parte de la masa vertical', () => {
    const result = analyzeModal(beam(16, PIN, VERTICAL_ROLLER), { modes: 3 });
    // Para la biapoyada el primer modo participa con 8/π² ≈ 81 % de la masa.
    expect(result.modes[0].participatingMassRatioY).toBeGreaterThan(0.75);
    expect(result.modes[0].participatingMassRatioY).toBeLessThan(0.85);
  });

  it('publica la masa total del modelo en Mg', () => {
    const result = analyzeModal(beam(8, PIN, VERTICAL_ROLLER), { modes: 1 });
    expect(result.totalMass).toBeCloseTo(MASS_PER_LENGTH * L, 9);
  });
});

describe('análisis modal · lo que se niega a calcular', () => {
  it('no inventa una densidad cuando el modelo no la tiene', () => {
    const project = beam(4, PIN, VERTICAL_ROLLER);
    project.members = project.members.map((member) => ({ ...member, density: undefined }));
    const result = analyzeModal(project, { modes: 1 });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('densidad');
  });

  it('declara el modelo sin grados de libertad libres en vez de devolver modos', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 3, y: 0, support: { type: 'fixed' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A, I, density: DENSITY }];
    const result = analyzeModal(project, { modes: 1 });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('grado de libertad libre');
  });

  it('avisa cuando los modos pedidos no cubren el 90 % de la masa', () => {
    const result = analyzeModal(beam(16, PIN, VERTICAL_ROLLER), { modes: 1 });
    expect(result.success).toBe(true);
    expect(result.issues.map((issue) => issue.id)).toContain('modal-insufficient-mass');
  });

  it('avisa de los miembros que no aportan masa sin dejar de calcular', () => {
    const project = beam(8, PIN, VERTICAL_ROLLER);
    project.members[3] = { ...project.members[3], density: undefined };
    const result = analyzeModal(project, { modes: 2 });
    expect(result.success).toBe(true);
    expect(result.issues.map((issue) => issue.id)).toContain('modal-massless-members');
  });
});
