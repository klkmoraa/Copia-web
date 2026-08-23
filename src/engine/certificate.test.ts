import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { certifyResult, type CertificateCheckId, type NumericCertificate } from './certificate';

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
const A = 0.01;

/** Pórtico de un vano con carga vertical repartida en el dintel y horizontal en la esquina. */
const portalFrame = (): ProjectModel => {
  const project = baseProject();
  project.nodes = [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 6, y: 0, support: { type: 'fixed' } },
    { id: 'C', x: 0, y: 4, support: { type: 'none' } },
    { id: 'D', x: 6, y: 4, support: { type: 'none' } },
  ];
  project.members = [
    { id: 'AC', i: 'A', j: 'C', type: 'frame', E, A, I },
    { id: 'BD', i: 'B', j: 'D', type: 'frame', E, A, I },
    { id: 'CD', i: 'C', j: 'D', type: 'frame', E, A, I },
  ];
  project.nodalLoads = [{ id: 'H', nodeId: 'C', caseId: 'LC1', fx: 20, fy: 0, mz: 0 }];
  project.memberLoads = [{
    id: 'Q', memberId: 'CD', caseId: 'LC1', type: 'distributed',
    coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
    qyStart: -15, qyEnd: -15,
  }];
  return project;
};

const checkOf = (certificate: NumericCertificate, id: CertificateCheckId) =>
  certificate.checks.find((check) => check.id === id)!;

describe('certificado numérico · pórtico bien resuelto', () => {
  it('emite las cuatro comprobaciones', () => {
    const certificate = certifyResult(portalFrame());
    expect(certificate.checks.map((check) => check.id).sort()).toEqual(
      ['global-equilibrium', 'h-refinement', 'linearity', 'maxwell-betti'],
    );
  });

  it('el equilibrio global se cumple', () => {
    const check = checkOf(certifyResult(portalFrame()), 'global-equilibrium');
    expect(check.status).toBe('passed');
    expect(check.value!).toBeLessThan(check.tolerance!);
  });

  it('la respuesta es exactamente lineal', () => {
    const check = checkOf(certifyResult(portalFrame()), 'linearity');
    expect(check.status).toBe('passed');
    expect(check.value!).toBeLessThan(1e-10);
  });

  it('la reciprocidad de Maxwell-Betti se cumple', () => {
    const check = checkOf(certifyResult(portalFrame()), 'maxwell-betti');
    expect(check.status).toBe('passed');
    expect(check.value!).toBeLessThan(1e-8);
  });

  it('mide el error de discretización sin llamarlo defecto', () => {
    const check = checkOf(certifyResult(portalFrame()), 'h-refinement');
    expect(check.value).toBeGreaterThanOrEqual(0);
    expect(check.message).toContain('no un defecto');
  });

  it('cuenta las resoluciones extra que cuesta', () => {
    // Una por linealidad, dos por reciprocidad, una por refinamiento.
    expect(certifyResult(portalFrame()).extraSolves).toBe(4);
  });

  it('el veredicto es verificado cuando todo se cumple', () => {
    const certificate = certifyResult(portalFrame());
    expect(certificate.verdict).toBe('verified');
    expect(certificate.summary).toContain('se cumplen');
  });

  it('permite saltarse comprobaciones caras', () => {
    const certificate = certifyResult(portalFrame(), null, { skip: ['h-refinement', 'maxwell-betti'] });
    expect(certificate.checks.map((check) => check.id)).toEqual(['global-equilibrium', 'linearity']);
    expect(certificate.extraSolves).toBe(1);
  });
});

describe('certificado numérico · lo que detecta y lo que no', () => {
  it('la reciprocidad no se contesta con dos ceros: exige movimiento real', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 3, y: 0, support: { type: 'fixed' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A, I }];
    const check = checkOf(certifyResult(project), 'maxwell-betti');
    expect(check.status).toBe('not-applicable');
  });

  it('la reciprocidad se mide sobre la estructura sin cargas, no sobre la cargada', () => {
    /* El mismo pórtico con y sin cargas tiene que dar la misma discrepancia de
       reciprocidad: si el valor cambiara con la carga, la comprobación estaría
       mirando el estado y no la simetría de la rigidez, que es lo que dice
       mirar. */
    const loaded = certifyResult(portalFrame());
    const heavier = portalFrame();
    heavier.nodalLoads[0].fx = 500;
    const other = certifyResult(heavier);
    expect(checkOf(other, 'maxwell-betti').value!).toBeCloseTo(checkOf(loaded, 'maxwell-betti').value!, 12);
  });

  it('el refinamiento acusa la malla gruesa de una viga con carga repartida', () => {
    /* Un solo elemento con carga repartida tiene error de discretización
       apreciable en los nudos; con la viga ya partida, mucho menos. La
       comprobación tiene que distinguir los dos casos o no está midiendo nada. */
    const coarse = baseProject();
    coarse.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 8, y: 0, support: { type: 'roller' } },
      { id: 'C', x: 8, y: 4, support: { type: 'none' } },
    ];
    coarse.members = [
      { id: 'AB', i: 'A', j: 'B', type: 'frame', E, A, I },
      { id: 'BC', i: 'B', j: 'C', type: 'frame', E, A, I },
    ];
    coarse.memberLoads = [{
      id: 'Q', memberId: 'BC', caseId: 'LC1', type: 'distributed',
      coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qxStart: 8, qxEnd: 8,
    }];
    const check = checkOf(certifyResult(coarse), 'h-refinement');
    expect(check.value).toBeGreaterThan(0);
  });

  it('no certifica un modelo que no se resuelve', () => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'none' } },
      { id: 'B', x: 3, y: 0, support: { type: 'none' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E, A, I }];
    project.nodalLoads = [{ id: 'P', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    const certificate = certifyResult(project);
    expect(certificate.verdict).toBe('not-verifiable');
    expect(certificate.checks).toEqual([]);
  });

  it('un modelo sin movimiento no finge comprobaciones que no puede hacer', () => {
    const project = portalFrame();
    project.nodalLoads = [];
    project.memberLoads = [];
    const certificate = certifyResult(project);
    expect(checkOf(certificate, 'linearity').status).toBe('not-applicable');
    expect(checkOf(certificate, 'h-refinement').status).toBe('not-applicable');
  });

  it('certifica también un modelo con zonas rígidas y conexiones semirrígidas', () => {
    /* Es justo donde la simetría de la rigidez global es más fácil de romper:
       transformaciones excéntricas y condensación estática juntas. */
    const project = portalFrame();
    project.members = project.members.map((member) => member.id === 'CD'
      ? { ...member, rigidOffsetI: 0.3, rigidOffsetJ: 0.3, rotationalSpringI: 5e4 }
      : member);
    const certificate = certifyResult(project);
    expect(checkOf(certificate, 'maxwell-betti').status).toBe('passed');
    expect(checkOf(certificate, 'global-equilibrium').status).toBe('passed');
  });
});
