import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { analyzeProject, geometricStiffness } from './solver';
import { analyzeProjectPDelta, DEFAULT_PDELTA_CONFIG } from './pDelta';
import { resolveReliability } from './reliability';

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

/** Vertical cantilever, base at N1 (fixed), tip at N2; matches the closed-form benchmark below. */
const cantilever = (L: number, E: number, I: number, A = 0.01): ProjectModel => {
  const project = baseProject();
  project.nodes = [
    { id: 'N1', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'N2', x: 0, y: L, support: { type: 'none' } },
  ];
  project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E, A, I }];
  return project;
};

/** Applies a tip axial force (compressive when `axial<0`, i.e. pushes down toward the base) plus a lateral force. */
const withTipLoads = (project: ProjectModel, axial: number, lateral: number): ProjectModel => {
  project.nodalLoads = [{ id: 'AX', nodeId: 'N2', caseId: 'LC1', fx: lateral, fy: axial, mz: 0 }];
  return project;
};

const tipUx = (project: ProjectModel) => {
  const result = analyzeProjectPDelta(project);
  const tip = result.nodeResults.find((node) => node.nodeId === 'N2')!;
  return { result, ux: Math.abs(tip.ux) };
};

const close = (actual: number, expected: number, relTolerance: number) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(relTolerance * Math.max(1e-9, Math.abs(expected)));
};

// Closed-form cantilever beam-column reference (derived independently from
// EI v'' + P v = H(L-x) + P*delta, k = sqrt(P/EI); see docs/motor-matematico/CONTEXTO-PDELTA.md).
const exactCantileverDeflection = (L: number, EI: number, H: number, P: number): number => {
  if (P === 0) return (H * L ** 3) / (3 * EI);
  const k = Math.sqrt(P / EI);
  return (H * (Math.tan(k * L) - k * L)) / (P * k);
};
const exactCantileverTensionDeflection = (L: number, EI: number, H: number, T: number): number => {
  const k = Math.sqrt(T / EI);
  return (H * (k * L - Math.tanh(k * L))) / (T * k);
};

const L = 4;
const E = 200e6;
const I = 8e-5;
const EI = E * I; // 16000 kN.m^2
const H = 10;
const Pcr = (Math.PI ** 2 * EI) / (2 * L) ** 2; // fixed-free Euler load

describe('geometricStiffness', () => {
  it('is zero on the axial rows/columns and symmetric, matching the standard beam-column formula', () => {
    const k = geometricStiffness(2, 10); // L=2, N=10 (tension)
    for (const row of [0, 3]) for (let col = 0; col < 6; col += 1) expect(k[row][col]).toBe(0);
    for (let i = 0; i < 6; i += 1) for (let j = 0; j < 6; j += 1) expect(k[i][j]).toBeCloseTo(k[j][i], 12);
    // N/L = 5; 6/5*5=6; L/10*5=1; 2L^2/15*5=13.333...
    expect(k[1][1]).toBeCloseTo(6, 10);
    expect(k[1][2]).toBeCloseTo(1, 10);
    expect(k[2][2]).toBeCloseTo(8 / 3, 10);
    expect(k[1][4]).toBeCloseTo(-6, 10);
  });

  it('is exactly zero when the axial force is zero', () => {
    const k = geometricStiffness(3.7, 0);
    expect(k.flat().every((value) => value === 0)).toBe(true);
  });
});

describe('P-Delta: aislamiento del backend experimental', () => {
  it('marca la corrida como experimental y fuerza LU denso aunque primer orden califique para sparse', () => {
    const project = baseProject();
    project.nodes = [];
    project.members = [];
    project.nodalLoads = [];
    for (let index = 0; index < 25; index += 1) {
      const baseId = `B${index}`;
      const tipId = `T${index}`;
      project.nodes.push(
        { id: baseId, x: index * 2, y: 0, support: { type: 'fixed' } },
        { id: tipId, x: index * 2, y: 3, support: { type: 'none' } },
      );
      project.members.push({ id: `M${index}`, i: baseId, j: tipId, type: 'frame', E, A: 0.02, I });
      project.nodalLoads.push({ id: `H${index}`, nodeId: tipId, caseId: 'LC1', fx: H, fy: 0, mz: 0 });
    }

    const firstOrder = analyzeProject(project);
    const secondOrder = analyzeProjectPDelta(project);

    expect(firstOrder.success).toBe(true);
    expect(firstOrder.linearSolver?.backend).toBe('sparse-ldlt');
    expect(secondOrder.success).toBe(true);
    expect(secondOrder.linearSolver).toMatchObject({ policy: 'dense', backend: 'dense-lu' });
    expect(secondOrder.pDelta).toMatchObject({ experimental: true, converged: true });
  });
});

describe('P-Delta: coincidencia con primer orden sin fuerza axial (requisito 1)', () => {
  it('reproduce el desplazamiento de primer orden cuando no hay fuerza axial', () => {
    const project = withTipLoads(cantilever(L, E, I), 0, H);
    const firstOrder = analyzeProject(project);
    const { result, ux } = tipUx(project);
    expect(result.success).toBe(true);
    expect(result.pDelta?.converged).toBe(true);
    close(ux, Math.abs(firstOrder.nodeResults.find((n) => n.nodeId === 'N2')!.ux), 1e-8);
    close(ux, exactCantileverDeflection(L, EI, H, 0), 1e-8);
  });
});

describe('P-Delta: compresión pequeña se acerca al primer orden (requisito 2)', () => {
  it('con compresión de 0.1*Pcr, el resultado queda cerca del de primer orden y de la fórmula exacta', () => {
    const P = 0.1 * Pcr;
    const project = withTipLoads(cantilever(L, E, I), -P, H);
    const { ux } = tipUx(project);
    const exact = exactCantileverDeflection(L, EI, H, P);
    const firstOrderDelta = (H * L ** 3) / (3 * EI);
    close(ux, exact, 0.05);
    expect(ux).toBeGreaterThan(firstOrderDelta);
    expect(ux / firstOrderDelta).toBeLessThan(1.3);
  });
});

describe('P-Delta: más compresión amplifica el desplazamiento lateral (requisito 3)', () => {
  it('con compresión de 0.5*Pcr el desplazamiento es mayor que con 0.1*Pcr, y cercano a la fórmula exacta', () => {
    const low = tipUx(withTipLoads(cantilever(L, E, I), -0.1 * Pcr, H)).ux;
    const high = tipUx(withTipLoads(cantilever(L, E, I), -0.5 * Pcr, H)).ux;
    expect(high).toBeGreaterThan(low);
    close(high, exactCantileverDeflection(L, EI, H, 0.5 * Pcr), 0.05);
  });
});

describe('P-Delta: la tensión no amplifica como la compresión (requisito 4)', () => {
  it('con tensión axial el desplazamiento lateral es menor que en primer orden y que en compresión equivalente', () => {
    const magnitude = 0.5 * Pcr;
    const firstOrderDelta = (H * L ** 3) / (3 * EI);
    const tension = tipUx(withTipLoads(cantilever(L, E, I), magnitude, H)).ux;
    const compression = tipUx(withTipLoads(cantilever(L, E, I), -magnitude, H)).ux;
    expect(tension).toBeLessThan(firstOrderDelta);
    expect(firstOrderDelta).toBeLessThan(compression);
    close(tension, exactCantileverTensionDeflection(L, EI, H, magnitude), 0.05);
  });
});

describe('P-Delta: columna en voladizo con carga axial y lateral (requisito 5)', () => {
  it('converge y reporta la fuerza axial usada en la rigidez geométrica', () => {
    const P = 0.3 * Pcr;
    const project = withTipLoads(cantilever(L, E, I), -P, H);
    const { result } = tipUx(project);
    expect(result.pDelta?.converged).toBe(true);
    close(result.pDelta!.memberAxialForces.M1, -P, 1e-6);
  });
});

describe('P-Delta: pórtico simple con cargas gravitacionales y laterales (requisito 6)', () => {
  it('un pórtico de una crujía converge y amplifica el desplazamiento lateral respecto al primer orden', () => {
    const project = baseProject();
    const h = 3.5;
    const span = 5;
    project.nodes = [
      { id: 'B1', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B2', x: span, y: 0, support: { type: 'fixed' } },
      { id: 'C1', x: 0, y: h, support: { type: 'none' } },
      { id: 'C2', x: span, y: h, support: { type: 'none' } },
    ];
    const E2 = 25e6;
    const A2 = 0.09;
    const I2 = 6.75e-4;
    project.members = [
      { id: 'COL1', i: 'B1', j: 'C1', type: 'frame', E: E2, A: A2, I: I2 },
      { id: 'COL2', i: 'B2', j: 'C2', type: 'frame', E: E2, A: A2, I: I2 },
      { id: 'BEAM', i: 'C1', j: 'C2', type: 'frame', E: E2, A: A2, I: I2 },
    ];
    project.nodalLoads = [
      { id: 'G1', nodeId: 'C1', caseId: 'LC1', fx: 0, fy: -300, mz: 0 },
      { id: 'G2', nodeId: 'C2', caseId: 'LC1', fx: 0, fy: -300, mz: 0 },
      { id: 'W', nodeId: 'C1', caseId: 'LC1', fx: 40, fy: 0, mz: 0 },
    ];
    const firstOrder = analyzeProject(project);
    const result = analyzeProjectPDelta(project);
    expect(firstOrder.success).toBe(true);
    expect(result.success).toBe(true);
    expect(result.pDelta?.converged).toBe(true);
    const swayFirst = Math.abs(firstOrder.nodeResults.find((n) => n.nodeId === 'C1')!.ux);
    const swayPDelta = Math.abs(result.nodeResults.find((n) => n.nodeId === 'C1')!.ux);
    expect(swayPDelta).toBeGreaterThan(swayFirst);
    expect(result.residualNorm).toBeLessThan(1e-8);
  });
});

describe('P-Delta: convergencia con distintos tamaños de paso (requisito 8)', () => {
  it('el desplazamiento convergido no depende de qué política de paso/iteración se use', () => {
    // Two different, independently valid step/iteration policies must settle
    // on the same physical answer — the load-stepping ladder is a numerical
    // strategy, not part of the physics.
    const P = 0.5 * Pcr;
    const project = withTipLoads(cantilever(L, E, I), -P, H);
    const defaultPolicy = analyzeProjectPDelta(project);
    const alternatePolicy = analyzeProjectPDelta(project, undefined, { stepReductionFactor: 0.8, maxIterationsPerStep: 60 });
    expect(defaultPolicy.pDelta?.converged).toBe(true);
    expect(alternatePolicy.pDelta?.converged).toBe(true);
    const uxDefault = Math.abs(defaultPolicy.nodeResults.find((n) => n.nodeId === 'N2')!.ux);
    const uxAlternate = Math.abs(alternatePolicy.nodeResults.find((n) => n.nodeId === 'N2')!.ux);
    close(uxDefault, uxAlternate, 1e-6);
  });
});

describe('P-Delta: reducción automática de paso cuando una iteración falla (requisito 9)', () => {
  it('con un límite de iteraciones demasiado ajustado, subdivide el paso en vez de rendirse de inmediato', () => {
    // maxIterationsPerStep=2 is deliberately too tight for this model's own
    // convergence rate at lambda=1 (it needs ~3): the loop must reduce the
    // load fraction and try again rather than declare failure outright.
    const P = 0.85 * Pcr;
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -P, H), undefined, { maxIterationsPerStep: 2, maxLoadSteps: 12 });
    const distinctLambdas = new Set(result.pDelta?.history.map((entry) => entry.lambda));
    expect(distinctLambdas.size).toBeGreaterThan(1);
  });
});

describe('P-Delta: caso cercano a la carga crítica (requisito 10)', () => {
  it('a 0.9*Pcr converge con una amplificación grande y una advertencia de estabilidad', () => {
    const P = 0.9 * Pcr;
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -P, H));
    expect(result.pDelta?.converged).toBe(true);
    expect(result.pDelta?.amplificationFactor ?? 0).toBeGreaterThan(3);
  });
});

describe('P-Delta: caso que no converge y se rechaza con claridad (requisito 11)', () => {
  it('por encima de la carga crítica, el análisis se rechaza en vez de devolver un número engañoso', () => {
    const P = 1.2 * Pcr;
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -P, H), undefined, { maxLoadSteps: 8, minimumStep: 1 / 32 });
    expect(result.success).toBe(false);
    expect(result.pDelta?.converged).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'pdelta-not-converged')).toBe(true);
    expect(result.nodeResults).toHaveLength(0);
  });
});

describe('P-Delta: conservación del equilibrio final (requisito 12)', () => {
  it('el residuo algebraico K·U=F y el balance de fuerzas se mantienen pequeños en el resultado convergido', () => {
    // `equilibrium.normalizedResidual` compares against *undeformed* geometry
    // and is expected to carry the real P·Δ moment under P-Delta (see the
    // 'global-equilibrium' info issue) — the algebraic residual of the solved
    // system, and the force (not moment) balance, are the checks that must
    // stay tight regardless of analysis order.
    const P = 0.4 * Pcr;
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -P, H));
    expect(result.residualNorm).toBeLessThan(1e-8);
    // sumFx/sumFy are the residuals (applied + reaction), not the raw loads — they must cancel to ~0.
    close(result.equilibrium.sumFx, 0, 1e-6);
    close(result.equilibrium.sumFy, 0, 1e-6);
  });
});

describe('P-Delta: conservación de restricciones (requisito 13)', () => {
  it('las reacciones del apoyo fijo siguen equilibrando exactamente las cargas aplicadas', () => {
    const P = 0.4 * Pcr;
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -P, H));
    const base = result.nodeResults.find((n) => n.nodeId === 'N1')!;
    close(base.rx ?? 0, -H, 1e-6);
    close(base.ry ?? 0, P, 1e-6);
  });
});

describe('P-Delta: compatibilidad del modo de primer orden existente (requisito 14)', () => {
  it('analyzeProject sin la opción P-Delta se comporta exactamente igual que antes', () => {
    const project = withTipLoads(cantilever(L, E, I), -0.3 * Pcr, H);
    const a = analyzeProject(project);
    const b = analyzeProject(project);
    expect(a).toEqual(b);
    expect(a.pDelta).toBeUndefined();
  });
});

describe('P-Delta: resultado determinista al repetir el análisis (requisito 15)', () => {
  it('dos corridas de analyzeProjectPDelta sobre el mismo modelo dan el mismo resultado', () => {
    const project = withTipLoads(cantilever(L, E, I), -0.4 * Pcr, H);
    const a = analyzeProjectPDelta(project);
    const b = analyzeProjectPDelta(project);
    expect(a.pDelta?.loadStepsUsed).toBe(b.pDelta?.loadStepsUsed);
    expect(a.pDelta?.totalIterations).toBe(b.pDelta?.totalIterations);
    close(Math.abs(a.nodeResults.find((n) => n.nodeId === 'N2')!.ux), Math.abs(b.nodeResults.find((n) => n.nodeId === 'N2')!.ux), 1e-12);
  });
});

describe('P-Delta: hallazgos de la revisión independiente', () => {
  it('un resultado P-Delta convergido se clasifica confiable, no "unreliable" por un residuo de primer orden esperado', () => {
    // `analyzeProject` stamps `reliability` before `pDelta` exists on the
    // object; without recomputing it afterwards, every real P-Delta result
    // read as 'unreliable' purely from the expected P·Δ moment residual.
    const P = 0.3 * Pcr;
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -P, H));
    expect(result.pDelta?.converged).toBe(true);
    const reliability = resolveReliability(result);
    expect(reliability.level).toBe('reliable');
    expect(reliability.checks.find((check) => check.id === 'equilibrium')?.level).toBe('reliable');
  });

  it('un modelo completamente restringido (o sin carga) no se rechaza como si hubiera pandeado', () => {
    // Zero displacement in both first order and P-Delta made the direction
    // dot-product exactly 0, which the naive `<= 0` check misread as "response
    // reversed" — the single most common state a user encounters right after
    // switching a fresh/unloaded project to P-Delta mode.
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 6, y: 0, support: { type: 'fixed' } },
    ];
    project.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
    project.memberLoads = [{ id: 'Q', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -10, qyEnd: -10 }];
    const result = analyzeProjectPDelta(project);
    expect(result.success).toBe(true);
    expect(result.pDelta?.converged).toBe(true);

    const unloaded = baseProject();
    unloaded.nodes = project.nodes;
    unloaded.members = project.members;
    const unloadedResult = analyzeProjectPDelta(unloaded);
    expect(unloadedResult.success).toBe(true);
    expect(unloadedResult.pDelta?.converged).toBe(true);
  });

  it('la advertencia de proximidad a la carga crítica sí se activa cerca del pandeo', () => {
    // A fixed absolute condition-number threshold never fired in practice —
    // the ratio against the model's own first-order condition estimate does.
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -0.95 * Pcr, H));
    expect(result.pDelta?.converged).toBe(true);
    expect(result.pDelta?.stabilityWarning).toBeDefined();
  });

  it('no activa la advertencia de proximidad a la crítica lejos de ella', () => {
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -0.1 * Pcr, H));
    expect(result.pDelta?.converged).toBe(true);
    expect(result.pDelta?.stabilityWarning).toBeUndefined();
  });

  it('un modelo sin miembros frame no recibe la relajación de equilibrio pensada para P-Delta', () => {
    // An empty axial-force map (no `frame` members at all) must not flip
    // `pDeltaActive`: geometric stiffness never contributes anything here, so
    // an equilibrium mismatch would be a real bug, not an expected P·Δ moment.
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
      { id: 'C', x: 3, y: 4, support: { type: 'none' } },
    ];
    project.members = [
      { id: 'AB', i: 'A', j: 'B', type: 'truss', E: 200e6, A: 0.01, I: 0 },
      { id: 'AC', i: 'A', j: 'C', type: 'truss', E: 200e6, A: 0.01, I: 0 },
      { id: 'BC', i: 'B', j: 'C', type: 'truss', E: 200e6, A: 0.01, I: 0 },
    ];
    project.nodalLoads = [{ id: 'P', nodeId: 'C', caseId: 'LC1', fx: 0, fy: -20, mz: 0 }];
    const firstOrder = analyzeProject(project);
    const pDeltaResult = analyzeProjectPDelta(project);
    expect(firstOrder.success).toBe(true);
    expect(pDeltaResult.success).toBe(true);
    close(Math.abs(pDeltaResult.nodeResults.find((n) => n.nodeId === 'C')!.uy), Math.abs(firstOrder.nodeResults.find((n) => n.nodeId === 'C')!.uy), 1e-9);
    expect(pDeltaResult.issues.some((issue) => issue.id === 'global-equilibrium')).toBe(false);
  });
});

describe('P-Delta: configuración por defecto', () => {
  it('tiene límites razonables', () => {
    expect(DEFAULT_PDELTA_CONFIG.maxLoadSteps).toBeGreaterThan(0);
    expect(DEFAULT_PDELTA_CONFIG.maxIterationsPerStep).toBeGreaterThan(1);
    expect(DEFAULT_PDELTA_CONFIG.stepReductionFactor).toBeGreaterThan(0);
    expect(DEFAULT_PDELTA_CONFIG.stepReductionFactor).toBeLessThan(1);
    expect(DEFAULT_PDELTA_CONFIG.minimumStep).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fase 2: defectos reales reproducidos antes de corregirlos.
// ---------------------------------------------------------------------------

describe('P-Delta fase 2: criterios de convergencia', () => {
  it('el criterio de desplazamiento es relativo a la escala del modelo, no absoluto', () => {
    // Prueba directa del defecto: un piso `Math.max(1, ‖u‖)` en unidades base
    // convierte el criterio en absoluto para todo modelo por debajo de él. Se
    // comparan dos modelos con el MISMO problema adimensional cuyos
    // desplazamientos difieren en órdenes de magnitud; si el criterio fuese
    // absoluto, el rígido convergería por su escala y no por su precisión, y
    // ambos reportarían incrementos finales incomparables.
    const flexible = analyzeProjectPDelta(withTipLoads(cantilever(4, E, 8e-5, 0.01), -0.5 * Pcr, H));
    const stiffI = 8e-3;
    const stiffPcr = (Math.PI ** 2 * E * stiffI) / (2 * 4) ** 2;
    const stiff = analyzeProjectPDelta(withTipLoads(cantilever(4, E, stiffI, 0.01), -0.5 * stiffPcr, H));
    expect(flexible.pDelta?.converged).toBe(true);
    expect(stiff.pDelta?.converged).toBe(true);
    // Mismo problema adimensional ⇒ misma amplificación gobernante pese a que
    // los desplazamientos difieran en dos órdenes de magnitud.
    close(stiff.pDelta!.amplificationFactor!, flexible.pDelta!.amplificationFactor!, 1e-6);
    // Y el mismo número de iteraciones: la convergencia la decide la física
    // adimensional, no la magnitud en metros.
    expect(stiff.pDelta!.totalIterations).toBe(flexible.pDelta!.totalIterations);
  });

  it('reporta el cambio axial y el residuo de equilibrio como datos trazables', () => {
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -0.5 * Pcr, H));
    expect(result.pDelta?.converged).toBe(true);
    expect(Number.isFinite(result.pDelta!.finalAxialChange)).toBe(true);
    expect(result.pDelta!.finalAxialChange).toBeLessThanOrEqual(DEFAULT_PDELTA_CONFIG.equilibriumTolerance);
    // `finalEquilibriumResidual` es el residuo algebraico del sistema lineal
    // congelado, no el desequilibrio no lineal: se publica para trazabilidad y
    // NO se usa como criterio, porque vale ~1e-17 y jamás podría fallar.
    expect(Number.isFinite(result.pDelta!.finalEquilibriumResidual)).toBe(true);
    expect(result.pDelta!.finalEquilibriumResidual).toBeLessThan(1e-10);
  });
});

describe('P-Delta fase 2: validación de configuración', () => {
  it('rechaza una configuración no finita en vez de iterar sin límite', () => {
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -0.3 * Pcr, H), undefined, {
      maxIterationsPerStep: Number.POSITIVE_INFINITY,
    });
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'pdelta-invalid-config')).toBe(true);
  });

  it('rechaza tolerancias y factores fuera de rango con un mensaje accionable', () => {
    for (const bad of [
      { maxLoadSteps: 0 },
      { maxLoadSteps: 2.5 },
      { equilibriumTolerance: 0 },
      { displacementTolerance: -1 },
      { stepReductionFactor: 1 },
      { stepReductionFactor: 0 },
      { minimumStep: 0 },
      { minimumStep: 2 },
      { maxIterationsPerStep: Number.NaN },
    ] as const) {
      const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -0.3 * Pcr, H), undefined, bad);
      expect(result.success, JSON.stringify(bad)).toBe(false);
      const issue = result.issues.find((item) => item.id === 'pdelta-invalid-config');
      expect(issue, JSON.stringify(bad)).toBeDefined();
      expect(issue!.suggestedFix).toBeTruthy();
    }
  });

  it('acepta la configuración por defecto y una configuración válida no trivial', () => {
    const ok = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -0.3 * Pcr, H), undefined, {
      maxLoadSteps: 20, maxIterationsPerStep: 50, stepReductionFactor: 0.4, minimumStep: 1 / 128,
    });
    expect(ok.success).toBe(true);
    expect(ok.pDelta?.converged).toBe(true);
  });
});

describe('P-Delta fase 2: proximidad a la carga crítica', () => {
  // La razón de condición κ₁ medida contra primer orden falla en ambos
  // sentidos: a 0.90·Pcr vale ~9.7 y a 0.95·Pcr ~19.3 (bajo el umbral 20, no
  // avisa aunque el error de un elemento ya sea 5.6 %/11.7 %), y por encima
  // de la crítica *baja* (0.43 a 3·Pcr), es decir queda ciega justo donde más
  // importa. El diagnóstico debe apoyarse en un factor de carga crítica.
  it('avisa de proximidad a la crítica a 0.90 y 0.95 de Pcr', () => {
    for (const fraction of [0.9, 0.95]) {
      const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -fraction * Pcr, H));
      expect(result.pDelta?.converged, `P/Pcr=${fraction}`).toBe(true);
      expect(result.pDelta?.stabilityWarning, `P/Pcr=${fraction}`).toBeDefined();
    }
  });

  it('rechaza todo estado posterior a la crítica, no solo el que invierte el vector completo', () => {
    // Un producto punto sobre el vector COMPLETO no basta: a 3·Pcr el
    // desplazamiento lateral sí se invierte (-6.6e-3 m contra +1.3e-2 m de
    // primer orden) pero el acortamiento axial de la columna —un GDL grande
    // que no participa del modo de pandeo— domina el producto y lo deja
    // positivo, así que el motor devolvía ese estado como éxito.
    for (const fraction of [1.01, 1.2, 2, 3, 5, 10]) {
      const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -fraction * Pcr, H));
      expect(result.success, `P/Pcr=${fraction}`).toBe(false);
      expect(result.pDelta?.converged, `P/Pcr=${fraction}`).toBe(false);
      expect(result.nodeResults, `P/Pcr=${fraction}`).toHaveLength(0);
    }
  });

  it('no inventa un factor de carga crítica cuando la compresión no gobierna', () => {
    // Un modelo gobernado por tensión no tiene carga de pandeo que citar, y su
    // proyección < 1 es la respuesta física correcta, no un estado post-crítico.
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), 0.5 * Pcr, H));
    expect(result.success).toBe(true);
    expect(result.pDelta?.converged).toBe(true);
    expect(result.pDelta?.criticalLoadFactor).toBeUndefined();
    expect(result.pDelta?.stabilityWarning).toBeUndefined();
  });

  it('estima un factor de carga crítica cercano a 1 cuando la carga se acerca a Pcr', () => {
    const half = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -0.5 * Pcr, H));
    const near = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -0.9 * Pcr, H));
    expect(half.pDelta?.criticalLoadFactor).toBeDefined();
    expect(near.pDelta?.criticalLoadFactor).toBeDefined();
    // El factor debe caer al acercarse a la crítica y mantenerse > 1 debajo de ella.
    expect(near.pDelta!.criticalLoadFactor!).toBeLessThan(half.pDelta!.criticalLoadFactor!);
    expect(near.pDelta!.criticalLoadFactor!).toBeGreaterThan(1);
    // Un solo elemento sobreestima Pcr en +0.75 %, así que el factor estimado
    // debe rondar 1/0.9 = 1.111 dentro de esa cota de discretización.
    expect(near.pDelta!.criticalLoadFactor!).toBeCloseTo(1 / 0.9, 1);
  });

  it('no avisa de proximidad a la crítica lejos de ella', () => {
    const result = analyzeProjectPDelta(withTipLoads(cantilever(L, E, I), -0.1 * Pcr, H));
    expect(result.pDelta?.converged).toBe(true);
    expect(result.pDelta?.stabilityWarning).toBeUndefined();
  });
});
