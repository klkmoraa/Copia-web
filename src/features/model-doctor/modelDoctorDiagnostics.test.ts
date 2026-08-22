import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { ProjectModel } from '../../types';
import { buildModelDoctorReport } from './modelDoctorDiagnostics';

const clone = <T,>(value: T): T => structuredClone(value);

const topologyProject = (): ProjectModel => {
  const project = createDefaultProject();
  project.nodes = [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
    { id: 'N3', x: 4, y: 0, support: { type: 'fixed' } },
    { id: 'N4', x: 0, y: 0, support: { type: 'none' } },
  ];
  project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', materialOrigin: 'custom', sectionOrigin: 'custom', E: 200e6, A: 0.01, I: 1e-4 }];
  project.nodalLoads = [];
  project.memberLoads = [];
  project.prescribedDisplacements = [{ id: 'PD1', nodeId: 'N3', caseId: 'LC1', component: 'ux', value: 0 }];
  project.memberInitialEffects = [];
  return project;
};

describe('buildModelDoctorReport', () => {
  it('adapts validator output deterministically without mutating the project', () => {
    const project = topologyProject();
    const before = clone(project);

    const first = buildModelDoctorReport(project);
    const second = buildModelDoctorReport(project);

    expect(project).toEqual(before);
    expect(second).toEqual(first);
    expect(first.findings.map((finding) => finding.sourceIssueId)).toEqual(expect.arrayContaining([
      'near-node-N1-N4',
      'node-on-member-N3-M1',
    ]));
    expect(first.counts.critical).toBeGreaterThanOrEqual(1);
    expect(first.counts.warning).toBeGreaterThanOrEqual(1);
    expect(first.total).toBe(first.counts.critical + first.counts.warning + first.counts.suggestion);
  });

  it('classifies required diagnostic families and maps product severity compatibly', () => {
    const project = topologyProject();
    project.members[0].E = 0;
    project.memberLoads.push({
      id: 'ML1', memberId: 'M1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
      lengthBasis: 'real', start: 0.8, end: 0.2, qxStart: 0, qxEnd: 0, qyStart: -2, qyEnd: -2,
    });

    const report = buildModelDoctorReport(project);
    const bySource = new Map(report.findings.map((finding) => [finding.sourceIssueId, finding]));

    expect(bySource.get('E-M1')).toMatchObject({ severity: 'critical', category: 'properties' });
    expect(bySource.get('distributed-domain-ML1')).toMatchObject({ severity: 'critical', category: 'loads' });
    expect(bySource.get('near-node-N1-N4')).toMatchObject({ severity: 'warning', category: 'geometry' });
    expect(bySource.get('node-on-member-N3-M1')).toMatchObject({ severity: 'critical', category: 'topology' });
    expect(bySource.get('near-node-N1-N4')?.whyItMatters).toContain('siguen siendo nodos distintos');
    expect(bySource.get('node-on-member-N3-M1')?.whyItMatters).toContain('sin una unión real');
    expect(bySource.get('E-M1')?.whyItMatters).toContain('rigidez');
    for (const finding of report.findings) {
      expect(finding.explanation.length).toBeGreaterThan(0);
      expect(finding.whyItMatters.length).toBeGreaterThan(0);
      expect(finding.suggestedAction.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ['nodal-node-BROKEN-NL', 'BROKEN-NL', false],
    ['nodal-case-BROKEN-NL', 'BROKEN-NL', false],
    ['member-load-member-BROKEN-ML', 'BROKEN-ML', false],
    ['member-load-case-BROKEN-ML-CASE', 'BROKEN-ML-CASE', true],
  ])('classifies broken load reference %s as references', (sourceIssueId, objectId, canLocate) => {
    const project = topologyProject();
    project.nodalLoads.push({ id: 'BROKEN-NL', nodeId: 'NODE-MISSING', caseId: 'CASE-MISSING', fx: 1, fy: 0, mz: 0 });
    project.memberLoads.push({ id: 'BROKEN-ML', memberId: 'MEMBER-MISSING', caseId: 'CASE-MISSING', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 1, py: 0, position: 0.5 });
    project.memberLoads.push({ id: 'BROKEN-ML-CASE', memberId: 'M1', caseId: 'CASE-MISSING', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 1, py: 0, position: 0.5 });

    const finding = buildModelDoctorReport(project).findings.find((candidate) => candidate.sourceIssueId === sourceIssueId);

    expect(finding).toMatchObject({ category: 'references', canLocate });
    expect(finding?.affectedObjects).toContainEqual({ id: objectId });
    expect(finding?.whyItMatters).toContain('referencia rota');
  });

  it('marks only topology changes accepted by the existing repair as auto-repairable', () => {
    const project = topologyProject();
    project.nodes.push({ id: 'N5', x: 0, y: 0, support: { type: 'fixed' } });
    project.nodes.push({ id: 'N6', x: 0, y: 0, support: { type: 'roller', angleDeg: 90 } });

    const report = buildModelDoctorReport(project);
    const merge = report.findings.find((finding) => finding.sourceIssueId === 'near-node-N1-N4');
    const split = report.findings.find((finding) => finding.sourceIssueId === 'node-on-member-N3-M1');
    const incompatible = report.findings.find((finding) => finding.sourceIssueId === 'near-node-N5-N6');

    expect(merge?.repair).toEqual({ kind: 'topology', available: true });
    expect(split?.repair).toEqual({ kind: 'topology', available: true });
    expect(incompatible?.repair).toEqual({ kind: 'topology', available: false, reason: 'ambiguous' });
  });

  it('marks a node-on-member finding repaired indirectly by a compatible merge', () => {
    const project = topologyProject();
    project.nodes = [
      { id: 'END-I', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'END-J', x: 8, y: 0, support: { type: 'roller', angleDeg: 90 } },
      { id: 'NODE-ACTIVE', x: 4, y: 0, support: { type: 'fixed' } },
      { id: 'NODE-PASSIVE', x: 4, y: 0, support: { type: 'none' } },
    ];
    project.members = [{ id: 'MEMBER-MAIN', i: 'END-I', j: 'END-J', type: 'frame', materialOrigin: 'custom', sectionOrigin: 'custom', E: 200e6, A: 0.01, I: 1e-4 }];
    project.prescribedDisplacements = [];

    const report = buildModelDoctorReport(project);

    expect(report.findings.find((finding) => finding.sourceIssueId === 'node-on-member-NODE-PASSIVE-MEMBER-MAIN')?.repair)
      .toEqual({ kind: 'topology', available: true });
  });

  it('keeps visible IDs unique and stable when the source validator repeats an ID', () => {
    const project = topologyProject();
    project.nodalLoads = [
      { id: 'DUP', nodeId: 'N1', caseId: 'LC1', fx: 1, fy: 0, mz: 0 },
      { id: 'DUP', nodeId: 'N2', caseId: 'LC1', fx: 2, fy: 0, mz: 0 },
      { id: 'DUP', nodeId: 'N3', caseId: 'LC1', fx: 3, fy: 0, mz: 0 },
    ];

    const ids = buildModelDoctorReport(project).findings.map((finding) => finding.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.includes('duplicate-nodal-load-id-DUP'))).toEqual([
      'finding:["duplicate-nodal-load-id-DUP",1]',
      'finding:["duplicate-nodal-load-id-DUP",2]',
    ]);
  });

  it('keeps visible IDs unique when a literal source ID resembles an occurrence suffix', () => {
    const project = createDefaultProject();
    project.members = [];
    project.nodes = [
      { id: 'N', x: 0, y: 0, support: { type: 'none' } },
      { id: 'N', x: 10, y: 0, support: { type: 'none' } },
      { id: 'N::2', x: 20, y: 0, support: { type: 'none' } },
    ];

    const findings = buildModelDoctorReport(project).findings;
    const ids = findings.map((finding) => finding.id);
    const repeatedId = findings.filter((finding) => finding.sourceIssueId === 'isolated-N')[1].id;
    project.nodes = project.nodes.filter((node) => node.id !== 'N::2');

    expect(new Set(ids).size).toBe(ids.length);
    expect(buildModelDoctorReport(project).findings.filter((finding) => finding.sourceIssueId === 'isolated-N')[1].id).toBe(repeatedId);
  });

  it('preserves stable source IDs and affected objects when object IDs contain hyphens', () => {
    const project = topologyProject();
    project.nodes.push({ id: 'NODE-A-1', x: 12, y: 0, support: { type: 'none' } });

    const finding = buildModelDoctorReport(project).findings.find((candidate) => candidate.sourceIssueId === 'isolated-NODE-A-1');

    expect(finding).toMatchObject({ id: 'finding:["isolated-NODE-A-1",1]', category: 'topology' });
    expect(finding?.affectedObjects).toEqual([{ kind: 'node', id: 'NODE-A-1' }]);
  });

  it('allows acknowledgement only for warning and suggestion findings', () => {
    const report = buildModelDoctorReport(topologyProject());

    expect(report.findings.filter((finding) => finding.severity === 'critical').every((finding) => !finding.canAcknowledge)).toBe(true);
    expect(report.findings.filter((finding) => finding.severity !== 'critical').every((finding) => finding.canAcknowledge)).toBe(true);
  });

  it('classifies invalid combination factors and prescribed values by their real contract', () => {
    const project = topologyProject();
    project.combinations = [{ id: 'ULS', name: 'ULS', factors: { LC1: Number.NaN } }];
    project.nodes[0].support = { type: 'pin', prescribed: { ux: Number.NaN } };

    const bySource = new Map(buildModelDoctorReport(project).findings.map((finding) => [finding.sourceIssueId, finding]));

    expect(bySource.get('combination-factor-ULS-LC1')).toMatchObject({ category: 'configuration' });
    expect(bySource.get(`prescribed-${project.nodes[0].id}-ux`)).toMatchObject({ category: 'supports' });
  });

  it('reports the existing safe no-grounding diagnosis before analysis without pretending to locate or repair it', () => {
    const project = createDefaultProject();
    project.nodes = project.nodes.map((node) => ({ ...node, support: { type: 'none' } }));

    const finding = buildModelDoctorReport(project).findings.find((candidate) => candidate.sourceIssueId === 'no-supports');

    expect(finding).toMatchObject({
      severity: 'critical', category: 'supports', target: null, canLocate: false, repair: null, canAcknowledge: false,
    });
    expect(finding?.explanation).toMatch(/restricciones|apoyos/i);
    expect(finding?.whyItMatters).toMatch(/restricci.n|movimiento|apoyo/i);
  });

  it.each([
    ['overlapping member', (project: ProjectModel) => project.members.push({ ...structuredClone(project.members[0]), id: 'M-OVERLAP' }), 'dup-M-OVERLAP', 'warning', 'geometry', true],
    ['zero-length member', (project: ProjectModel) => project.members.push({ ...structuredClone(project.members[0]), id: 'M-ZERO', i: 'N1', j: 'N1' }), 'zero-M-ZERO', 'critical', 'geometry', true],
    ['disconnected support', (project: ProjectModel) => project.nodes.push({ id: 'N-DISCONNECTED', x: 20, y: 20, support: { type: 'fixed' } }), 'isolated-N-DISCONNECTED', 'critical', 'topology', true],
    ['broken member endpoint', (project: ProjectModel) => { project.members[0] = { ...project.members[0], j: 'MISSING' }; }, 'missing-M1', 'critical', 'references', false],
    ['rigid member load', (project: ProjectModel) => {
      project.members.push({ ...structuredClone(project.members[0]), id: 'M-RIGID', type: 'rigid', i: 'N1', j: 'N2' });
      project.memberLoads.push({ id: 'ML-RIGID', memberId: 'M-RIGID', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -1, position: 0.5 });
    }, 'rigid-load-ML-RIGID', 'critical', 'loads', true],
    ['truss member load', (project: ProjectModel) => {
      project.members.push({ ...structuredClone(project.members[0]), id: 'M-TRUSS', type: 'truss', i: 'N1', j: 'N2' });
      project.memberLoads.push({ id: 'ML-TRUSS', memberId: 'M-TRUSS', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -1, position: 0.5 });
    }, 'truss-member-load-ML-TRUSS', 'critical', 'loads', true],
    ['incompatible prescribed displacement', (project: ProjectModel) => {
      project.prescribedDisplacements = [{ id: 'PD-BAD', nodeId: 'N3', caseId: 'LC1', component: 'ux', value: 0.001 }];
    }, 'prescribed-component-PD-BAD', 'critical', 'supports', false],
    ['incompatible initial effect', (project: ProjectModel) => {
      project.members.push({ ...structuredClone(project.members[0]), id: 'M-RIGID', type: 'rigid', i: 'N1', j: 'N2' });
      project.memberInitialEffects = [{ id: 'IE-BAD', memberId: 'M-RIGID', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 20 }];
    }, 'initial-effect-rigid-IE-BAD', 'critical', 'properties', false],
  ] as const)('adapts the minimum acceptance family: %s', (_label, mutate, sourceIssueId, severity, category, canLocate) => {
    const project = createDefaultProject();
    mutate(project);

    const finding = buildModelDoctorReport(project).findings.find((candidate) => candidate.sourceIssueId === sourceIssueId);

    expect(finding).toMatchObject({ sourceIssueId, severity, category, canLocate, repair: null });
    expect(finding?.explanation.length).toBeGreaterThan(0);
    expect(finding?.whyItMatters.length).toBeGreaterThan(0);
    expect(finding?.suggestedAction.length).toBeGreaterThan(0);
  });

  it('keeps missing prescribed displacement targets classified as broken references', () => {
    const project = topologyProject();
    project.prescribedDisplacements = [
      { id: 'PD-NODE', nodeId: 'NODE-MISSING', caseId: 'LC1', component: 'ux', value: 0.001 },
      { id: 'PD-CASE', nodeId: 'N1', caseId: 'CASE-MISSING', component: 'uy', value: 0.001 },
    ];
    const bySource = new Map(buildModelDoctorReport(project).findings.map((finding) => [finding.sourceIssueId, finding]));

    expect(bySource.get('prescribed-node-PD-NODE')).toMatchObject({ category: 'references' });
    expect(bySource.get('prescribed-case-PD-CASE')).toMatchObject({ category: 'references' });
  });
});
