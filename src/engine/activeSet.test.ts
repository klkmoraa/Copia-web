import { describe, expect, it } from 'vitest';
import type { MemberModel, ProjectModel } from '../types';
import { analyzeProject } from './solver';
import { analyzeProjectWithActiveSet, conditionalMembers, hasConditionalMembers } from './activeSet';

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

const E = 2e8;
const I = 1e-4;
const A = 0.001;

const axial = (result: { memberResults: Array<{ memberId: string; localEndForces: number[] }> }, id: string) => {
  const member = result.memberResults.find((candidate) => candidate.memberId === id);
  if (!member) return undefined;
  return (-member.localEndForces[0] + member.localEndForces[3]) / 2;
};

/**
 * Cuadro arriostrado en cruz: dos montantes, un dintel y dos diagonales.
 * Bajo carga horizontal una diagonal se tracciona y la otra se comprime; con
 * diagonales de sólo tracción, la comprimida tiene que descolgarse.
 */
const bracedFrame = (diagonalBehavior: MemberModel['axialBehavior']): ProjectModel => {
  const project = baseProject();
  project.nodes = [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 4, y: 0, support: { type: 'pin' } },
    { id: 'C', x: 0, y: 3, support: { type: 'none' } },
    { id: 'D', x: 4, y: 3, support: { type: 'none' } },
  ];
  const bar = (id: string, i: string, j: string): MemberModel => ({ id, i, j, type: 'frame', E, A, I });
  project.members = [
    bar('AC', 'A', 'C'),
    bar('BD', 'B', 'D'),
    bar('CD', 'C', 'D'),
    { ...bar('AD', 'A', 'D'), type: 'truss', axialBehavior: diagonalBehavior },
    { ...bar('BC', 'B', 'C'), type: 'truss', axialBehavior: diagonalBehavior },
  ];
  project.nodalLoads = [{ id: 'H', nodeId: 'C', caseId: 'LC1', fx: 50, fy: 0, mz: 0 }];
  return project;
};

describe('barras de signo restringido · identificación', () => {
  it('una barra ordinaria no es condicional', () => {
    expect(hasConditionalMembers(bracedFrame(undefined))).toBe(false);
    expect(hasConditionalMembers(bracedFrame('both'))).toBe(false);
  });

  it('reconoce las de sólo tracción y sólo compresión', () => {
    expect(conditionalMembers(bracedFrame('tension-only')).map((member) => member.id)).toEqual(['AD', 'BC']);
    expect(conditionalMembers(bracedFrame('compression-only')).map((member) => member.id)).toEqual(['AD', 'BC']);
  });
});

describe('barras de signo restringido · no cambia lo que ya funcionaba', () => {
  it('sin barras condicionales devuelve exactamente el resultado de siempre', () => {
    const project = bracedFrame(undefined);
    const plain = analyzeProject(project);
    const withActiveSet = analyzeProjectWithActiveSet(project);
    expect(withActiveSet.activeSet).toBeUndefined();
    expect(withActiveSet.displacements).toEqual(plain.displacements);
    expect(withActiveSet.nodeResults).toEqual(plain.nodeResults);
  });

  it("declarar 'both' es lo mismo que no declarar nada", () => {
    const plain = analyzeProject(bracedFrame(undefined));
    const both = analyzeProjectWithActiveSet(bracedFrame('both'));
    expect(both.displacements).toEqual(plain.displacements);
  });
});

describe('barras de signo restringido · arriostramiento en cruz', () => {
  it('descuelga la diagonal comprimida y deja trabajar sólo a la traccionada', () => {
    const linear = analyzeProject(bracedFrame(undefined));
    // Sin restricción de signo, una diagonal trabaja a tracción y la otra a compresión.
    expect(Math.sign(axial(linear, 'AD')!) * Math.sign(axial(linear, 'BC')!)).toBe(-1);

    const result = analyzeProjectWithActiveSet(bracedFrame('tension-only'));
    expect(result.success, result.activeSet?.reason).toBe(true);
    expect(result.activeSet!.converged).toBe(true);
    expect(result.activeSet!.inactiveMemberIds).toHaveLength(1);
    // La que queda tiene que estar traccionada: es lo único que un cable admite.
    const [remaining] = result.activeSet!.activeMemberIds;
    expect(axial(result, remaining)!).toBeGreaterThan(0);
    // Y la descolgada no aparece en los resultados: no está en el modelo.
    expect(axial(result, result.activeSet!.inactiveMemberIds[0])).toBeUndefined();
  });

  it('con puntales de sólo compresión descuelga la traccionada, que es el caso simétrico', () => {
    const result = analyzeProjectWithActiveSet(bracedFrame('compression-only'));
    expect(result.success, result.activeSet?.reason).toBe(true);
    expect(result.activeSet!.converged).toBe(true);
    expect(result.activeSet!.inactiveMemberIds).toHaveLength(1);
    const [remaining] = result.activeSet!.activeMemberIds;
    expect(axial(result, remaining)!).toBeLessThan(0);
  });

  it('invertir la carga descuelga la otra diagonal', () => {
    const right = analyzeProjectWithActiveSet(bracedFrame('tension-only'));
    const flipped = bracedFrame('tension-only');
    flipped.nodalLoads[0].fx = -50;
    const left = analyzeProjectWithActiveSet(flipped);
    expect(left.activeSet!.inactiveMemberIds).not.toEqual(right.activeSet!.inactiveMemberIds);
    expect(left.activeSet!.converged).toBe(true);
  });

  it('la estructura con el cable descolgado es más flexible que la lineal', () => {
    const linear = analyzeProject(bracedFrame(undefined));
    const cables = analyzeProjectWithActiveSet(bracedFrame('tension-only'));
    const drift = (result: { nodeResults: Array<{ nodeId: string; ux: number }> }) =>
      Math.abs(result.nodeResults.find((node) => node.nodeId === 'C')!.ux);
    // Quitar una barra no puede endurecer la estructura. Si esto se invirtiera,
    // el conjunto activo estaría añadiendo rigidez en vez de quitarla.
    expect(drift(cables)).toBeGreaterThan(drift(linear));
  });

  it('el equilibrio global se sigue cumpliendo con la barra descolgada', () => {
    const result = analyzeProjectWithActiveSet(bracedFrame('tension-only'));
    expect(result.equilibrium.normalizedResidual).toBeLessThan(1e-8);
  });
});

describe('barras de signo restringido · lo que no puede sostener', () => {
  it('declara mecanismo cuando descolgar la barra deja el modelo sin sostener', () => {
    /* Un único tirante sujetando una masa empujada hacia el lado que lo
       comprime: al aflojarse, el nudo se queda libre. La respuesta correcta no
       es un resultado, es decir que esa estructura no se sostiene. */
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 3, y: 0, support: { type: 'none' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'truss', E, A, I, axialBehavior: 'tension-only' }];
    project.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: -10, fy: 0, mz: 0 }];
    const result = analyzeProjectWithActiveSet(project);
    expect(result.success).toBe(false);
    expect(result.activeSet!.converged).toBe(false);
    expect(result.activeSet!.reason).toMatch(/estable|válido/);
  });

  it('respeta el techo de resoluciones en vez de iterar sin fin', () => {
    const result = analyzeProjectWithActiveSet(bracedFrame('tension-only'), null, { maxIterations: 1 });
    // Con una sola resolución el conjunto no puede haberse estabilizado si hacía
    // falta descolgar algo: se dice, no se disimula.
    expect(result.activeSet!.iterations).toBeLessThanOrEqual(1);
  });
});
