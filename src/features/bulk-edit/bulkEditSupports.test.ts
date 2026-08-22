import { beforeEach, describe, expect, it } from 'vitest';
import { applyProjectPatch, compileProjectCommand, projectCommandSnapshot } from '../../commands/projectCommand';
import type { NodeModel, ProjectModel } from '../../types';
import { aggregateBulkSelection, findBulkProperty } from './bulkEditAggregation';
import { prepareBulkEdit } from './bulkEditCommand';
import { resetBulkFixtureIds } from './bulkEditFixtures';
import { EMPTY_BULK_DRAFT, stageBulkChange } from './bulkEditIntent';
import type { BulkEditDraft, BulkPropertyId, BulkStagedChange } from './bulkEditTypes';

beforeEach(resetBulkFixtureIds);

const projectOf = (nodes: NodeModel[], extra: Partial<ProjectModel> = {}): ProjectModel => ({
  schemaVersion: 1,
  id: 'P1',
  name: 'Bulk',
  nodes,
  members: [],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'permanent', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
    showNodeLabels: true, showMemberLabels: true, showLocalAxes: false, showLoads: true,
    showDimensions: false, showResultValues: true, diagramScale: 1, deformedScale: 1,
    diagramSide: 'positive',
  },
  ...extra,
});

const node = (id: string, support: NodeModel['support'], rest: Partial<NodeModel> = {}): NodeModel =>
  ({ id, x: 0, y: 0, support, ...rest });

const apply = (project: ProjectModel, entries: [BulkPropertyId, BulkStagedChange][]) => {
  const aggregate = aggregateBulkSelection({ members: project.members, nodes: project.nodes });
  let draft: BulkEditDraft = EMPTY_BULK_DRAFT;
  for (const [id, change] of entries) draft = stageBulkChange(draft, findBulkProperty(aggregate, id), change);
  const prepared = prepareBulkEdit(project, aggregate, draft, 'Editar apoyos');
  const compiled = compileProjectCommand(project, prepared.command);
  return { prepared, compiled, next: applyProjectPatch(project, compiled.forward) };
};

describe('bulk support edit', () => {
  it('changes the support type of every selected node', () => {
    const project = projectOf([
      node('N1', { type: 'pin' }),
      node('N2', { type: 'fixed' }),
    ]);

    const { next } = apply(project, [['node.support.type', { kind: 'set', value: 'roller' }]]);

    expect(next.nodes.map((item) => item.support.type)).toEqual(['roller', 'roller']);
  });

  it('produces a coherent support definition instead of inheriting stale fields', () => {
    const project = projectOf([
      node('N1', { type: 'custom', restrainX: true, restrainY: true, restrainR: true, angleDeg: 30 }),
    ]);

    const { next } = apply(project, [['node.support.type', { kind: 'set', value: 'pin' }]]);

    const support = next.nodes[0].support;
    expect(support.type).toBe('pin');
    // Un articulado no guarda banderas de restricción ni normal de rodillo.
    expect(support.restrainX).toBeUndefined();
    expect(support.restrainY).toBeUndefined();
    expect(support.restrainR).toBeUndefined();
    expect(support.angleDeg).toBeUndefined();
  });

  it('gives a roller its normal and a custom support its explicit flags', () => {
    const project = projectOf([node('N1', { type: 'pin' }), node('N2', { type: 'pin' })]);

    const roller = apply(project, [['node.support.type', { kind: 'set', value: 'roller' }]]);
    expect(roller.next.nodes[0].support.angleDeg).toBe(90);

    const custom = apply(project, [['node.support.type', { kind: 'set', value: 'custom' }]]);
    expect(custom.next.nodes[0].support).toMatchObject({
      type: 'custom', restrainX: false, restrainY: false, restrainR: false,
    });
  });

  it('keeps the springs across a support type change', () => {
    const project = projectOf([node('N1', { type: 'pin', spring: { kx: 1000, kr: 25 } })]);

    const { next } = apply(project, [['node.support.type', { kind: 'set', value: 'fixed' }]]);

    expect(next.nodes[0].support.spring).toEqual({ kx: 1000, kr: 25 });
  });

  it('drops prescribed motion the new support type cannot restrain', () => {
    const project = projectOf(
      [node('N1', { type: 'fixed', prescribed: { ux: 0.01, rz: 0.002 } })],
      {
        prescribedDisplacements: [
          { id: 'PD1', nodeId: 'N1', caseId: 'LC1', component: 'rz', value: 0.002 },
          { id: 'PD2', nodeId: 'N1', caseId: 'LC1', component: 'ux', value: 0.01 },
        ],
      },
    );

    const { next } = apply(project, [['node.support.type', { kind: 'set', value: 'pin' }]]);

    // Un articulado no restringe el giro: ese asiento quedaría colgando.
    expect(next.nodes[0].support.prescribed).toBeUndefined();
    expect(next.prescribedDisplacements?.map((item) => item.id)).toEqual(['PD2']);
  });

  it('applies restraint flags only to custom supports and reports the rest', () => {
    const project = projectOf([
      node('N1', { type: 'custom', restrainX: false }),
      node('N2', { type: 'pin' }),
    ]);

    const { prepared, next } = apply(project, [['node.support.restrainX', { kind: 'set', value: true }]]);

    expect(next.nodes[0].support.restrainX).toBe(true);
    expect(next.nodes[1].support).toEqual({ type: 'pin' });
    expect(prepared.affected.map((target) => target.id)).toEqual(['N1']);
    expect(prepared.skipped.map((target) => target.id)).toEqual(['N2']);
  });

  it('never turns an untouched mixed restraint into false', () => {
    const project = projectOf([
      node('N1', { type: 'custom', restrainX: true, restrainY: true }),
      node('N2', { type: 'custom', restrainX: false, restrainY: false }),
    ]);

    const { next } = apply(project, [['node.support.restrainX', { kind: 'set', value: true }]]);

    expect(next.nodes.map((item) => item.support.restrainX)).toEqual([true, true]);
    // Uy era mixto y nadie lo tocó: cada nudo conserva el suyo.
    expect(next.nodes.map((item) => item.support.restrainY)).toEqual([true, false]);
  });

  it('edits the roller angle only where a roller exists', () => {
    const project = projectOf([
      node('N1', { type: 'roller', angleDeg: 90 }),
      node('N2', { type: 'pin' }),
    ]);

    const { next } = apply(project, [['node.support.angleDeg', { kind: 'set', value: 45 }]]);

    expect(next.nodes[0].support.angleDeg).toBe(45);
    expect(next.nodes[1].support.angleDeg).toBeUndefined();
  });

  it('sets the internal hinge on every selected node', () => {
    const project = projectOf([node('N1', { type: 'none' }), node('N2', { type: 'pin' })]);

    const { next } = apply(project, [['node.internalHinge', { kind: 'set', value: true }]]);

    expect(next.nodes.map((item) => item.internalHinge)).toEqual([true, true]);
  });

  it('clears the internal hinge explicitly', () => {
    const project = projectOf([node('N1', { type: 'none' }, { internalHinge: true })]);

    const { next } = apply(project, [['node.internalHinge', { kind: 'clear' }]]);

    expect('internalHinge' in next.nodes[0]).toBe(false);
  });

  it('is one reversible patch over nodes and members together', () => {
    const project = projectOf([node('N1', { type: 'pin' }), node('N2', { type: 'pin' })]);

    const { compiled, next } = apply(project, [['node.support.type', { kind: 'set', value: 'fixed' }]]);

    expect(compiled.forward.operations).toHaveLength(2);
    expect(projectCommandSnapshot(applyProjectPatch(next, compiled.inverse)))
      .toBe(projectCommandSnapshot(project));
  });

  it('rejects a prepared support edit once the model moved underneath it', () => {
    const project = projectOf([node('N1', { type: 'pin' })]);
    const aggregate = aggregateBulkSelection({ members: [], nodes: project.nodes });
    const draft = stageBulkChange(
      EMPTY_BULK_DRAFT,
      findBulkProperty(aggregate, 'node.support.type'),
      { kind: 'set', value: 'fixed' },
    );
    const prepared = prepareBulkEdit(project, aggregate, draft, 'Editar apoyos');

    const moved = structuredClone(project);
    moved.nodes[0].x = 5;

    expect(() => compileProjectCommand(moved, prepared.command)).toThrow(/obsoleta/i);
  });
});
