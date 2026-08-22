import { beforeEach, describe, expect, it } from 'vitest';
import { compileProjectCommand } from '../../commands/projectCommand';
import type { MemberModel, NodeModel, ProjectModel } from '../../types';
import { aggregateBulkSelection, findBulkProperty } from './bulkEditAggregation';
import { prepareBulkEdit } from './bulkEditCommand';
import { createBulkMember, createBulkNode, resetBulkFixtureIds } from './bulkEditFixtures';
import { stageBulkChange } from './bulkEditIntent';
import type { BulkEditDraft, BulkPropertyId, BulkSelectionInput, BulkStagedChange } from './bulkEditTypes';

beforeEach(resetBulkFixtureIds);

/**
 * Habilitar y configurar en una sola intención preparada.
 *
 * Antes hacían falta dos pasadas: cambiar el tipo de apoyo, aplicar, volver a
 * abrir el panel y sólo entonces configurar las restricciones que el tipo nuevo
 * había hecho aparecer. La elegibilidad se derivaba del modelo almacenado, de
 * modo que el panel seguía viendo un apoyo que el usuario ya había decidido
 * cambiar.
 *
 * La proyección sólo alcanza a las dos propiedades que **gobiernan** la
 * elegibilidad de otras y cuyo resultado el aplicador construye de forma
 * determinista: `member.type` y `node.support.type`. Ninguna otra se proyecta.
 */
/**
 * Prepara los cambios como lo hace el panel: tras cada uno vuelve a agregar con
 * el borrador acumulado, de modo que una propiedad habilitada por el cambio
 * anterior ya está disponible para el siguiente.
 */
const draftOf = (
  selection: BulkSelectionInput,
  entries: readonly (readonly [BulkPropertyId, BulkStagedChange])[],
): BulkEditDraft => entries.reduce<BulkEditDraft>((draft, [id, change]) => stageBulkChange(
  draft,
  findBulkProperty(aggregateBulkSelection(selection, draft), id),
  change,
), {});

const projectOf = (members: MemberModel[], nodes: NodeModel[]): ProjectModel => ({
  nodes,
  members,
  nodalLoads: [],
  memberLoads: [],
  prescribedDisplacements: [],
  memberInitialEffects: [],
  loadCases: [{ id: 'dead', name: 'Muerta', factor: 1 }],
  loadCombinations: [],
  settings: { units: 'SI' },
} as unknown as ProjectModel);

/** Prepara y ejecuta en una sola confirmación, como hace el panel. */
const applyOnce = (
  project: ProjectModel,
  entries: readonly (readonly [BulkPropertyId, BulkStagedChange])[],
) => {
  const selection = { members: project.members, nodes: project.nodes };
  const draft = draftOf(selection, entries);
  const aggregate = aggregateBulkSelection(selection, draft);
  const prepared = prepareBulkEdit(project, aggregate, draft, 'test');
  return { aggregate, compiled: compileProjectCommand(project, prepared.command) };
};

describe('enable + configure — supports', () => {
  it('offers the custom restraints once the support type is staged as custom', () => {
    const selection = { members: [], nodes: [createBulkNode({ support: { type: 'pin' } })] };
    const stored = aggregateBulkSelection(selection);
    expect(findBulkProperty(stored, 'node.support.restrainX').compatibility.compatible).toEqual([]);

    const draft = draftOf(selection, [['node.support.type', { kind: 'set', value: 'custom' }]]);
    const projected = aggregateBulkSelection(selection, draft);

    const restrainX = findBulkProperty(projected, 'node.support.restrainX');
    expect(restrainX.compatibility.compatible).toHaveLength(1);
    // El apoyo reconstruido nace con las tres banderas explícitas en `false`.
    expect(restrainX.value).toEqual({ state: 'same', value: false });
  });

  it('offers the roller normal once the support type is staged as roller', () => {
    const selection = { members: [], nodes: [createBulkNode({ support: { type: 'pin' } })] };
    const draft = draftOf(selection, [['node.support.type', { kind: 'set', value: 'roller' }]]);
    const projected = aggregateBulkSelection(selection, draft);

    const angle = findBulkProperty(projected, 'node.support.angleDeg');
    expect(angle.compatibility.compatible).toHaveLength(1);
    expect(angle.value).toEqual({ state: 'same', value: 90 });
  });

  it('enables and configures a custom support in a single confirmation', () => {
    const project = projectOf([], [createBulkNode({ support: { type: 'pin' } })]);
    const { compiled } = applyOnce(project, [
      ['node.support.type', { kind: 'set', value: 'custom' }],
      ['node.support.restrainX', { kind: 'set', value: true }],
      ['node.support.restrainR', { kind: 'set', value: true }],
    ]);

    // Una sola operación, un solo parche, un solo undo.
    expect(compiled.command.kind).toBe('selection.bulk.apply');
    expect(compiled.forward.operations).toHaveLength(1);
  });

  it('withdraws a dependent change when the gate that enabled it is withdrawn', () => {
    const selection = { members: [], nodes: [createBulkNode({ support: { type: 'pin' } })] };
    const enabled = draftOf(selection, [['node.support.type', { kind: 'set', value: 'custom' }]]);
    const projected = aggregateBulkSelection(selection, enabled);
    const configured = stageBulkChange(
      enabled,
      findBulkProperty(projected, 'node.support.restrainX'),
      { kind: 'set', value: true },
    );
    expect(configured['node.support.restrainX']).toEqual({ kind: 'set', value: true });

    // Sin la puerta, la restricción vuelve a no tener dónde escribirse: no puede
    // sobrevivir en el borrador esperando a un apoyo que ya nadie va a crear.
    const withoutGate = aggregateBulkSelection(selection, { 'node.support.restrainX': { kind: 'set', value: true } });
    expect(findBulkProperty(withoutGate, 'node.support.restrainX').compatibility.compatible).toEqual([]);
  });
});

describe('enable + configure — members', () => {
  it('offers frame-only properties once the member type is staged as frame', () => {
    const selection = { members: [createBulkMember({ type: 'truss' })], nodes: [] };
    const stored = aggregateBulkSelection(selection);
    expect(findBulkProperty(stored, 'member.releases.iMoment').compatibility.compatible).toEqual([]);

    const draft = draftOf(selection, [['member.type', { kind: 'set', value: 'frame' }]]);
    const projected = aggregateBulkSelection(selection, draft);

    expect(findBulkProperty(projected, 'member.releases.iMoment').compatibility.compatible).toHaveLength(1);
  });

  it('stops offering frame-only properties when the member type is staged away from frame', () => {
    const selection = { members: [createBulkMember({ type: 'frame' })], nodes: [] };
    const draft = draftOf(selection, [['member.type', { kind: 'set', value: 'truss' }]]);
    const projected = aggregateBulkSelection(selection, draft);

    // El aplicador borra los campos exclusivos del pórtico al salir de él, así
    // que ofrecerlos sería prometer una escritura que se descartaría después.
    expect(findBulkProperty(projected, 'member.releases.iMoment').compatibility.compatible).toEqual([]);
  });

  it('converts a truss to a frame and releases it in a single confirmation', () => {
    const project = projectOf(
      [createBulkMember({ type: 'truss' })],
      [createBulkNode({ id: 'N1' }), createBulkNode({ id: 'N2', x: 4 })],
    );
    const { compiled } = applyOnce(project, [
      ['member.type', { kind: 'set', value: 'frame' }],
      ['member.releases.iMoment', { kind: 'set', value: true }],
    ]);

    const member = (compiled.forward.operations[0].after as MemberModel);
    expect(member.type).toBe('frame');
    expect(member.releases).toEqual({ iMoment: true });
    expect(compiled.forward.operations).toHaveLength(1);
  });
});

describe('enable + configure — heterogeneous selections', () => {
  it('keeps a dependent change alive only for the genuinely eligible part when the gate is withdrawn', () => {
    // Un pórtico y una armadura. La puerta hace elegible `beamTheory` para los
    // dos; al retirarla debe sobrevivir sólo para el que ya era pórtico.
    const selection = {
      members: [createBulkMember({ id: 'M1', type: 'frame' }), createBulkMember({ id: 'M2', type: 'truss' })],
      nodes: [],
    };
    const withGate = draftOf(selection, [
      ['member.type', { kind: 'set', value: 'frame' }],
      ['member.beamTheory', { kind: 'set', value: 'timoshenko' }],
    ]);
    expect(findBulkProperty(aggregateBulkSelection(selection, withGate), 'member.beamTheory')
      .compatibility.compatible.map((target) => target.id)).toEqual(['M1', 'M2']);

    const withoutGate: BulkEditDraft = { 'member.beamTheory': withGate['member.beamTheory']! };
    const state = findBulkProperty(aggregateBulkSelection(selection, withoutGate), 'member.beamTheory');

    expect(state.compatibility.compatible.map((target) => target.id)).toEqual(['M1']);
    // La armadura no desaparece del reparto: queda fuera con su motivo.
    expect(state.compatibility.incompatible).toEqual([
      { target: { kind: 'member', id: 'M2' }, reason: 'member-type' },
    ]);
  });

  it('partitions a three-way member selection exactly', () => {
    const project = projectOf(
      [
        createBulkMember({ id: 'M1', type: 'frame' }),
        createBulkMember({ id: 'M2', type: 'truss' }),
        createBulkMember({ id: 'M3', type: 'rigid' }),
      ],
      [createBulkNode({ id: 'N1' }), createBulkNode({ id: 'N2', x: 4 })],
    );
    const selection = { members: project.members, nodes: project.nodes };
    const draft = draftOf(selection, [['member.releases.iMoment', { kind: 'set', value: true }]]);
    const aggregate = aggregateBulkSelection(selection, draft);

    const state = findBulkProperty(aggregate, 'member.releases.iMoment');
    expect(state.compatibility.selected).toBe(3);
    expect(state.compatibility.compatible.map((target) => target.id)).toEqual(['M1']);
    expect(state.compatibility.incompatible.map((entry) => entry.target.id)).toEqual(['M2', 'M3']);

    // Y sólo el pórtico se escribe: la armadura y el rígido salen intactos.
    const prepared = prepareBulkEdit(project, aggregate, draft, 'test');
    const compiled = compileProjectCommand(project, prepared.command);
    expect(compiled.forward.operations).toHaveLength(1);
    expect((compiled.forward.operations[0].after as MemberModel).id).toBe('M1');
  });
});

describe('enable + configure — invariants that must survive', () => {
  it('never writes a property the user did not stage', () => {
    const project = projectOf([], [createBulkNode({ support: { type: 'pin' } })]);
    const { compiled } = applyOnce(project, [
      ['node.support.type', { kind: 'set', value: 'custom' }],
      ['node.support.restrainX', { kind: 'set', value: true }],
    ]);

    const node = compiled.forward.operations[0].after as NodeModel;
    expect(node.support).toEqual({ type: 'custom', restrainX: true, restrainY: false, restrainR: false });
    // `internalHinge` nunca se tocó: sigue sin existir.
    expect(node.internalHinge).toBeUndefined();
  });

  it('still rejects a prepared edit once the model moved underneath it', () => {
    const project = projectOf([], [createBulkNode({ support: { type: 'pin' } })]);
    const selection = { members: [], nodes: project.nodes };
    const draft = draftOf(selection, [['node.support.type', { kind: 'set', value: 'custom' }]]);
    const aggregate = aggregateBulkSelection(selection, draft);
    const prepared = prepareBulkEdit(project, aggregate, draft, 'test');

    const moved: ProjectModel = { ...project, nodes: [{ ...project.nodes[0], x: 99 }] };
    expect(() => compileProjectCommand(moved, prepared.command)).toThrow(/obsoleta/);
  });
});
