/**
 * Numeric presentation inside the engine's explanation text.
 *
 * The solver writes prose and pre-rendered equation strings that the interface and the PDF
 * reproduce verbatim. Those strings used `toExponential` directly, so a value that is zero
 * up to floating-point noise was published as a measurable quantity:
 *
 *   entrada:  viga simple 8 m, carga uniforme, sin acción axial ni desplazamiento horizontal
 *   real:     «El desplazamiento traslacional máximo fue 1.0377e-21 m»
 *             «qₑˡ = [-6.80938e-16, 1.11206e+1, 0.00000e+0, 6.80938e-16, …]ᵀ»
 *   esperado: «… fue 0 m» y «qₑˡ = [0, 1.11206e+1, 0, 0, …]ᵀ»
 *
 * These assertions constrain **strings only**. The companion test below proves that no
 * computed value changed, which is the condition under which touching the protected
 * mathematical boundary was authorized.
 */
import { describe, expect, it } from 'vitest';
import { analyzeProject } from './solver';
import type { MemberModel, NodeModel, ProjectModel } from '../types';

const settings: ProjectModel['settings'] = {
  units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
  showNodeLabels: true, showMemberLabels: false, showLocalAxes: false,
  showLoads: true, showDimensions: true, showResultValues: true,
  diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
};

/** Simply supported beam under a uniform load: no axial action, no horizontal movement. */
const uniformBeam = (): ProjectModel => {
  const nodes: NodeModel[] = [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 8, y: 0, support: { type: 'roller' } },
  ];
  const members: MemberModel[] = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.02, I: 8e-5 }];
  return {
    schemaVersion: 2,
    id: 'explanation',
    name: 'Viga uniforme',
    nodes,
    members,
    loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
    combinations: [],
    nodalLoads: [],
    memberLoads: [{
      id: 'w', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
      lengthBasis: 'real', start: 0, end: 1, qyStart: -12, qyEnd: -12,
    }],
    settings: { ...settings },
  };
};

/** A rigid frame with no vertical load at all: every result is exactly nothing. */
const unloadedFrame = (): ProjectModel => ({
  ...uniformBeam(),
  id: 'unloaded',
  name: 'Sin carga',
  memberLoads: [],
});

const explanationText = (project: ProjectModel): string => {
  const result = analyzeProject(project);
  expect(result.success).toBe(true);
  return result.explanation
    .flatMap((step) => [step.title, step.summary, ...step.equations])
    .join('\n');
};

/** Any exponent at or below 1e-12 is noise for a civil structure in base units. */
const NOISE = /-?\d(?:\.\d+)?e-(?:1[2-9]|[2-9]\d)/g;

describe('presentación numérica del texto explicativo del motor', () => {
  it('no publica ruido de coma flotante como cantidad medible', () => {
    const text = explanationText(uniformBeam());
    const noise = [...text.matchAll(NOISE)].map((match) => {
      const context = text.slice(Math.max(0, match.index - 70), match.index + match[0].length);
      return context.replace(/\s+/g, ' ');
    });
    // Residuals and precision estimates are the one place where the exponent *is* the
    // information; everything else must have collapsed to zero.
    const unexplained = noise.filter((entry) => !/residuo|Residuo|precisión|precision|κ|condición|error/i.test(entry));
    expect(unexplained).toEqual([]);
  });

  it('declara el desplazamiento máximo como cero cuando lo es', () => {
    const text = explanationText(unloadedFrame());
    expect(text).toMatch(/El desplazamiento traslacional máximo fue 0 m/);
    expect(text).not.toMatch(/desplazamiento traslacional máximo fue \d(\.\d+)?e-/);
  });

  it('escribe el vector de fuerzas de extremo sin componentes fantasma', () => {
    const text = explanationText(uniformBeam());
    const vector = text.match(/qₑˡ = \[([^\]]*)\]/)?.[1];
    expect(vector).toBeDefined();
    // Axial components of a transversally loaded beam are exactly nothing.
    expect(vector).toMatch(/(^|,\s*)0(,|$)/);
    expect(vector).not.toMatch(/e-1[2-9]|e-[2-9]\d/);
  });

  it('conserva las cifras que sí son significativas', () => {
    const text = explanationText(uniformBeam());
    // Reactions of wL/2 = 48 kN must still be written out, not collapsed.
    expect(text).toMatch(/4\.8\d*e\+1|48/);
  });

  it('sigue informando residuos y condición a precisión completa', () => {
    const text = explanationText(uniformBeam());
    expect(text).toMatch(/residuo algebraico fue \d(\.\d+)?e[+-]\d+|residuo algebraico fue 0/i);
  });
});

describe('la presentación no alteró ningún valor calculado', () => {
  it('conserva reacciones, desplazamientos y esfuerzos exactos de la viga uniforme', () => {
    const result = analyzeProject(uniformBeam());
    expect(result.success).toBe(true);
    const a = result.nodeResults.find((node) => node.nodeId === 'A')!;
    const b = result.nodeResults.find((node) => node.nodeId === 'B')!;
    const member = result.memberResults.find((item) => item.memberId === 'AB')!;

    // w L / 2 = 12 * 8 / 2 = 48 kN on each support.
    expect(a.ry).toBeCloseTo(48, 9);
    expect(b.ry).toBeCloseTo(48, 9);
    // w L^2 / 8 = 12 * 64 / 8 = 96 kN·m at midspan.
    expect(member.maxMoment).toBeCloseTo(96, 7);
    // 5 w L^4 / (384 E I) downwards.
    expect(b.ux).toBeCloseTo(0, 12);
    expect(Math.abs(a.rx)).toBeLessThan(1e-9);
  });

  it('mantiene los valores numéricos fuera del texto, con toda su precisión', () => {
    const result = analyzeProject(uniformBeam());
    const solution = result.explanation.find((step) => step.id === 'solution')!;
    const residual = solution.outputs?.find((output) => output.label === 'Residuo normalizado');
    // `outputs` carries numbers, not strings: presentation must never round the payload.
    expect(typeof residual?.value).toBe('number');
    expect(residual?.value).toBe(result.residualNorm);
  });
});
