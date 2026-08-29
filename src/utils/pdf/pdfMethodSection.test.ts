/**
 * Every classical method writes real numbers, not the identity it is named after.
 *
 * Section 5 used to open each method with its governing relation in symbols — `EI y″ = M`,
 * `Δ = Σ nNL/AE`, Clapeyron in letters — and only then reach the figures. Those blocks are
 * gone; what each method now prints is its own arithmetic, carried out on the structure being
 * analysed. This gate walks all eleven methods, on a fixture each one accepts, and requires
 * that the section it writes carries at least one numbered display equation: `(1)` is drawn
 * with real PDF text even though the equation beside it is vector geometry, so it is the one
 * evidence text extraction can give that a worked relation was drawn at all.
 */
import { describe, expect, it } from 'vitest';
import {
  createDefaultProject,
  createHibbelerStyleDiagramPractice,
  createHibbelerStyleTrussPractice,
} from '../../data/defaultProject';
import { analyzeProject } from '../../engine/solver';
import { createCalculationReport } from '../calculationPdf';
import { inspectPdf } from '../pdfImport';
import type { ProjectModel, ProjectSettings } from '../../types';

const FRAME = { type: 'frame' as const, E: 200e6, A: 0.01, I: 8e-5 };

const uniform = (memberId: string, q: number): ProjectModel['memberLoads'][number] => ({
  id: `W-${memberId}`, memberId, caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
  lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: q, qyEnd: q,
});

/** Two equal spans under the same uniform load: what Three Moments and Hardy Cross are taught on. */
const continuousBeam = (): ProjectModel => ({
  ...createHibbelerStyleDiagramPractice(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'C', x: 12, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', ...FRAME }, { id: 'BC', i: 'B', j: 'C', ...FRAME }],
  memberLoads: [uniform('AB', -10), uniform('BC', -10)],
  nodalLoads: [],
});

/** Fixed-pinned: one redundant, which is what Double Integration develops. */
const propppedCantilever = (): ProjectModel => ({
  ...createHibbelerStyleDiagramPractice(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', ...FRAME }],
  nodalLoads: [],
  memberLoads: [uniform('AB', -10)],
});

/** A portal braced against sidesway: the only frame Kani narrates without a sway term. */
const bracedPortal = (): ProjectModel => ({
  ...createHibbelerStyleDiagramPractice(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 6, y: 0, support: { type: 'fixed' } },
    { id: 'C', x: 0, y: 4, support: { type: 'custom', restrainX: true, restrainY: false, restrainR: false } },
    { id: 'D', x: 6, y: 4, support: { type: 'custom', restrainX: true, restrainY: false, restrainR: false } },
  ],
  members: [
    { id: 'AC', i: 'A', j: 'C', ...FRAME },
    { id: 'BD', i: 'B', j: 'D', ...FRAME },
    { id: 'CD', i: 'C', j: 'D', ...FRAME },
  ],
  nodalLoads: [],
  memberLoads: [uniform('CD', -12)],
});

/** Single-bay portal under lateral load: the case both approximate methods are for. */
const lateralPortal = (): ProjectModel => ({
  ...createDefaultProject(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 4, y: 0, support: { type: 'fixed' } },
    { id: 'C', x: 0, y: 3, support: { type: 'none' } },
    { id: 'D', x: 4, y: 3, support: { type: 'none' } },
  ],
  members: [
    { id: 'AC', i: 'A', j: 'C', ...FRAME },
    { id: 'BD', i: 'B', j: 'D', ...FRAME },
    { id: 'CD', i: 'C', j: 'D', ...FRAME },
  ],
  loadCases: [{ id: 'LC1', name: 'Lateral', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [
    { id: 'P1', nodeId: 'C', caseId: 'LC1', fx: 5, fy: 0, mz: 0 },
    { id: 'P2', nodeId: 'D', caseId: 'LC1', fx: 5, fy: 0, mz: 0 },
  ],
  memberLoads: [],
});

/** The practice triangle with a fourth reaction component: one redundant for Castigliano. */
const redundantTruss = (): ProjectModel => ({
  ...createHibbelerStyleTrussPractice(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'C', x: 3, y: 4, support: { type: 'roller', angleDeg: 90 } },
  ],
});

type Method = NonNullable<ProjectSettings['solutionMethod']>;

const cases: Array<[Method, () => ProjectModel, RegExp]> = [
  ['double-integration', propppedCantilever, /Doble Integración/],
  ['conjugate-beam', createHibbelerStyleDiagramPractice, /Viga Conjugada/],
  ['three-moment', continuousBeam, /Tres Momentos/],
  ['hardy-cross', continuousBeam, /Hardy Cross/],
  ['kani-frame', bracedPortal, /Kani/],
  ['virtual-work', createHibbelerStyleTrussPractice, /Trabajo Virtual/],
  ['castigliano-truss', redundantTruss, /Castigliano/],
  ['method-of-joints', createHibbelerStyleTrussPractice, /Método de los Nudos/],
  ['method-of-sections', createHibbelerStyleTrussPractice, /Método de los Cortes/],
  ['portal-method', lateralPortal, /Método del Portal/],
  ['cantilever-method', lateralPortal, /Método del Voladizo/],
];

const report = async (build: () => ProjectModel, method: Method): Promise<string> => {
  const base = build();
  const project: ProjectModel = { ...base, settings: { ...base.settings, solutionMethod: method } };
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  const artifact = await createCalculationReport(project, analysis, { generatedAt: '2026-07-16T12:00:00.000Z' });
  return (await inspectPdf(artifact.bytes)).text.replace(/\s+/g, ' ');
};

describe('sección 5: cada método desarrolla sus propios números', () => {
  for (const [method, build, marker] of cases) {
    it(`${method} escribe su procedimiento y al menos una ecuación numerada`, async () => {
      const text = await report(build, method);
      expect(text).toMatch(marker);
      // The method took over section 5, so the equation counter starts here: a `(1)` inside
      // this document means the method drew a worked relation of its own.
      expect(text).toMatch(/\(1\)/);
      // And the generic procedure never ran in its place.
      expect(text).not.toMatch(/5\. Procedimiento y cálculos/);
    }, 120_000);
  }

  it('el método de los nudos cierra el equilibrio de cada nudo con las fuerzas reales', async () => {
    const text = await report(createHibbelerStyleTrussPractice, 'method-of-joints');
    // Two joints resolved, each with its own pair of sums drawn beneath its table.
    expect(text).toMatch(/Nudo 1: A/);
    expect(text).toMatch(/Nudo 2: B/);
    expect(text).toMatch(/\(3\)/);
  }, 120_000);

  it('el método del portal reparte el cortante de planta con el ancho tributario real', async () => {
    const text = await report(lateralPortal, 'portal-method');
    expect(text).toMatch(/Planta 1: ancho tributario total 4 m/);
    expect(text).toMatch(/Cortante acumulado de cada planta, en kN/);
  }, 120_000);

  it('el método del voladizo comprueba su hipótesis de axial sobre este pórtico', async () => {
    const text = await report(lateralPortal, 'cantilever-method');
    expect(text).toMatch(/la axial dividida por el área y la distancia al centroide da el mismo número/i);
  }, 120_000);
});
