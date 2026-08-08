import { describe, expect, it } from 'vitest';
import type { MemberModel, NodeModel, ProjectModel } from '../types';
import { analyzeProject } from './solver';
import { analyzeProjectPDelta } from './pDelta';

/**
 * Independent analytical benchmarks and a spatial-convergence (discretisation)
 * study for the second-order engine.
 *
 * Every expected value here comes from a closed-form beam-column solution
 * derived from the governing ODE `EI v'''' + P v'' = q`, never from
 * structureCo's own output. Each closed form is self-checked by its own
 * `P → 0` limit against the corresponding first-order formula, so a wrong
 * transcription cannot silently agree with a wrong implementation.
 *
 * Tolerances are the measured discretisation error of the consistent geometric
 * stiffness at the stated mesh, plus ~30 % headroom — they are NOT tightened
 * to whatever the engine currently prints. Where a one-element model is
 * genuinely poor (5.6 % at 0.9·Pcr) the tolerance says so.
 */

const baseProject = (): ProjectModel => ({
  schemaVersion: 1,
  id: 'bench',
  name: 'bench',
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

const E = 200e6;
const AREA = 0.02;

/** Vertical cantilever of total length `L` split into `n` equal frame elements. */
const cantileverMesh = (L: number, I: number, n: number): ProjectModel => {
  const project = baseProject();
  const nodes: NodeModel[] = [];
  const members: MemberModel[] = [];
  for (let k = 0; k <= n; k += 1) {
    nodes.push({ id: `N${k}`, x: 0, y: (L * k) / n, support: k === 0 ? { type: 'fixed' } : { type: 'none' } });
    if (k > 0) members.push({ id: `M${k}`, i: `N${k - 1}`, j: `N${k}`, type: 'frame', E, A: AREA, I });
  }
  project.nodes = nodes;
  project.members = members;
  return project;
};

const withTip = (project: ProjectModel, axial: number, lateral: number, moment = 0): ProjectModel => {
  const tip = project.nodes.at(-1)!.id;
  project.nodalLoads = [{ id: 'TIP', nodeId: tip, caseId: 'LC1', fx: lateral, fy: axial, mz: moment }];
  return project;
};

const tipUx = (project: ProjectModel): number => {
  const result = analyzeProjectPDelta(project, undefined, {
    // The iteration must never be the binding error term in an accuracy test.
    displacementTolerance: 1e-12, equilibriumTolerance: 1e-12, maxIterationsPerStep: 200,
  });
  expect(result.success).toBe(true);
  expect(result.pDelta?.converged).toBe(true);
  return Math.abs(result.nodeResults.find((node) => node.nodeId === project.nodes.at(-1)!.id)!.ux);
};

const relError = (actual: number, exact: number) => (actual - exact) / exact;

// --- Closed forms, each self-checked against its own first-order limit ------

/** Fixed-free cantilever, tip lateral H + axial compression P. Timoshenko & Gere §1.11. */
const exactCantileverLateral = (L: number, EI: number, H: number, P: number): number => {
  if (P === 0) return (H * L ** 3) / (3 * EI);
  const k = Math.sqrt(P / EI);
  return (H * (Math.tan(k * L) - k * L)) / (P * k);
};

/** Same cantilever with a tip MOMENT instead of a lateral force: δ = (M0/P)(sec kL − 1). */
const exactCantileverMoment = (L: number, EI: number, M0: number, P: number): number => {
  if (P === 0) return (M0 * L ** 2) / (2 * EI);
  const k = Math.sqrt(P / EI);
  return (M0 / P) * (1 / Math.cos(k * L) - 1);
};

const L = 4;
const I = 8e-5;
const EI = E * I; // 16000 kN·m²
const H = 10;
/** Exact fixed-free Euler load for the continuum, π²EI/(2L)². */
const PCR = (Math.PI ** 2 * EI) / (2 * L) ** 2; // 2467.4011 kN

describe('P-Delta · verificación de las soluciones cerradas de referencia', () => {
  it('cada fórmula cerrada reproduce su propio límite de primer orden', () => {
    // Si la transcripción de la fórmula estuviera mal, este límite fallaría, y
    // ninguna comparación posterior contra el motor tendría valor.
    // `tan(kL) − kL` y `sec(kL) − 1` sufren cancelación catastrófica cuando
    // kL → 0, así que el límite se comprueba con una carga axial pequeña pero
    // no degenerada (0.1 % de Pcr), donde la fórmula sigue siendo estable.
    const tiny = 1e-3 * PCR;
    expect(relError(exactCantileverLateral(L, EI, H, tiny), (H * L ** 3) / (3 * EI))).toBeLessThan(2e-3);
    expect(relError(exactCantileverMoment(L, EI, 20, tiny), (20 * L ** 2) / (2 * EI))).toBeLessThan(2e-3);
  });
});

describe('P-Delta · estudio de discretización (convergencia espacial)', () => {
  // La rigidez geométrica consistente usa interpolación cúbica de Hermite, así
  // que el error debe caer como O(h⁴): al duplicar los elementos el error se
  // divide por ~16. Comprobar el ORDEN es mucho más diagnóstico que cualquier
  // tolerancia absoluta — un signo equivocado o un coeficiente mal puesto no
  // producen una secuencia limpia de cuarto orden.
  const meshes = [1, 2, 4, 8];

  for (const fraction of [0.5, 0.9]) {
    it(`converge con orden ~4 y desde abajo a P/Pcr = ${fraction}`, () => {
      const P = fraction * PCR;
      const exact = exactCantileverLateral(L, EI, H, P);
      const errors = meshes.map((n) => relError(tipUx(withTip(cantileverMesh(L, I, n), -P, H)), exact));

      // El error es de un solo signo: la rigidez geométrica consistente siempre
      // sobre-rigidiza, así que el motor debe quedar SIEMPRE por debajo del
      // valor exacto. Una cota simétrica dejaría pasar una Kg demasiado blanda.
      for (const [index, error] of errors.entries()) {
        expect(error, `n=${meshes[index]}`).toBeLessThanOrEqual(1e-9);
      }
      // Monotonía: refinar siempre acerca.
      for (let index = 1; index < errors.length; index += 1) {
        expect(Math.abs(errors[index])).toBeLessThan(Math.abs(errors[index - 1]));
      }
      // Orden observado entre las dos mallas más finas.
      const order = Math.log2(Math.abs(errors.at(-2)!) / Math.abs(errors.at(-1)!));
      expect(order).toBeGreaterThan(3.4);
      expect(order).toBeLessThan(4.4);
    });
  }

  it('cuantifica el error real de un elemento por miembro, sin ocultarlo', () => {
    // Estas cifras son la limitación documentada, medidas: no son holgura para
    // apretar después. Si alguien las aprieta, la corrección es subdividir el
    // modelo, no reducir el número.
    const cases = [
      { fraction: 0.5, oneElement: 3.5e-3, fourElements: 2.2e-5 },
      { fraction: 0.9, oneElement: 5.7e-2, fourElements: 3.5e-4 },
    ];
    for (const { fraction, oneElement, fourElements } of cases) {
      const P = fraction * PCR;
      const exact = exactCantileverLateral(L, EI, H, P);
      expect(Math.abs(relError(tipUx(withTip(cantileverMesh(L, I, 1), -P, H)), exact))).toBeLessThan(oneElement);
      expect(Math.abs(relError(tipUx(withTip(cantileverMesh(L, I, 4), -P, H)), exact))).toBeLessThan(fourElements);
    }
  });

  it('el factor de carga crítica estimado ronda el valor exacto en toda malla', () => {
    const P = 0.5 * PCR;
    const factorFor = (n: number) => analyzeProjectPDelta(withTip(cantileverMesh(L, I, n), -P, H))!.pDelta!.criticalLoadFactor!;
    // El valor exacto del continuo es 1/0.5 = 2. El factor sale de la relación
    // B₂ = 1/(1 − 1/λ) aplicada a la amplificación, que es la mayor razón por
    // GDL —una rotación amplifica algo distinto que una traslación—, así que
    // no hereda limpiamente el signo del sesgo de discretización: lo que debe
    // cumplirse es que ronde el valor exacto en cualquier malla, no que se
    // acerque monótonamente. La exactitud del DESPLAZAMIENTO frente a la
    // solución cerrada, que sí es monótona, se comprueba en las pruebas de
    // discretización de arriba.
    for (const n of [1, 2, 4, 8]) {
      expect(Math.abs(relError(factorFor(n), 2)), `n=${n}`).toBeLessThan(0.02);
    }
  });
});

describe('P-Delta · benchmarks independientes', () => {
  it('voladizo con momento en el extremo: δ = (M0/P)(sec kL − 1)', () => {
    // Familia de carga distinta a la del benchmark lateral: comprueba que la
    // amplificación no está ajustada a un solo patrón de cargas.
    const M0 = 20;
    const P = 0.5 * PCR;
    const exact = exactCantileverMoment(L, EI, M0, P);
    const project = withTip(cantileverMesh(L, I, 4), -P, 0, M0);
    const result = analyzeProjectPDelta(project, undefined, {
      displacementTolerance: 1e-12, equilibriumTolerance: 1e-12, maxIterationsPerStep: 200,
    });
    expect(result.success).toBe(true);
    const tip = Math.abs(result.nodeResults.find((n) => n.nodeId === project.nodes.at(-1)!.id)!.ux);
    expect(Math.abs(relError(tip, exact))).toBeLessThan(2e-3);
  });

  it('miembro inclinado: la respuesta es invariante bajo rotación del modelo completo', () => {
    // Rotar estructura y cargas por igual es una rotación rígida del problema,
    // así que toda magnitud escalar debe conservarse exactamente. Esto prueba
    // la transformación local↔global de la rigidez geométrica, que un modelo
    // puramente vertical nunca ejercita.
    const P = 0.5 * PCR;
    const build = (angleDeg: number): ProjectModel => {
      const project = baseProject();
      const a = (angleDeg * Math.PI) / 180;
      const [c, s] = [Math.cos(a), Math.sin(a)];
      project.nodes = [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: -s * L, y: c * L, support: { type: 'none' } },
      ];
      project.members = [{ id: 'M1', i: 'A', j: 'B', type: 'frame', E, A: AREA, I }];
      // Lateral H along +X and axial -P along +Y, both rotated by the same R(a).
      project.nodalLoads = [{
        id: 'TIP', nodeId: 'B', caseId: 'LC1',
        fx: c * H - s * -P,
        fy: s * H + c * -P,
        mz: 0,
      }];
      return project;
    };
    const measure = (angleDeg: number) => {
      const result = analyzeProjectPDelta(build(angleDeg), undefined, {
        displacementTolerance: 1e-13, equilibriumTolerance: 1e-13, maxIterationsPerStep: 200,
      });
      expect(result.success, `${angleDeg}°`).toBe(true);
      const tip = result.nodeResults.find((n) => n.nodeId === 'B')!;
      return {
        magnitude: Math.hypot(tip.ux, tip.uy),
        rotation: tip.rz,
        axial: result.pDelta!.memberAxialForces.M1,
      };
    };
    const reference = measure(0);
    for (const angle of [30, 90, 210]) {
      const rotated = measure(angle);
      expect(Math.abs(relError(rotated.magnitude, reference.magnitude)), `|u| @${angle}°`).toBeLessThan(1e-9);
      expect(Math.abs(relError(rotated.rotation, reference.rotation)), `θ @${angle}°`).toBeLessThan(1e-9);
      expect(Math.abs(relError(rotated.axial, reference.axial)), `N @${angle}°`).toBeLessThan(1e-9);
    }
  });

  it('invariancia por traslación del modelo completo', () => {
    const P = 0.4 * PCR;
    const shifted = (dx: number, dy: number) => {
      const project = withTip(cantileverMesh(L, I, 2), -P, H);
      project.nodes = project.nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy }));
      const result = analyzeProjectPDelta(project);
      expect(result.success).toBe(true);
      return Math.abs(result.nodeResults.at(-1)!.ux);
    };
    expect(Math.abs(relError(shifted(137.5, -42.25), shifted(0, 0)))).toBeLessThan(1e-9);
  });
});

describe('P-Delta · asentamientos prescritos', () => {
  /**
   * Un asentamiento absoluto en `support.prescribed` NO se escala con lambda:
   * es una condición de contorno del modelo, no una acción del caso de carga.
   * Lo que debe comprobarse es que el resultado en lambda = 1 sea correcto
   * independientemente de cuántos pasos de carga se usaran para llegar, ya que
   * el escalonamiento es solo una estrategia de continuación.
   */
  const settledFrame = (settlement: number, axial: number): ProjectModel => {
    const project = baseProject();
    project.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 0, y: 3, support: { type: 'none' } },
      { id: 'C', x: 4, y: 3, support: { type: 'none' } },
      { id: 'D', x: 4, y: 0, support: { type: 'fixed', prescribed: { uy: settlement } } },
    ];
    project.members = [
      { id: 'COL1', i: 'A', j: 'B', type: 'frame', E, A: AREA, I: 6e-4 },
      { id: 'BEAM', i: 'B', j: 'C', type: 'frame', E, A: AREA, I: 6e-4 },
      { id: 'COL2', i: 'D', j: 'C', type: 'frame', E, A: AREA, I: 6e-4 },
    ];
    project.nodalLoads = [
      { id: 'V1', nodeId: 'B', caseId: 'LC1', fx: 0, fy: axial, mz: 0 },
      { id: 'V2', nodeId: 'C', caseId: 'LC1', fx: 0, fy: axial, mz: 0 },
      { id: 'W', nodeId: 'B', caseId: 'LC1', fx: 25, fy: 0, mz: 0 },
    ];
    return project;
  };

  it('converge con asentamiento prescrito combinado con carga axial y lateral', () => {
    const result = analyzeProjectPDelta(settledFrame(-0.01, -400));
    expect(result.success).toBe(true);
    expect(result.pDelta?.converged).toBe(true);
    // El asentamiento se impone tal cual: es una condición de contorno.
    expect(result.nodeResults.find((n) => n.nodeId === 'D')!.uy).toBeCloseTo(-0.01, 9);
  });

  it('el resultado final no depende de cuántos pasos de carga se usaron', () => {
    // Un asentamiento absoluto no escala con lambda, así que los estados
    // intermedios NO son una versión proporcional del final. Esto es correcto
    // siempre que el estado en lambda = 1 —el único que se publica— coincida.
    const oneStep = analyzeProjectPDelta(settledFrame(-0.01, -400), undefined, {
      displacementTolerance: 1e-12, equilibriumTolerance: 1e-12, maxIterationsPerStep: 200,
    });
    const manySteps = analyzeProjectPDelta(settledFrame(-0.01, -400), undefined, {
      displacementTolerance: 1e-12, equilibriumTolerance: 1e-12, maxIterationsPerStep: 6,
      stepReductionFactor: 0.5, minimumStep: 1 / 512, maxLoadSteps: 60,
    });
    expect(oneStep.pDelta?.converged).toBe(true);
    expect(manySteps.pDelta?.converged).toBe(true);
    const a = oneStep.nodeResults.find((n) => n.nodeId === 'B')!.ux;
    const b = manySteps.nodeResults.find((n) => n.nodeId === 'B')!.ux;
    expect(Math.abs(relError(b, a))).toBeLessThan(1e-6);
  });

  it('el asentamiento no se amplifica al activar P-Delta', () => {
    const first = analyzeProject(settledFrame(-0.01, -400));
    const second = analyzeProjectPDelta(settledFrame(-0.01, -400));
    expect(first.nodeResults.find((n) => n.nodeId === 'D')!.uy)
      .toBeCloseTo(second.nodeResults.find((n) => n.nodeId === 'D')!.uy, 12);
  });
});

describe('P-Delta · invariancia de unidades del criterio de convergencia', () => {
  it('un modelo rígido y uno flexible convergen con el mismo criterio relativo', () => {
    // Con el piso absoluto anterior (`max(1, ‖u‖)`), el modelo rígido convergía
    // por su escala y no por su precisión. Ahora ambos deben requerir un
    // número comparable de iteraciones para la misma tolerancia relativa.
    const flexible = analyzeProjectPDelta(withTip(cantileverMesh(4, 8e-5, 2), -0.5 * PCR, 10));
    const stiffI = 8e-3;
    const stiffPcr = (Math.PI ** 2 * E * stiffI) / (2 * 4) ** 2;
    const stiff = analyzeProjectPDelta(withTip(cantileverMesh(4, stiffI, 2), -0.5 * stiffPcr, 10));
    expect(flexible.pDelta?.converged).toBe(true);
    expect(stiff.pDelta?.converged).toBe(true);
    // Mismo problema adimensional ⇒ misma amplificación gobernante, aunque en
    // el modelo rígido el acortamiento axial sea 3 órdenes de magnitud mayor
    // que la flecha: la amplificación se mide por GDL, no sobre max|u|.
    expect(Math.abs(relError(stiff.pDelta!.amplificationFactor!, flexible.pDelta!.amplificationFactor!))).toBeLessThan(1e-6);
  });
});

describe('P-Delta · presupuesto de rendimiento', () => {
  /** Pórtico regular de `storeys` niveles y `bays` crujías, con carga gravitatoria y lateral. */
  const multiStoreyFrame = (storeys: number, bays: number): ProjectModel => {
    const project = baseProject();
    const nodes: NodeModel[] = [];
    const members: MemberModel[] = [];
    const height = 3;
    const span = 5;
    for (let y = 0; y <= storeys; y += 1) {
      for (let x = 0; x <= bays; x += 1) {
        nodes.push({ id: `N${x}_${y}`, x: x * span, y: y * height, support: y === 0 ? { type: 'fixed' } : { type: 'none' } });
      }
    }
    for (let y = 1; y <= storeys; y += 1) {
      for (let x = 0; x <= bays; x += 1) members.push({ id: `C${x}_${y}`, i: `N${x}_${y - 1}`, j: `N${x}_${y}`, type: 'frame', E, A: AREA, I: 6e-4 });
      for (let x = 0; x < bays; x += 1) members.push({ id: `B${x}_${y}`, i: `N${x}_${y}`, j: `N${x + 1}_${y}`, type: 'frame', E, A: AREA, I: 6e-4 });
    }
    project.nodes = nodes;
    project.members = members;
    project.nodalLoads = [];
    for (let y = 1; y <= storeys; y += 1) {
      for (let x = 0; x <= bays; x += 1) {
        project.nodalLoads.push({ id: `L${x}_${y}`, nodeId: `N${x}_${y}`, caseId: 'LC1', fx: x === 0 ? 15 : 0, fy: -120, mz: 0 });
      }
    }
    return project;
  };

  it('un pórtico de 10 niveles no cuesta un orden de magnitud más que el primer orden', () => {
    // El coste dominante no es la iteración (converge en 3) sino la estimación
    // del factor de carga crítica. Medido antes de acotarla: 40.6× el primer
    // orden (3.4 s en un pórtico de 77 nodos). Con el cribado analítico previo
    // —que coincide con la bisección dentro del 0.5 %— baja a ~4×, y la
    // bisección solo se paga cerca de la crítica, donde sí importa.
    const project = multiStoreyFrame(10, 6);
    expect(project.nodes.length).toBeGreaterThan(70);

    const firstOrderStart = performance.now();
    const firstOrder = analyzeProject(project);
    const firstOrderMs = performance.now() - firstOrderStart;

    const pDeltaStart = performance.now();
    const second = analyzeProjectPDelta(project);
    const pDeltaMs = performance.now() - pDeltaStart;

    expect(firstOrder.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.pDelta?.converged).toBe(true);
    // Holgado frente a los ~4× medidos, para no volverse inestable en CI, pero
    // muy por debajo del 40× que tenía la versión sin cribado.
    expect(pDeltaMs / Math.max(firstOrderMs, 1)).toBeLessThan(15);
  }, 30_000);
});

describe('P-Delta · detección post-crítica robusta (hallazgos del revisor)', () => {
  const stockyColumn = (fraction: number): ProjectModel => {
    // L/r ≈ 22: una columna corriente, no esbelta. El acortamiento axial es
    // órdenes de magnitud mayor que la flecha, así que cualquier medida sobre
    // el vector completo queda dominada por el GDL que NO pandea.
    const project = baseProject();
    const stockyL = 1;
    const stockyI = 1e-3;
    const stockyA = 0.5;
    const pcr = (Math.PI ** 2 * E * stockyI) / (2 * stockyL) ** 2;
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'N2', x: 0, y: stockyL, support: { type: 'none' } },
    ];
    project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E, A: stockyA, I: stockyI }];
    project.nodalLoads = [{ id: 'AX', nodeId: 'N2', caseId: 'LC1', fx: 10, fy: -fraction * pcr, mz: 0 }];
    return project;
  };

  it('rechaza una columna robusta por encima de la crítica, no solo una esbelta', () => {
    for (const fraction of [1.01, 1.2, 2, 3, 5, 10]) {
      const result = analyzeProjectPDelta(stockyColumn(fraction));
      expect(result.success, `L/r≈22 a ${fraction}·Pcr`).toBe(false);
      expect(result.nodeResults, `L/r≈22 a ${fraction}·Pcr`).toHaveLength(0);
    }
  });

  it('acepta la misma columna robusta por debajo de la crítica', () => {
    const result = analyzeProjectPDelta(stockyColumn(0.5));
    expect(result.success).toBe(true);
    expect(result.pDelta?.converged).toBe(true);
    // La amplificación debe verse pese a que el acortamiento axial domine.
    expect(result.pDelta!.amplificationFactor!).toBeGreaterThan(1.5);
  });

  /** Columna comprimida y un tirante desacoplado con MAYOR |N| en tensión. */
  const compressedPlusLargerTie = (fraction: number): ProjectModel => {
    const project = baseProject();
    const span = 4;
    const inertia = 8e-5;
    const area = 0.01;
    const pcr = (Math.PI ** 2 * E * inertia) / (2 * span) ** 2;
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'N2', x: 0, y: span, support: { type: 'none' } },
      { id: 'T1', x: 20, y: 0, support: { type: 'fixed' } },
      { id: 'T2', x: 20, y: span, support: { type: 'none' } },
    ];
    project.members = [
      { id: 'M1', i: 'N1', j: 'N2', type: 'frame', E, A: area, I: inertia },
      { id: 'TIE', i: 'T1', j: 'T2', type: 'frame', E, A: area, I: inertia },
    ];
    project.nodalLoads = [
      { id: 'AX', nodeId: 'N2', caseId: 'LC1', fx: 10, fy: -fraction * pcr, mz: 0 },
      { id: 'TN', nodeId: 'T2', caseId: 'LC1', fx: 1, fy: 9000, mz: 0 },
    ];
    return project;
  };

  it('un tirante con mayor |N| en tensión no oculta el pandeo de otro miembro', () => {
    // Un criterio que se apoye en «la fuerza axial gobernante» mira el tirante,
    // ve tensión, y deja pasar el estado post-crítico de la columna.
    for (const fraction of [1.2, 3]) {
      const result = analyzeProjectPDelta(compressedPlusLargerTie(fraction));
      expect(result.success, `${fraction}·Pcr con tirante mayor`).toBe(false);
    }
  });

  it('un tirante con mayor |N| en tensión tampoco aborta un análisis válido', () => {
    // El reverso del mismo criterio: la tensión reduce legítimamente la
    // respuesta por debajo del primer orden, lo que un umbral sobre la
    // proyección global leería como pandeo.
    const result = analyzeProjectPDelta(compressedPlusLargerTie(0.02));
    expect(result.success).toBe(true);
    expect(result.pDelta?.converged).toBe(true);
  });

  it('el presupuesto combinado de configuración se valida, no solo cada campo', () => {
    // 200 × 500 = 100 000 resoluciones lineales pasa campo a campo y es
    // inutilizable (≈6 h en un pórtico de 77 nodos).
    const project = stockyColumn(0.5);
    const result = analyzeProjectPDelta(project, undefined, { maxLoadSteps: 200, maxIterationsPerStep: 500 });
    expect(result.success).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'pdelta-invalid-config')).toBe(true);
  });
});
