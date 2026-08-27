import { describe, expect, it } from 'vitest';
import {
  evaluateMemberUtilization,
  resolveUtilizationStatus,
  summarizeStructureDesign,
} from './memberUtilization';
import type { AnalysisResult, MemberModel, MemberResult, ProjectModel } from '../types';

describe('Member and Structure Utilization Engine', () => {
  it('classifies utilization status correctly by ratio threshold', () => {
    expect(resolveUtilizationStatus(0.35)).toBe('safe');
    expect(resolveUtilizationStatus(0.75)).toBe('optimal');
    expect(resolveUtilizationStatus(0.92)).toBe('warning');
    expect(resolveUtilizationStatus(1.05)).toBe('critical');
    expect(resolveUtilizationStatus(-1)).toBe('unavailable');
  });

  const mockMember: MemberModel = {
    id: 'M1',
    i: 'N1',
    j: 'N2',
    type: 'frame',
    E: 200000000,
    A: 0.00589,
    I: 0.0000458,
    materialId: 'steel-a992',
    materialOrigin: 'catalog',
    sectionId: 'w8x31',
    sectionOrigin: 'catalog',
  };

  const mockResult: MemberResult = {
    memberId: 'M1',
    length: 3.5,
    maxAxial: -400, // 400 kN compression
    minAxial: -400,
    maxShear: 50,
    minShear: -50,
    maxMoment: 80,
    minMoment: 0,
    diagram: [],
    deformation: [],
    criticalPoints: [],
    diagramSegments: [],
    diagramJumps: [],
    localDisplacements: [],
    localEndForces: [],
    deformationSegments: [],
    deformationCriticalPoints: [],
  } as unknown as MemberResult;

  const mockAnalysis: AnalysisResult = {
    success: true,
    issues: [],
    nodeResults: [],
    memberResults: [mockResult],
    displacements: [],
    residualNorm: 0,
    conditionEstimate: 1,
    equilibrium: { sumFx: 0, sumFy: 0, sumM: 0, normalizedComponents: { fx: 0, fy: 0, mz: 0 }, normalizedResidual: 0 },
    explanation: [],
    reliability: { completed: true, usable: true, level: 'reliable', checks: [], reasons: [] },
  } as AnalysisResult;

  const mockProject: ProjectModel = {
    id: 'P1',
    name: 'Proyecto Test',
    nodes: [{ id: 'N1', x: 0, y: 0 }, { id: 'N2', x: 0, y: 3.5 }],
    members: [mockMember],
    nodalLoads: [],
    memberLoads: [],
    loadCases: [{ id: 'DL', name: 'Dead Load', category: 'permanent', active: true }],
    combinations: [{ id: 'COMB-1', name: 'Combinación 1', factors: { DL: 1.2 } }],
    prescribedDisplacements: [],
    memberInitialEffects: [],
    settings: { units: 'kN-m', language: 'es' },
  } as unknown as ProjectModel;

  it('evaluates individual member utilization for AISC 360 LRFD', () => {
    const util = evaluateMemberUtilization(mockProject, mockAnalysis, 'COMB-1', 'M1', 'aisc-360-16-lrfd');
    expect(util.evaluated).toBe(true);
    expect(util.checks.length).toBeGreaterThan(1);
    expect(util.governingRatio).toBeGreaterThan(0);
    expect(util.governingCheck).not.toBeNull();
  });

  it('evaluates structure design summary aggregating counts and finding critical members', () => {
    const summary = summarizeStructureDesign(mockProject, mockAnalysis, 'COMB-1', 'aisc-360-16-lrfd');
    expect(summary.totalMembers).toBe(1);
    expect(summary.evaluatedMembers).toBe(1);
    expect(summary.maxRatio).toBeGreaterThan(0);
    expect(summary.governingMemberId).toBe('M1');
  });
});
