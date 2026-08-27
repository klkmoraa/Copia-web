import { describe, expect, it } from 'vitest';
import { findStandardMaterial } from '../data/standardMaterials';
import { findStandardSection } from '../data/standardSections';
import type { AnalysisResult, MemberModel, MemberResult, ProjectModel } from '../types';
import {
  NTC_STEEL_2023_TENSION_LIBRARY,
  designNtcSteelTensionMember,
  evaluateGrossSectionYielding,
  summarizeNtcSteelTensionDesign,
} from './ntcSteel2023';

const material = findStandardMaterial('steel-a992')!;
const section = findStandardSection('w6x9')!;

const member = (overrides: Partial<MemberModel> = {}): MemberModel => ({
  id: 'T1', i: 'N1', j: 'N2', type: 'truss',
  E: material.elasticModulus, A: section.area, I: section.inertiaX,
  materialId: material.id, materialOrigin: 'catalog',
  sectionId: section.id, sectionOrigin: 'catalog',
  ...overrides,
});

const result = (memberId = 'T1', axial = 100): MemberResult => ({
  memberId, length: 4,
  localDisplacements: [], localEndForces: [], diagramSegments: [], diagramJumps: [],
  criticalPoints: [], diagram: [], deformation: [], deformationSegments: [], deformationCriticalPoints: [],
  maxAxial: axial, minAxial: Math.min(0, axial), maxShear: 0, minShear: 0, maxMoment: 0, minMoment: 0,
} as unknown as MemberResult);

const analysis = (...results: MemberResult[]): AnalysisResult => ({
  success: true, issues: [], nodeResults: [], memberResults: results,
  displacements: [], residualNorm: 0, conditionEstimate: 1,
  equilibrium: { sumFx: 0, sumFy: 0, sumM: 0, normalizedComponents: { fx: 0, fy: 0, mz: 0 }, normalizedResidual: 0 },
  explanation: [],
  reliability: { completed: true, usable: true, level: 'reliable', checks: [], reasons: [] },
} as AnalysisResult);

const project = (members: MemberModel[] = [member()]): ProjectModel => ({
  id: 'P1', name: 'Diseño T1', nodes: [], members, nodalLoads: [], memberLoads: [],
  loadCases: [{ id: 'DL', name: 'Permanente', category: 'permanent', active: true }],
  combinations: [{
    id: 'ULS-NTC', name: 'NTC última', factors: { DL: 1.3 },
    source: 'Gaceta Oficial de la Ciudad de México · NTC 2023',
    sourceUrl: 'https://data.consejeria.cdmx.gob.mx/ntc-2023.pdf',
    jurisdiction: 'Ciudad de México', edition: '2023', stateLimit: 'ultimate',
  }],
  prescribedDisplacements: [], memberInitialEffects: [],
  settings: { units: 'kN-m', language: 'es' },
} as unknown as ProjectModel);

describe('NTC Steel 2023 tension library', () => {
  it('freezes the exact standard, source hash, scope, page, and clause', () => {
    expect(NTC_STEEL_2023_TENSION_LIBRARY).toMatchObject({
      schemaVersion: 1,
      id: 'ntc-cdmx-2023-steel-tension-gross-yielding',
      revision: '2026-08-24.1',
      jurisdiction: 'Ciudad de México',
      edition: '2023',
      check: {
        id: 'gross-section-yielding',
        clause: '5.3.1.a',
        equation: 'Rt,y = FR · Fy · A',
        resistanceFactor: 0.9,
      },
      source: {
        sha256: '293f22316a59ec2ec64d1f64f0749f49ba8849ded15b289cd88cc171c55ae62a',
        pdfPage: 325,
        printedPage: 84,
      },
      scope: { memberType: 'truss', materialId: 'steel-a992', sectionStandard: 'AISC', sectionShapeType: 'I' },
    });
    expect(Object.isFrozen(NTC_STEEL_2023_TENSION_LIBRARY)).toBe(true);
    expect(Object.isFrozen(NTC_STEEL_2023_TENSION_LIBRARY.source)).toBe(true);
  });

  it('reproduces the independent 5380 mm² hand case without invoking analysis', () => {
    const check = evaluateGrossSectionYielding({
      memberId: 'manual', materialId: 'steel-a992', sectionId: 'manual-ipe-300', combinationId: 'manual-uls',
      demand: 835.245, yieldStrength: 345000, grossArea: 0.00538,
    });

    expect(check.resistance.value).toBeCloseTo(1670.49, 9);
    expect(check.ratio.value).toBeCloseTo(0.5, 12);
    expect(check.componentStatus).toBe('within-component');
    expect(check.status).toBe('incomplete');
    expect(check.check).toMatchObject({ clause: '5.3.1.a', equation: 'Rt,y = FR · Fy · A' });
    expect(check.substitutions.map((item) => [item.symbol, item.unit])).toEqual([
      ['Pu', 'kN'], ['FR', '1'], ['Fy', 'kN/m²'], ['A', 'm²'], ['Rt,y', 'kN'],
    ]);
    expect(check.missingChecks).toContain('net-section-fracture');
    expect(check.limitations.join(' ')).toMatch(/no concluye/i);
  });

  it('reports an exceeded component without pretending the member conclusion is complete', () => {
    const check = evaluateGrossSectionYielding({
      memberId: 'manual', materialId: 'steel-a992', sectionId: 'manual-ipe-300', combinationId: 'manual-uls',
      demand: 2000, yieldStrength: 345000, grossArea: 0.00538,
    });
    expect(check.ratio.value).toBeCloseTo(2000 / 1670.49, 12);
    expect(check.componentStatus).toBe('outside-component');
    expect(check.status).toBe('incomplete');
  });

  it('derives a DesignResult from a reliable AnalysisResult without mutating either input', () => {
    const sourceProject = project();
    const sourceAnalysis = analysis(result('T1', 100));
    const beforeProject = JSON.stringify(sourceProject);
    const beforeAnalysis = JSON.stringify(sourceAnalysis);

    const outcome = designNtcSteelTensionMember({
      project: sourceProject, analysis: sourceAnalysis, combinationId: 'ULS-NTC', memberId: 'T1',
    });

    expect(outcome.status).toBe('available');
    if (outcome.status !== 'available') throw new Error('Expected available DesignResult.');
    expect(outcome.result.kind).toBe('design-result');
    expect(outcome.result.generatedFrom).toEqual({
      kind: 'analysis-result', combinationId: 'ULS-NTC', memberResultId: 'T1', demandSelector: 'positive-axial-envelope',
    });
    expect(outcome.result.subject).toEqual({ memberId: 'T1', materialId: 'steel-a992', sectionId: 'w6x9' });
    expect(JSON.stringify(sourceProject)).toBe(beforeProject);
    expect(JSON.stringify(sourceAnalysis)).toBe(beforeAnalysis);
    expect(sourceAnalysis).not.toHaveProperty('designResult');
  });

  it('fails closed instead of inferring identities or accepting a non-ultimate demand', () => {
    const custom = project([member({ materialOrigin: 'custom', sectionOrigin: 'custom' })]);
    const inferred = designNtcSteelTensionMember({
      project: custom, analysis: analysis(result()), combinationId: 'ULS-NTC', memberId: 'T1',
    });
    expect(inferred).toMatchObject({ status: 'unavailable', blockers: ['explicit-catalog-identity-required'] });

    const service = project();
    service.combinations[0] = { ...service.combinations[0], stateLimit: 'service' };
    const wrongCombination = designNtcSteelTensionMember({
      project: service, analysis: analysis(result()), combinationId: 'ULS-NTC', memberId: 'T1',
    });
    expect(wrongCombination).toMatchObject({ status: 'unavailable', blockers: ['ntc-ultimate-combination-required'] });
  });

  it('blocks frame behavior, catalog drift, non-tension, and non-reliable analysis', () => {
    const cases = [
      designNtcSteelTensionMember({ project: project([member({ type: 'frame' })]), analysis: analysis(result()), combinationId: 'ULS-NTC', memberId: 'T1' }),
      designNtcSteelTensionMember({ project: project([member({ A: section.area * 1.01 })]), analysis: analysis(result()), combinationId: 'ULS-NTC', memberId: 'T1' }),
      designNtcSteelTensionMember({ project: project(), analysis: analysis(result('T1', -100)), combinationId: 'ULS-NTC', memberId: 'T1' }),
      designNtcSteelTensionMember({
        project: project(),
        analysis: { ...analysis(result()), reliability: { completed: true, usable: true, level: 'limited', checks: [], reasons: [] } },
        combinationId: 'ULS-NTC', memberId: 'T1',
      }),
    ];
    expect(cases).toEqual([
      { status: 'unavailable', memberId: 'T1', blockers: ['unsupported-member-family'] },
      { status: 'unavailable', memberId: 'T1', blockers: ['catalog-properties-drifted'] },
      { status: 'unavailable', memberId: 'T1', blockers: ['positive-tension-required'] },
      { status: 'unavailable', memberId: 'T1', blockers: ['reliable-analysis-required'] },
    ]);
  });

  it('sorts available DesignResults by ratio and declares partial coverage', () => {
    const secondSection = findStandardSection('w8x10')!;
    const second = member({ id: 'T2', sectionId: secondSection.id, A: secondSection.area, I: secondSection.inertiaX });
    const unsupported = member({ id: 'F1', type: 'frame' });
    const summary = summarizeNtcSteelTensionDesign({
      project: project([member(), second, unsupported]),
      analysis: analysis(result('T1', 100), result('T2', 500), result('F1', 100)),
      combinationId: 'ULS-NTC',
    });

    expect(summary.status).toBe('available');
    if (summary.status !== 'available') throw new Error('Expected design summary.');
    expect(summary.coverage).toBe('partial');
    expect(summary.highest.subject.memberId).toBe('T2');
    expect(summary.results.map((item) => item.subject.memberId)).toEqual(['T2', 'T1']);
    expect(summary.skipped).toEqual([
      { status: 'unavailable', memberId: 'F1', blockers: ['unsupported-member-family'] },
    ]);
    expect(summary.statusConclusion).toBe('incomplete');
  });
});
