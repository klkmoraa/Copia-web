import { describe, expect, it } from 'vitest';
import { createDatasheetProject } from './datasheetFixtures';
import type { DatasheetFieldId } from './datasheetEditModel';
import { EMPTY_DATASHEET_DRAFT, interpretDatasheetEdits, stageDatasheetEdit } from './datasheetEditDraft';
import { applyDatasheetPlan } from './datasheetEditApply';

const project = createDatasheetProject();

type Entry = readonly [string, DatasheetFieldId, string];

const planFor = (source: typeof project, ...entries: readonly Entry[]) => interpretDatasheetEdits(
  source,
  entries.reduce(
    (draft, [rowId, fieldId, raw]) => stageDatasheetEdit(draft, rowId, fieldId, raw),
    EMPTY_DATASHEET_DRAFT,
  ),
  'kN-m',
);

const planOf = (...entries: readonly Entry[]) => planFor(project, ...entries);

describe('aplicación del plan', () => {
  it('escribe exactamente lo declarado y nada más', () => {
    const next = applyDatasheetPlan(project, planOf(['N2', 'node.x', '2']));
    expect(next.nodes[1].x).toBe(2);
    expect(next.nodes[1].y).toBe(4);
    expect(next.members).toEqual(project.members);
  });

  it('no muta el proyecto de entrada', () => {
    applyDatasheetPlan(project, planOf(['N2', 'node.x', '2']));
    expect(project.nodes[1].x).toBe(0);
  });

  it('un plan con error no escribe nada', () => {
    const next = applyDatasheetPlan(project, planOf(['N2', 'node.x', '2'], ['N3', 'node.y', 'ocho']));
    // Se devuelve por identidad para que el llamador pueda compararlo por
    // referencia: no hay forma de escribir la mitad de un plan.
    expect(next).toBe(project);
  });

  it('cambia el apoyo conservando lo que el tipo nuevo sostiene', () => {
    const next = applyDatasheetPlan(project, planOf(['N1', 'node.support.type', 'roller']));
    // Un rodillo nace con su normal declarada, no con un ángulo indefinido.
    expect(next.nodes[0].support).toMatchObject({ type: 'roller', angleDeg: 90 });
  });

  it('un apoyo personalizado nace con sus tres restricciones declaradas', () => {
    const next = applyDatasheetPlan(project, planOf(['N1', 'node.support.type', 'custom']));
    expect(next.nodes[0].support).toMatchObject({
      type: 'custom', restrainX: false, restrainY: false, restrainR: false,
    });
  });

  it('no arrastra a otro tipo un campo que ese tipo no sostiene', () => {
    // N3 es rodillo con normal a 90°; un empotramiento no tiene normal.
    const next = applyDatasheetPlan(project, planOf(['N3', 'node.support.type', 'fixed']));
    expect(next.nodes[2].support.angleDeg).toBeUndefined();
  });

  it('una identidad de catálogo viaja con sus números', () => {
    const next = applyDatasheetPlan(project, planOf(['M2', 'member.materialId', 'steel-a992']));
    const member = next.members[1];
    expect(member.materialId).toBe('steel-a992');
    expect(member.materialOrigin).toBe('catalog');
    expect(member.E).toBe(200000000);
  });

  it('escribir E a mano degrada el origen a personalizado', () => {
    // E se teclea en las unidades mostradas —MPa en kN-m—, no en kN/m².
    const next = applyDatasheetPlan(project, planOf(['M1', 'member.E', '150000']));
    expect(next.members[0].E).toBe(150000000);
    expect(next.members[0].materialOrigin).toBe('custom');
    expect(next.members[0].materialId).toBeUndefined();
    // Degradar el material no degrada el perfil: son dos identidades distintas.
    expect(next.members[0].sectionOrigin).toBe('catalog');
    expect(next.members[0].sectionId).toBe('w12x26');
  });

  it('escribir A o I a mano degrada la sección y deja el material intacto', () => {
    const next = applyDatasheetPlan(project, planOf(['M1', 'member.A', '0.01']));
    expect(next.members[0].sectionOrigin).toBe('custom');
    expect(next.members[0].sectionId).toBeUndefined();
    expect(next.members[0].materialOrigin).toBe('catalog');
  });

  it('escribe una liberación sin borrar la contraria', () => {
    // Las liberaciones son propias del pórtico, así que la barra tiene que
    // serlo: sobre una armadura el plan queda rechazado por incompatible.
    const framed = createDatasheetProject({
      members: [{ ...project.members[0], releases: { iMoment: true } }],
    });
    const next = applyDatasheetPlan(framed, planFor(framed, ['M1', 'member.releases.jMoment', 'true']));
    expect(next.members[0].releases).toEqual({ iMoment: true, jMoment: true });
  });

  it('no escribe una liberación sobre una barra que no la admite', () => {
    // M2 es armadura: su comportamiento no procede de una rótula de extremo.
    const plan = planOf(['M2', 'member.releases.jMoment', 'true']);
    expect(plan.errors[0].code).toBe('ineligible');
    expect(applyDatasheetPlan(project, plan)).toBe(project);
  });

  it('escribe en la carga nodal por su id y no por su posición', () => {
    const next = applyDatasheetPlan(project, planOf(['NL1', 'nodalLoad.fy', '-9']));
    expect(next.nodalLoads[0].fy).toBe(-9);
    expect(next.nodalLoads[0].fx).toBe(10);
  });

  it('escribe en la carga de barra', () => {
    const next = applyDatasheetPlan(project, planOf(['ML1', 'memberLoad.qyEnd', '-4']));
    expect(next.memberLoads[0].qyEnd).toBe(-4);
    expect(next.memberLoads[0].qyStart).toBe(-12);
  });

  it('mueve una carga de caso', () => {
    const next = applyDatasheetPlan(project, planOf(['NL1', 'nodalLoad.caseId', 'LC2']));
    expect(next.nodalLoads[0].caseId).toBe('LC2');
  });

  it('aplica todo el plan en una sola pasada', () => {
    const next = applyDatasheetPlan(project, planOf(
      ['N2', 'node.x', '1'],
      ['N3', 'node.y', '5'],
      ['M2', 'member.I', '0.0004'],
      ['NL1', 'nodalLoad.caseId', 'LC2'],
    ));
    expect(next.nodes[1].x).toBe(1);
    expect(next.nodes[2].y).toBe(5);
    expect(next.members[1].I).toBe(0.0004);
    expect(next.nodalLoads[0].caseId).toBe('LC2');
  });

  it('no fusiona nudos coincidentes: avisar no es reparar', () => {
    const next = applyDatasheetPlan(project, planOf(['N3', 'node.x', '0']));
    expect(next.nodes).toHaveLength(3);
    expect(next.nodes[2]).toMatchObject({ id: 'N3', x: 0, y: 4 });
  });
});
