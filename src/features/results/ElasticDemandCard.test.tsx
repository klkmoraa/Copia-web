// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const ipe300 = standardSections.find((section) => section.id === 'ipe-300')!;
const a36 = standardMaterials.find((material) => material.id === 'steel-a36')!;

/**
 * Un miembro con identidad completa y A = 1 m² hace que σ dependa sólo de N,
 * así que η se puede fijar en un valor exacto en binario y comprobarse letra a
 * letra en las tres superficies.
 */
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

/**
 * Caso combinado: con momento, W sí interviene y la tarjeta debe declararlo.
 * El caso puramente axial vive en su propio bloque porque ahí W no participa.
 */
const bendingAnalysis = (): AnalysisResult => ({
  success: true,
  memberResults: [resultFor(a36.yieldStrength / 4, 20)],
  nodeResults: [],
  issues: [],
  displacements: [0],
  reliability: { completed: true, usable: true, level: 'reliable', checks: [], reasons: [] },
} as unknown as AnalysisResult);

/** El check que gobierna un nivel `limited`: es lo que la tarjeta debe citar. */
const governingCheck = {
  id: 'condition' as const,
  label: 'Condición κ₁ del sistema equilibrado',
  value: 4.2e10,
  limitedAbove: 1e10,
  unreliableAbove: 1e12,
  level: 'limited' as const,
  message: 'Condición κ₁ del sistema equilibrado: 4.200e+10 supera 1e+10.',
};

const analysisFor = (axial: number, level: ReliabilityLevel = 'reliable'): AnalysisResult => ({
  success: level !== 'failed',
  memberResults: [resultFor(axial)],
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

/** Dos miembros con resultados propios: sirve para probar cobertura parcial. */
const analysisForPair = (first: number, second: number): AnalysisResult => ({
  success: true,
  memberResults: [
    { ...resultFor(first), memberId: 'B7' },
    { ...resultFor(second), memberId: 'B8' },
  ],
  nodeResults: [],
  issues: [],
  displacements: [0],
  reliability: { completed: true, usable: true, level: 'reliable', checks: [], reasons: [] },
} as unknown as AnalysisResult);

const setSelection = vi.fn();
const context = {
  project: {
    id: 'p', name: 'p', nodes: [], members: [memberOf()], nodalLoads: [], memberLoads: [],
    settings: { units: 'kN-m', language: 'es' },
  } as unknown as ProjectModel,
  analysis: analysisFor(a36.yieldStrength / 2),
  setSelection,
};

vi.mock('../../store/ProjectContext', () => ({ useProject: () => context }));

const renderCard = async () => {
  const { ElasticDemandCard } = await import('./ElasticDemandCard');
  return render(<ElasticDemandCard />);
};

const setMembers = (...members: MemberModel[]) => {
  (context.project as unknown as { members: MemberModel[] }).members = members;
};

afterEach(() => {
  cleanup();
  setSelection.mockClear();
  setMembers(memberOf());
  (context.project.settings as { units: string }).units = 'kN-m';
  (context.project.settings as { language: string }).language = 'es';
  context.analysis = analysisFor(a36.yieldStrength / 2);
});

describe('ElasticDemandCard — available reading', () => {
  it('publishes η as an estimated elastic index against a reference Fy', async () => {
    const { container } = await renderCard();
    expect(screen.getByTestId('elastic-demand-card').dataset.status).toBe('available');
    expect(screen.getByTestId('elastic-index-value').textContent).toBe('η 0.50 · 50 % de Fy de referencia');
    expect(container.textContent).toContain('Índice elástico estimado');
  });

  it('never uses safety, approval or code-check vocabulary', async () => {
    const { container } = await renderCard();
    const copy = container.textContent ?? '';
    for (const forbidden of [/seguro/i, /salud/i, /\bfactor\b/i, /aprobado/i, /\bpasa\b/i, /cumple/i]) {
      expect(copy, forbidden.source).not.toMatch(forbidden);
    }
    // Y sí dice lo que es.
    expect(copy).toMatch(/no es una verificación normativa ni una declaración de seguridad/);
  });

  it('shows the provenance of every published input', async () => {
    context.analysis = bendingAnalysis();
    const { container } = await renderCard();
    const copy = container.textContent ?? '';
    expect(copy).toContain(a36.name);
    expect(copy).toContain(a36.id);
    expect(copy).toContain(ipe300.name);
    expect(copy).toContain(ipe300.id);
    expect(copy).toMatch(/envolvente conservadora/i);
  });

  it('discloses the derivation chain without opening it by default', async () => {
    context.analysis = bendingAnalysis();
    const { container } = await renderCard();
    const disclosure = container.querySelector('details.elastic-how');
    expect(disclosure).not.toBeNull();
    expect((disclosure as HTMLDetailsElement).open).toBe(false);
    expect(within(disclosure as HTMLElement).getByText('N* → A → M* → W → σ* → Fy → η')).toBeTruthy();
  });

  it('locates the governing member on the canvas', async () => {
    await renderCard();
    await userEvent.setup().click(screen.getByTestId('elastic-index-locate'));
    expect(setSelection).toHaveBeenCalledWith({ kind: 'member', id: 'B7' });
  });

  it('keeps the magnitude readable without colour and without lying to ARIA', async () => {
    // η puede superar 1, así que `role="meter"` con aria-valuemax = 100 publicaba
    // un contrato imposible. La barra es decorativa y el valor va en texto.
    context.analysis = analysisFor(a36.yieldStrength * 1.4);
    const { container } = await renderCard();
    expect(container.querySelector('[role="meter"]')).toBeNull();
    const scale = container.querySelector('.elastic-index-scale');
    expect(scale?.getAttribute('aria-hidden')).toBe('true');
    // Sin bandas: por encima de 1 sólo se nombra el hecho físico.
    expect(screen.getByTestId('elastic-at-reference').textContent).toMatch(/alcanza el Fy declarado/);
    for (const band of ['Magnitud baja', 'Magnitud media', 'Magnitud alta']) {
      expect(container.textContent, band).not.toContain(band);
    }
    expect(screen.getByTestId('elastic-index-value').textContent).toBe('η 1.40 · 140 % de Fy de referencia');
  });

  it('has no 0.85 threshold mark left anywhere', async () => {
    const { container } = await renderCard();
    expect(container.innerHTML).not.toContain('85%');
    expect(container.querySelector('.structural-health-mark')).toBeNull();
  });

  it('reads η identically whatever unit system is displayed', async () => {
    const metric = await renderCard();
    const metricRatio = within(metric.container).getByTestId('elastic-index-value').textContent;
    cleanup();
    (context.project.settings as { units: string }).units = 'kip-ft';
    const imperial = await renderCard();
    expect(within(imperial.container).getByTestId('elastic-index-value').textContent).toBe(metricRatio);
  });
});

describe('ElasticDemandCard — unavailable reading', () => {
  it('says exactly which datum is missing instead of inventing Fy', async () => {
    setMembers(memberOf({ materialId: undefined, materialOrigin: 'legacy' }));
    const { container } = await renderCard();
    expect(screen.getByTestId('elastic-demand-card').dataset.status).toBe('unavailable');
    expect(container.textContent).toContain('Índice elástico — No disponible');
    expect(container.textContent).toMatch(/Falta Fy/);
    expect(container.querySelector('[data-testid="elastic-index-value"]')).toBeNull();
    // Y no aparece el 250 MPa de reserva por ninguna parte.
    expect(container.textContent).not.toMatch(/250/);
  });

  it('says exactly which datum is missing instead of deriving W from A and I', async () => {
    // Con flexión real W es obligatorio: la sección sin identidad bloquea η.
    setMembers(memberOf({ sectionId: undefined, sectionOrigin: 'custom' }));
    context.analysis = bendingAnalysis();
    const { container } = await renderCard();
    expect(screen.getByTestId('elastic-demand-card').dataset.status).toBe('unavailable');
    expect(container.textContent).toMatch(/Falta W/);
  });

  it('offers a contextual action that locates the affected member', async () => {
    setMembers(memberOf({ materialId: undefined, materialOrigin: 'legacy' }));
    await renderCard();
    await userEvent.setup().click(screen.getByTestId('elastic-index-action'));
    expect(setSelection).toHaveBeenCalledWith({ kind: 'member', id: 'B7' });
  });

  it('refuses to publish η for an unreliable analysis', async () => {
    context.analysis = analysisFor(a36.yieldStrength / 2, 'unreliable');
    const { container } = await renderCard();
    expect(screen.getByTestId('elastic-demand-card').dataset.status).toBe('unavailable');
    expect(container.textContent).toMatch(/no es confiable/);
    expect(container.querySelector('[data-testid="elastic-index-value"]')).toBeNull();
  });
});

describe('ElasticDemandCard — limited reliability', () => {
  it('publishes a limited analysis marked as limited, never as an ordinary result', async () => {
    context.analysis = analysisFor(a36.yieldStrength / 2, 'limited');
    const { container } = await renderCard();
    const card = screen.getByTestId('elastic-demand-card');
    expect(card.dataset.status).toBe('available');
    expect(card.dataset.confidence).toBe('limited');
    expect(container.textContent).toMatch(/Confiabilidad limitada/);
  });

  it('names the governing check instead of leaving the label unactionable', async () => {
    context.analysis = analysisFor(a36.yieldStrength / 2, 'limited');
    await renderCard();
    const note = screen.getByTestId('elastic-limited-cause');
    expect(note.textContent).toMatch(/Condición numérica del sistema/);
    // La causa se reconstruye desde los campos estructurados, no se copia del
    // motor: ni su etiqueta ni su mensaje internos llegan a la pantalla.
    expect(note.textContent).not.toContain(governingCheck.label);
    expect(note.textContent).not.toContain(governingCheck.message);
  });
});

describe('ElasticDemandCard — unreliable is not limited', () => {
  it('never labels a blocked analysis as limited', async () => {
    context.analysis = analysisFor(a36.yieldStrength / 2, 'unreliable');
    const { container } = await renderCard();
    expect(screen.getByTestId('elastic-demand-card').dataset.status).toBe('unavailable');
    expect(container.textContent).not.toMatch(/Confiabilidad limitada/);
    expect(container.querySelector('[data-testid="elastic-limited-cause"]')).toBeNull();
  });

  it('offers exactly one Model Doctor action, not two', async () => {
    context.analysis = analysisFor(a36.yieldStrength / 2, 'unreliable');
    const { container } = await renderCard();
    const doctorButtons = [...container.querySelectorAll('button')]
      .filter((button) => /Doctor del modelo/.test(button.textContent ?? ''));
    expect(doctorButtons).toHaveLength(1);
  });

  it('still cites what blocks the reading, as a blocker rather than a degradation', async () => {
    context.analysis = analysisFor(a36.yieldStrength / 2, 'unreliable');
    await renderCard();
    const cause = screen.getByTestId('elastic-blocked-cause');
    expect(cause.textContent).toMatch(/Control que lo impide/);
    expect(cause.textContent).toMatch(/Condición numérica del sistema/);
  });
});

describe('ElasticDemandCard — reliability cause follows the active language', () => {
  it('does not leak the engine Spanish prose into an English interface', async () => {
    (context.project.settings as { language: string }).language = 'en';
    context.analysis = analysisFor(a36.yieldStrength / 2, 'limited');
    const { container } = await renderCard();
    const copy = container.textContent ?? '';

    expect(copy).toContain('Numerical condition of the system');
    expect(copy).toContain('Governing check');
    // Nada del texto interno del motor, que siempre viene en español.
    expect(copy).not.toContain(governingCheck.label);
    expect(copy).not.toContain(governingCheck.message);
    expect(copy).not.toContain('supera');
    expect(copy).not.toContain('equilibrado');
  });

  it('does not leak English into a Spanish interface either', async () => {
    context.analysis = analysisFor(a36.yieldStrength / 2, 'limited');
    const { container } = await renderCard();
    const copy = container.textContent ?? '';
    expect(copy).toContain('Condición numérica del sistema');
    expect(copy).not.toContain('Numerical condition');
  });
});

describe('ElasticDemandCard — coverage', () => {
  it('declares complete coverage when every member could be evaluated', async () => {
    await renderCard();
    expect(screen.getByTestId('elastic-demand-card').dataset.coverage).toBe('complete');
    expect(screen.getByTestId('elastic-coverage').textContent).toBe('1 de 1 miembros evaluados');
    expect(screen.getByTestId('elastic-index-scope').textContent).toMatch(/Mayor índice del modelo/);
  });

  it('never calls the highest evaluable member governing when coverage is partial', async () => {
    // B8 es el más exigido del modelo pero no puede leerse: la tarjeta debe
    // decir «mayor entre 1/2 evaluables», no presentar B7 como gobernante.
    setMembers(memberOf(), memberOf({ id: 'B8', materialId: undefined, materialOrigin: 'legacy' }));
    context.analysis = analysisForPair(a36.yieldStrength / 2, a36.yieldStrength * 9);
    const { container } = await renderCard();

    expect(screen.getByTestId('elastic-demand-card').dataset.coverage).toBe('partial');
    expect(screen.getByTestId('elastic-coverage').textContent).toBe('Cobertura parcial · 1 de 2 miembros evaluados');
    const scope = screen.getByTestId('elastic-index-scope').textContent ?? '';
    expect(scope).toContain('1/2');
    expect(scope).toMatch(/podría ser uno de los no evaluados/);
    expect(container.textContent).not.toMatch(/gobernante/i);
    // Y el η publicado sigue siendo el del miembro que sí se pudo leer.
    expect(screen.getByTestId('elastic-index-value').textContent).toBe('η 0.50 · 50 % de Fy de referencia');
  });
});

describe('ElasticDemandCard — purely axial demand', () => {
  it('publishes η with A and Fy alone when there is no bending', async () => {
    setMembers(memberOf({ sectionId: undefined, sectionOrigin: 'custom' }));
    const { container } = await renderCard();
    expect(screen.getByTestId('elastic-demand-card').dataset.status).toBe('available');
    expect(screen.getByTestId('elastic-index-value').textContent).toBe('η 0.50 · 50 % de Fy de referencia');
    expect(container.textContent).toMatch(/Demanda puramente axial/);
    // Y la cadena de derivación omite W en lugar de fingir uno.
    const disclosure = container.querySelector('details.elastic-how');
    expect(within(disclosure as HTMLElement).getByText('N* → A → σ* → Fy → η')).toBeTruthy();
  });
});
