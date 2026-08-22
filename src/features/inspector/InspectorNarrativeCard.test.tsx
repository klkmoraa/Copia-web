// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { standardMaterials } from '../../data/standardMaterials';
import { standardSections } from '../../data/standardSections';
import type {
  AnalysisResult,
  MemberModel,
  MemberResult,
  ProjectModel,
  ReliabilityLevel,
} from '../../types';
import { elasticDemandView } from '../results/elasticDemand';

const ipe300 = standardSections.find((section) => section.id === 'ipe-300')!;
const a36 = standardMaterials.find((material) => material.id === 'steel-a36')!;

const memberOf = (overrides: Partial<MemberModel> = {}): MemberModel => ({
  id: 'B7', i: 'N1', j: 'N2', type: 'frame',
  E: a36.elasticModulus, A: 1, I: ipe300.inertiaX,
  materialId: a36.id, materialOrigin: 'catalog',
  sectionId: ipe300.id, sectionOrigin: 'catalog',
  ...overrides,
});

const resultFor = (axial: number, moment = 0): MemberResult => ({
  memberId: 'B7', length: 4,
  localDisplacements: [], localEndForces: [], diagramSegments: [], diagramJumps: [],
  criticalPoints: [], diagram: [], deformation: [], deformationSegments: [], deformationCriticalPoints: [],
  maxAxial: axial, minAxial: 0, maxShear: 0, minShear: 0, maxMoment: moment, minMoment: 0,
} as unknown as MemberResult);

/** El check que gobierna un nivel `limited`: es lo que el panel debe citar. */
const governingCheck = {
  id: 'condition' as const,
  label: 'Condición κ₁ del sistema equilibrado',
  value: 4.2e10,
  limitedAbove: 1e10,
  unreliableAbove: 1e12,
  level: 'limited' as const,
  message: 'Condición κ₁ del sistema equilibrado: 4.200e+10 supera 1e+10.',
};

const analysisFor = (axial: number, level: ReliabilityLevel = 'reliable', moment = 0): AnalysisResult => ({
  success: level !== 'failed',
  memberResults: [resultFor(axial, moment)],
  nodeResults: [],
  issues: [],
  displacements: [0],
  reliability: {
    completed: true,
    usable: level !== 'failed',
    level,
    checks: level === 'reliable' ? [] : [governingCheck],
    governing: level === 'reliable' ? undefined : governingCheck,
    reasons: level === 'reliable' ? [] : [governingCheck.message],
  },
} as unknown as AnalysisResult);

const context = {
  project: {
    id: 'p', name: 'p', nodes: [], members: [memberOf()], nodalLoads: [], memberLoads: [],
    settings: { units: 'kN-m', language: 'es' },
  } as unknown as ProjectModel,
};

vi.mock('../../store/ProjectContext', () => ({ useProject: () => context }));

const renderCard = async (member: MemberModel, analysis: AnalysisResult) => {
  const { InspectorNarrativeCard } = await import('./InspectorNarrativeCard');
  return render(<InspectorNarrativeCard
    member={member}
    result={analysis.memberResults[0]}
    analysis={analysis}
    units="kN-m"
  />);
};

afterEach(cleanup);

describe('InspectorNarrativeCard', () => {
  it('reads exactly the same η the summary publishes for that member', async () => {
    const member = memberOf();
    const analysis = analysisFor(a36.yieldStrength / 2);
    const view = elasticDemandView(
      { ...context.project, members: [member] } as ProjectModel,
      analysis,
    );
    if (view.status !== 'available') throw new Error('esperaba una vista disponible');

    const { container } = await renderCard(member, analysis);
    expect(container.querySelector('[data-testid="inspector-elastic-value"]')?.textContent)
      .toBe('η 0.50 · 50 % de Fy de referencia');
    expect(view.highest.ratio).toBeCloseTo(0.5, 12);
  });

  it('keeps the working-mode narrative and drops the safety verdict', async () => {
    const { container } = await renderCard(memberOf(), analysisFor(a36.yieldStrength / 2));
    const copy = container.textContent ?? '';
    expect(copy).toMatch(/trabaja sobre todo a axil/);
    for (const forbidden of [/seguro/i, /margen elástico cómodo/i, /\bfactor\b/i, /aprobado/i]) {
      expect(copy, forbidden.source).not.toMatch(forbidden);
    }
    expect(copy).toMatch(/no es una verificación normativa ni una declaración de seguridad/);
  });

  it('names the provenance of Fy and W when both take part', async () => {
    const { container } = await renderCard(memberOf(), analysisFor(a36.yieldStrength / 4, 'reliable', 20));
    const copy = container.textContent ?? '';
    expect(copy).toContain(a36.name);
    expect(copy).toContain(ipe300.name);
  });

  it('exposes the magnitude without an impossible meter contract', async () => {
    const { container } = await renderCard(memberOf(), analysisFor(a36.yieldStrength * 1.4));
    expect(container.querySelector('[role="meter"]')).toBeNull();
    expect(container.querySelector('.elastic-index-scale')?.getAttribute('aria-hidden')).toBe('true');
    // Sin bandas: lo único que se nombra por encima de 1 es el hecho físico.
    expect(container.querySelector('[data-testid="inspector-at-reference"]')?.textContent)
      .toMatch(/alcanza el Fy declarado/);
    for (const band of ['Magnitud baja', 'Magnitud media', 'Magnitud alta']) {
      expect(container.textContent, band).not.toContain(band);
    }
    expect(container.innerHTML).not.toContain('85%');
  });

  it('names the governing check behind a limited reliability instead of just labelling it', async () => {
    const { container } = await renderCard(memberOf(), analysisFor(a36.yieldStrength / 2, 'limited'));
    const note = container.querySelector('[data-testid="inspector-limited-cause"]');
    expect(note?.textContent).toMatch(/Confiabilidad limitada/);
    expect(note?.textContent).toMatch(/Condición numérica del sistema/);
    // Reconstruida en el idioma activo, no copiada del motor.
    expect(note?.textContent).not.toContain(governingCheck.label);
    expect(note?.textContent).not.toContain(governingCheck.message);
  });

  it('never labels a blocked analysis as limited', async () => {
    const { container } = await renderCard(memberOf(), analysisFor(a36.yieldStrength / 2, 'unreliable'));
    expect(container.textContent).not.toMatch(/Confiabilidad limitada/);
    expect(container.querySelector('[data-testid="inspector-limited-cause"]')).toBeNull();
    const cause = container.querySelector('[data-testid="inspector-blocked-cause"]');
    expect(cause?.textContent).toMatch(/Control que lo impide/);
  });

  it('follows the active language for the reliability cause', async () => {
    (context.project.settings as { language: string }).language = 'en';
    const { container } = await renderCard(memberOf(), analysisFor(a36.yieldStrength / 2, 'limited'));
    const copy = container.textContent ?? '';
    (context.project.settings as { language: string }).language = 'es';

    expect(copy).toContain('Numerical condition of the system');
    expect(copy).not.toContain(governingCheck.label);
    expect(copy).not.toContain(governingCheck.message);
    expect(copy).not.toContain('supera');
  });

  it('reads a purely axial member without demanding W', async () => {
    const axialOnly = memberOf({ sectionId: undefined, sectionOrigin: 'custom' });
    const { container } = await renderCard(axialOnly, analysisFor(a36.yieldStrength / 2));
    expect(container.querySelector('[data-testid="inspector-elastic-value"]')?.textContent)
      .toBe('η 0.50 · 50 % de Fy de referencia');
    expect(container.textContent).toMatch(/Demanda puramente axial/);
  });

  it('says what is missing instead of assuming a yield strength', async () => {
    const member = memberOf({ materialId: undefined, materialOrigin: 'legacy' });
    const { container } = await renderCard(member, analysisFor(a36.yieldStrength / 2));
    expect(container.textContent).toContain('Índice elástico — No disponible');
    expect(container.textContent).toMatch(/Falta Fy/);
    expect(container.querySelector('[data-testid="inspector-elastic-value"]')).toBeNull();
  });

  it('does not publish η when the analysis is unreliable', async () => {
    const { container } = await renderCard(memberOf(), analysisFor(a36.yieldStrength / 2, 'unreliable'));
    expect(container.textContent).toMatch(/no es confiable/);
    expect(container.querySelector('[data-testid="inspector-elastic-value"]')).toBeNull();
  });

  it('marks a limited analysis as limited', async () => {
    const { container } = await renderCard(memberOf(), analysisFor(a36.yieldStrength / 2, 'limited'));
    expect(container.textContent).toMatch(/Confiabilidad limitada/);
  });
});
