/**
 * Exact, like the other iterative narrator (`hardyCross.ts`): has to land on the solver's own
 * member-end moments, not merely agree in sign. The formula was derived from joint equilibrium
 * in `kaniFrame.ts`'s own header comment — this is where that derivation gets checked against
 * `analyzeProject`, on a frame with no sway term to omit, not assumed correct because it "looks
 * like" a textbook formula.
 *
 * The first version of this fixture relied on mirror symmetry alone (no lateral restraint at the
 * roof) — geometrically sensible, but it turned out to carry a tiny, genuine sideways "breathing"
 * of the beam under its own real (non-rigid) axial stiffness, a few hundredths of a kN·m,
 * invisible until it was measured against the solver. `kaniFrame.ts`'s own residual-based
 * applicability check caught it and declared the frame inapplicable rather than narrate a number
 * a few hundredths of a kN·m off — which is exactly the discipline this fixture now demonstrates
 * directly: an *explicit* horizontal restraint at the roof removes any sideways give at all, and
 * the same frame then matches the solver to machine precision.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleTrussPractice } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import type { ProjectModel } from '../types';
import { solveKaniFrame } from './kaniFrame';

const FRAME = { type: 'frame' as const, E: 200e6, A: 0.01, I: 8e-5 };

/** A closed single-bay portal, roof braced against sidesway, under a symmetric gravity load. */
const bracedPortal = (): ProjectModel => ({
  ...createDefaultProject(),
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
  loadCases: [{ id: 'LC1', name: 'Carga vertical', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [{
    id: 'W', memberId: 'CD', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
    lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -12, qyEnd: -12,
  }],
});

/** The same single-bay portal, unbraced and under a purely lateral load: this one genuinely sways. */
const swayingPortal = (): ProjectModel => ({
  ...createDefaultProject(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 6, y: 0, support: { type: 'fixed' } },
    { id: 'C', x: 0, y: 4, support: { type: 'none' } },
    { id: 'D', x: 6, y: 4, support: { type: 'none' } },
  ],
  members: [
    { id: 'AC', i: 'A', j: 'C', ...FRAME },
    { id: 'BD', i: 'B', j: 'D', ...FRAME },
    { id: 'CD', i: 'C', j: 'D', ...FRAME },
  ],
  loadCases: [{ id: 'LC1', name: 'Lateral', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [{ id: 'P', nodeId: 'C', caseId: 'LC1', fx: 10, fy: 0, mz: 0 }],
  memberLoads: [],
});

describe('solveKaniFrame', () => {
  it('coincide con el solver en cada extremo de barra de un pórtico arriostrado lateralmente', () => {
    const project = bracedPortal();
    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    // Confirma la propia premisa del método: con el arriostramiento, C y D no tienen ningún
    // desplazamiento lateral en absoluto, no sólo uno pequeño.
    const ux = new Map(analysis.nodeResults.map((entry) => [entry.nodeId, entry.ux]));
    expect(ux.get('C')).toBeCloseTo(0, 12);
    expect(ux.get('D')).toBeCloseTo(0, 12);

    const outcome = solveKaniFrame(project, analysis);
    expect(outcome.applicable).toBe(true);
    if (!outcome.applicable) return;

    for (const member of outcome.members) {
      expect(member.finalMomentI).toBeCloseTo(member.solverMomentI, 6);
      expect(member.finalMomentJ).toBeCloseTo(member.solverMomentJ, 6);
    }
    expect(outcome.momentResidual).toBeLessThan(1e-6);
    expect(outcome.iterationCount).toBeGreaterThan(0);

    // Por simetría, las dos columnas llegan al mismo momento en la base, en sentidos opuestos —
    // la pareja de fuerzas que resiste el vuelco de la carga, igual que en el Portal y el Voladizo.
    const baseAC = outcome.members.find((m) => m.memberId === 'AC')!;
    const baseBD = outcome.members.find((m) => m.memberId === 'BD')!;
    expect(baseAC.finalMomentI).toBeCloseTo(-baseBD.finalMomentI, 6);
  });

  it('se declara no aplicable fuera de su alcance', () => {
    const truss = createHibbelerStyleTrussPractice();
    expect(solveKaniFrame(truss, analyzeProject(truss)).applicable).toBe(false);

    const sway = swayingPortal();
    const swayAnalysis = analyzeProject(sway);
    expect(swayAnalysis.success).toBe(true);
    const swayOutcome = solveKaniFrame(sway, swayAnalysis);
    expect(swayOutcome.applicable).toBe(false);
    if (swayOutcome.applicable) return;
    expect(swayOutcome.reasonKey).toBe('method.rejectedSidesway');

    // La misma prueba de simetría-sin-arriostrar de antes: geométricamente parece no bambolear,
    // pero la rigidez axial real de la viga permite un ligero desplazamiento lateral que la
    // fórmula sin término de bamboleo no puede reproducir con exactitud — así que se retira, en
    // vez de narrar un número unas centésimas de kN·m equivocado.
    const unbraced: ProjectModel = {
      ...bracedPortal(),
      nodes: [
        { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
        { id: 'B', x: 6, y: 0, support: { type: 'fixed' } },
        { id: 'C', x: 0, y: 4, support: { type: 'none' } },
        { id: 'D', x: 6, y: 4, support: { type: 'none' } },
      ],
    };
    const unbracedAnalysis = analyzeProject(unbraced);
    expect(unbracedAnalysis.success).toBe(true);
    const unbracedOutcome = solveKaniFrame(unbraced, unbracedAnalysis);
    expect(unbracedOutcome.applicable).toBe(false);
    if (unbracedOutcome.applicable) return;
    expect(unbracedOutcome.reasonKey).toBe('method.rejectedSidesway');

    const hinged = bracedPortal();
    hinged.nodes = hinged.nodes.map((node) => (node.id === 'C' ? { ...node, internalHinge: true } : node));
    const hingedAnalysis = analyzeProject(hinged);
    expect(hingedAnalysis.success).toBe(true);
    const hingedOutcome = solveKaniFrame(hinged, hingedAnalysis);
    expect(hingedOutcome.applicable).toBe(false);
    if (hingedOutcome.applicable) return;
    expect(hingedOutcome.reasonKey).toBe('method.rejectedContinuityRequired');
  });
});
