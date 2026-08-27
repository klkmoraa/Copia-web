// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { AnalysisResult, MemberModel, MemberResult, ProjectModel } from '../../types';

const material = findStandardMaterial('steel-a992')!;
const section = findStandardSection('w6x9')!;
const designResistance = 0.9 * material.yieldStrength * section.area;

const member: MemberModel = {
  id: 'T1', i: 'N1', j: 'N2', type: 'truss',
  E: material.elasticModulus, A: section.area, I: section.inertiaX,
  materialId: material.id, materialOrigin: 'catalog',
  sectionId: section.id, sectionOrigin: 'catalog',
};

const memberResult = (axial = designResistance / 2): MemberResult => ({
  memberId: 'T1', length: 4,
  localDisplacements: [], localEndForces: [], diagramSegments: [], diagramJumps: [],
  criticalPoints: [], diagram: [], deformation: [], deformationSegments: [], deformationCriticalPoints: [],
  maxAxial: axial, minAxial: 0, maxShear: 0, minShear: 0, maxMoment: 0, minMoment: 0,
} as unknown as MemberResult);

const analysis = (axial = designResistance / 2): AnalysisResult => ({
  success: true, issues: [], nodeResults: [], memberResults: [memberResult(axial)],
  displacements: [], residualNorm: 0, conditionEstimate: 1,
  equilibrium: { sumFx: 0, sumFy: 0, sumM: 0, normalizedComponents: { fx: 0, fy: 0, mz: 0 }, normalizedResidual: 0 },
  explanation: [],
  reliability: { completed: true, usable: true, level: 'reliable', checks: [], reasons: [] },
} as AnalysisResult);

const project: ProjectModel = {
  id: 'P1', name: 'Diseño T1', nodes: [], members: [member], nodalLoads: [], memberLoads: [],
  loadCases: [{ id: 'DL', name: 'Permanente', category: 'permanent', active: true }],
  combinations: [{
    id: 'ULS-NTC', name: 'NTC última', factors: { DL: 1.3 },
    source: 'Gaceta Oficial de la Ciudad de México · NTC 2023',
    sourceUrl: 'https://data.consejeria.cdmx.gob.mx/ntc-2023.pdf',
    jurisdiction: 'Ciudad de México', edition: '2023', stateLimit: 'ultimate',
  }],
  prescribedDisplacements: [], memberInitialEffects: [],
  settings: { units: 'kN-m', language: 'es' },
} as unknown as ProjectModel;

const context = { project, analysis: analysis(), selectedCombinationId: 'ULS-NTC' };
vi.mock('../../store/ProjectContext', () => ({ useProject: () => context }));

afterEach(() => {
  cleanup();
  context.analysis = analysis();
  context.selectedCombinationId = 'ULS-NTC';
  (context.project.settings as { language: 'es' | 'en' }).language = 'es';
});

const renderCard = async () => {
  const { NtcSteelDesignCard } = await import('./NtcSteelDesignCard');
  return render(<NtcSteelDesignCard />);
};

describe('NtcSteelDesignCard', () => {
  it('renders a separate, traceable DesignResult with an incomplete conclusion', async () => {
    const { container } = await renderCard();
    const card = screen.getByTestId('ntc-steel-design-card');
    expect(card.dataset.resultKind).toBe('design');
    expect(card.dataset.status).toBe('incomplete');
    expect(within(card).getByText('Diseño normativo separado')).toBeTruthy();
    expect(within(card).getByText('No concluyente')).toBeTruthy();
    expect(within(card).getByText(/NTC Acero CDMX 2023 · §5\.3\.1\.a/)).toBeTruthy();
    expect(within(card).getByText(/Rt,y = FR · Fy · A/)).toBeTruthy();
    expect(within(card).getByText(/Pu = .* kN/)).toBeTruthy();
    expect(within(card).getByText(/Rt,y = .* kN/)).toBeTruthy();
    expect(card.querySelector('.ntc-design-card__ratio')?.textContent).toBe('Ratio del componente 0.50');
    expect(within(card).getByText(/Fractura de la sección neta no evaluada/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/\bcumple\b/i);
    expect(container.textContent).not.toMatch(/\bsegur[oa]\b/i);
    expect(container.textContent).not.toContain('η');
  });

  it('shows the exceeded component while keeping the global conclusion incomplete', async () => {
    context.analysis = analysis(designResistance * 1.2);
    await renderCard();
    const card = screen.getByTestId('ntc-steel-design-card');
    expect(card.dataset.componentStatus).toBe('outside-component');
    expect(within(card).getByText('Fuera de este componente')).toBeTruthy();
    expect(within(card).getByText('No concluyente')).toBeTruthy();
  });

  it('fails closed without a traceable ultimate combination and publishes no ratio', async () => {
    context.selectedCombinationId = '';
    const { container } = await renderCard();
    const card = screen.getByTestId('ntc-steel-design-card');
    expect(card.dataset.status).toBe('unavailable');
    expect(within(card).getByText('Diseño no disponible')).toBeTruthy();
    expect(within(card).getByText(/Selecciona y analiza una combinación última NTC CDMX 2023/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/Ratio del componente/);
  });

  it('keeps the same contract in English', async () => {
    (context.project.settings as { language: 'es' | 'en' }).language = 'en';
    await renderCard();
    const card = screen.getByTestId('ntc-steel-design-card');
    expect(within(card).getByText('Separate code design')).toBeTruthy();
    expect(within(card).getByText('Inconclusive')).toBeTruthy();
    expect(within(card).getByText(/Net-section fracture was not evaluated/)).toBeTruthy();
  });
});
