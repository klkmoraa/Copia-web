import { describe, expect, it } from 'vitest';
import { applyProjectPatch, compileProjectCommand, projectCommandSnapshot } from '../../commands/projectCommand';
import type { MemberLoad, NodalLoad, ProjectModel } from '../../types';
import { aggregateBulkSelection, findBulkProperty } from './bulkEditAggregation';
import { prepareBulkEdit } from './bulkEditCommand';
import { EMPTY_BULK_DRAFT, stageBulkChange } from './bulkEditIntent';
import type { BulkEditDraft, BulkPropertyId, BulkStagedChange } from './bulkEditTypes';

/**
 * La selección múltiple del modelo sólo transporta nudos y miembros, así que las
 * cargas entran en la edición múltiple como «las cargas de lo seleccionado».
 * Cada familia se trata por separado: un campo de una familia no existe en otra.
 */

const distributed = (id: string, overrides: Partial<MemberLoad> = {}): MemberLoad => ({
  id, memberId: 'M1', caseId: 'LC1', type: 'distributed',
  coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
  qyStart: -10, qyEnd: -10, ...overrides,
});

const point = (id: string, overrides: Partial<MemberLoad> = {}): MemberLoad => ({
  id, memberId: 'M1', caseId: 'LC1', type: 'point',
  coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
  position: 0.5, py: -20, ...overrides,
});

const moment = (id: string, overrides: Partial<MemberLoad> = {}): MemberLoad => ({
  id, memberId: 'M1', caseId: 'LC1', type: 'moment',
  coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1,
  position: 0.5, moment: 8, ...overrides,
});

const nodal = (id: string, overrides: Partial<NodalLoad> = {}): NodalLoad => ({
  id, nodeId: 'N1', caseId: 'LC1', fx: 0, fy: -5, mz: 0, ...overrides,
});

const projectOf = (nodalLoads: NodalLoad[], memberLoads: MemberLoad[]): ProjectModel => ({
  schemaVersion: 1,
  id: 'P1',
  name: 'Bulk',
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{
    id: 'M1', i: 'N1', j: 'N2', type: 'frame',
    E: 200000000, A: 0.005, I: 0.0000833,
  }],
  loadCases: [
    { id: 'LC1', name: 'Permanente', category: 'permanent', active: true },
    { id: 'LC2', name: 'Variable', category: 'variable', active: true },
  ],
  combinations: [],
  nodalLoads,
  memberLoads,
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
    showNodeLabels: true, showMemberLabels: true, showLocalAxes: false, showLoads: true,
    showDimensions: false, showResultValues: true, diagramScale: 1, deformedScale: 1,
    diagramSide: 'positive',
  },
});

const aggregateOf = (project: ProjectModel) => aggregateBulkSelection({
  members: project.members,
  nodes: project.nodes,
  nodalLoads: project.nodalLoads,
  memberLoads: project.memberLoads,
  // El destino de un cambio de caso se acota a los casos que el proyecto declara.
  loadCases: project.loadCases.map((item) => item.id),
});

const apply = (project: ProjectModel, entries: [BulkPropertyId, BulkStagedChange][]) => {
  const aggregate = aggregateOf(project);
  let draft: BulkEditDraft = EMPTY_BULK_DRAFT;
  for (const [id, change] of entries) draft = stageBulkChange(draft, findBulkProperty(aggregate, id), change);
  const prepared = prepareBulkEdit(project, aggregate, draft, 'Editar cargas');
  const compiled = compileProjectCommand(project, prepared.command);
  return { prepared, compiled, next: applyProjectPatch(project, compiled.forward) };
};

describe('bulk load edit', () => {
  it('aggregates each member-load family separately', () => {
    const project = projectOf([], [distributed('ML1'), point('ML2'), moment('ML3')]);
    const aggregate = aggregateOf(project);

    // qy sólo existe en la repartida; py sólo en la puntual.
    expect(findBulkProperty(aggregate, 'memberLoad.qyStart').compatibility.compatible.map((t) => t.id)).toEqual(['ML1']);
    expect(findBulkProperty(aggregate, 'memberLoad.py').compatibility.compatible.map((t) => t.id)).toEqual(['ML2']);
    expect(findBulkProperty(aggregate, 'memberLoad.moment').compatibility.compatible.map((t) => t.id)).toEqual(['ML3']);
  });

  it('gives a family mismatch its own reason', () => {
    const project = projectOf([], [distributed('ML1'), point('ML2')]);
    const aggregate = aggregateOf(project);

    expect(findBulkProperty(aggregate, 'memberLoad.py').compatibility.incompatible
      .filter((entry) => entry.target.kind === 'memberLoad')).toEqual([
      { target: { kind: 'memberLoad', id: 'ML1' }, reason: 'load-family' },
    ]);
  });

  it('never mixes nodal and member loads', () => {
    const project = projectOf([nodal('NL1')], [point('ML1')]);
    const aggregate = aggregateOf(project);

    const nodal_fy = findBulkProperty(aggregate, 'nodalLoad.fy');
    expect(nodal_fy.compatibility.compatible.map((t) => t.id)).toEqual(['NL1']);
    expect(findBulkProperty(aggregate, 'memberLoad.py').compatibility.compatible.map((t) => t.id)).toEqual(['ML1']);
    // Una carga de miembro no entra en el reparto de una propiedad nodal: ni
    // como compatible ni como rechazo. El denominador es la familia nodal.
    expect(nodal_fy.compatibility).toEqual({
      selected: 1,
      compatible: [{ kind: 'nodalLoad', id: 'NL1' }],
      incompatible: [],
    });
  });

  it('edits the magnitude of every compatible load in one command', () => {
    const project = projectOf([], [distributed('ML1'), distributed('ML2', { qyStart: -4, qyEnd: -4 })]);

    const { next } = apply(project, [['memberLoad.qyStart', { kind: 'set', value: -12 }]]);

    expect(next.memberLoads.map((load) => load.qyStart)).toEqual([-12, -12]);
    // qyEnd era mixto y nadie lo tocó.
    expect(next.memberLoads.map((load) => load.qyEnd)).toEqual([-10, -4]);
  });

  it('edits nodal magnitudes without touching the other components', () => {
    const project = projectOf([nodal('NL1', { fx: 3 }), nodal('NL2', { fx: 7 })], []);

    const { next } = apply(project, [['nodalLoad.fy', { kind: 'set', value: -9 }]]);

    expect(next.nodalLoads.map((load) => load.fy)).toEqual([-9, -9]);
    expect(next.nodalLoads.map((load) => load.fx)).toEqual([3, 7]);
  });

  it('moves compatible loads to another load case without merging families', () => {
    const project = projectOf([nodal('NL1')], [point('ML1')]);

    const { next } = apply(project, [['memberLoad.caseId', { kind: 'set', value: 'LC2' }]]);

    expect(next.memberLoads[0].caseId).toBe('LC2');
    // La carga nodal conserva su caso: nadie la tocó.
    expect(next.nodalLoads[0].caseId).toBe('LC1');
  });

  it('refuses a load case the project does not declare', () => {
    const project = projectOf([], [point('ML1')]);
    const aggregate = aggregateOf(project);

    expect(stageBulkChange(
      EMPTY_BULK_DRAFT,
      findBulkProperty(aggregate, 'memberLoad.caseId'),
      { kind: 'set', value: 'LC9' },
    )).toEqual(EMPTY_BULK_DRAFT);
  });

  it('edits the coordinate system only where it is meaningful', () => {
    const project = projectOf([], [distributed('ML1'), moment('ML2')]);
    const aggregate = aggregateOf(project);

    // Un momento no se proyecta sobre ejes: el sistema no lo afecta.
    expect(findBulkProperty(aggregate, 'memberLoad.coordinateSystem').compatibility.compatible.map((t) => t.id))
      .toEqual(['ML1']);
  });

  it('is one reversible patch across families', () => {
    const project = projectOf([nodal('NL1'), nodal('NL2')], [distributed('ML1')]);

    const { compiled, next } = apply(project, [
      ['nodalLoad.fy', { kind: 'set', value: -3 }],
      ['memberLoad.qyStart', { kind: 'set', value: -3 }],
    ]);

    expect(compiled.forward.operations).toHaveLength(3);
    expect(projectCommandSnapshot(applyProjectPatch(next, compiled.inverse)))
      .toBe(projectCommandSnapshot(project));
  });

  it('rejects a prepared load edit once the model moved underneath it', () => {
    const project = projectOf([], [distributed('ML1')]);
    const aggregate = aggregateOf(project);
    const draft = stageBulkChange(
      EMPTY_BULK_DRAFT,
      findBulkProperty(aggregate, 'memberLoad.qyStart'),
      { kind: 'set', value: -1 },
    );
    const prepared = prepareBulkEdit(project, aggregate, draft, 'Editar cargas');

    const moved = structuredClone(project);
    moved.memberLoads[0].qyEnd = -99;

    expect(() => compileProjectCommand(moved, prepared.command)).toThrow(/obsoleta/i);
  });

  it('never writes a field outside the load family', () => {
    const project = projectOf([], [point('ML1')]);

    const { next } = apply(project, [['memberLoad.py', { kind: 'set', value: -50 }]]);

    expect(next.memberLoads[0].py).toBe(-50);
    expect(next.memberLoads[0].qyStart).toBeUndefined();
    expect(next.memberLoads[0].moment).toBeUndefined();
  });
});
