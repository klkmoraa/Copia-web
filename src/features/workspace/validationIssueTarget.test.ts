import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { ValidationIssue } from '../../types';
import { resolveValidationIssueTarget } from './validationIssueTarget';

const issue = (objectId: string, objectKind?: ValidationIssue['objectKind'], id = `issue-${objectId}`): ValidationIssue => ({
  id,
  severity: 'error',
  title: 'Diagnóstico',
  message: 'Mensaje',
  objectId,
  objectKind,
});

describe('resolveValidationIssueTarget', () => {
  it.each([
    ['node', 'N1', { kind: 'node', id: 'N1' }],
    ['member', 'M1', { kind: 'member', id: 'M1' }],
    ['nodalLoad', 'NL1', { kind: 'nodalLoad', id: 'NL1' }],
    ['memberLoad', 'ML-LOC', { kind: 'memberLoad', id: 'ML-LOC' }],
  ] as const)('resolves a physically locatable %s', (kind, id, expected) => {
    const project = createDefaultProject();
    project.memberLoads.push({ id: 'ML-LOC', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -1, position: 0.5 });

    expect(resolveValidationIssueTarget(project, issue(id, kind))).toEqual(expected);
  });

  it('infers the kind from existing collections when objectKind is absent', () => {
    const project = createDefaultProject();

    expect(resolveValidationIssueTarget(project, issue('N1', undefined, 'node-coordinate-N1'))).toEqual({ kind: 'node', id: 'N1' });
    expect(resolveValidationIssueTarget(project, issue('M1', undefined, 'E-M1'))).toEqual({ kind: 'member', id: 'M1' });
    expect(resolveValidationIssueTarget(project, issue('NL1', undefined, 'nodal-value-NL1'))).toEqual({ kind: 'nodalLoad', id: 'NL1' });
  });

  it('returns null instead of pretending to locate broken or ambiguous references', () => {
    const project = createDefaultProject();
    project.nodalLoads.push({ id: 'BROKEN-NL', nodeId: 'MISSING', caseId: 'LC1', fx: 1, fy: 0, mz: 0 });
    project.memberLoads.push({ id: 'BROKEN-ML', memberId: 'MISSING', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 1, py: 0, position: 0.5 });

    expect(resolveValidationIssueTarget(project, issue('BROKEN-NL', 'nodalLoad'))).toBeNull();
    expect(resolveValidationIssueTarget(project, issue('BROKEN-ML', 'memberLoad'))).toBeNull();
    expect(resolveValidationIssueTarget(project, issue('MISSING'))).toBeNull();
  });

  it('does not pretend that a repeated object identifier names one physical object', () => {
    const project = createDefaultProject();
    project.nodes.push(structuredClone(project.nodes[0]));
    project.members.push(structuredClone(project.members[0]));
    project.nodalLoads.push(structuredClone(project.nodalLoads[0]));
    project.memberLoads.push(
      { id: 'ML-DUP', memberId: 'M2', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -1, position: 0.5 },
      { id: 'ML-DUP', memberId: 'M2', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -2, position: 0.6 },
    );

    expect(resolveValidationIssueTarget(project, issue('N1', undefined, 'duplicate-node-id-N1'))).toBeNull();
    expect(resolveValidationIssueTarget(project, issue('N1', 'node'))).toBeNull();
    expect(resolveValidationIssueTarget(project, issue('M1', 'member'))).toBeNull();
    expect(resolveValidationIssueTarget(project, issue('NL1', 'nodalLoad'))).toBeNull();
    expect(resolveValidationIssueTarget(project, issue('ML-DUP', 'memberLoad'))).toBeNull();
  });

  it('does not infer a focusable collection for diagnostics owned by non-focusable objects', () => {
    const project = createDefaultProject();
    project.prescribedDisplacements = [{ id: 'N1', nodeId: 'N2', caseId: 'LC1', component: 'ux', value: Number.NaN }];
    project.memberInitialEffects = [{ id: 'M1', memberId: 'M2', caseId: 'LC1', type: 'temperature', alpha: 1e-5, deltaT: Number.NaN }];

    expect(resolveValidationIssueTarget(project, issue('N1', undefined, 'prescribed-value-N1'))).toBeNull();
    expect(resolveValidationIssueTarget(project, issue('M1', undefined, 'initial-effect-M1'))).toBeNull();
  });
});
