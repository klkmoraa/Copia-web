import { describe, expect, it } from 'vitest';
import type { UnitSystemId } from '../../types';
import { createDatasheetProject } from './datasheetFixtures';
import type { DatasheetFieldId } from './datasheetEditModel';
import {
  EMPTY_DATASHEET_DRAFT,
  datasheetDraftCount,
  interpretDatasheetEdits,
  stageDatasheetEdit,
  unstageDatasheetEdit,
} from './datasheetEditDraft';

const project = createDatasheetProject();

type Entry = readonly [string, DatasheetFieldId, string];

const stage = (...entries: readonly Entry[]) => entries.reduce(
  (draft, [rowId, fieldId, raw]) => stageDatasheetEdit(draft, rowId, fieldId, raw),
  EMPTY_DATASHEET_DRAFT,
);

const planOf = (units: UnitSystemId, ...entries: readonly Entry[]) =>
  interpretDatasheetEdits(project, stage(...entries), units);

describe('borrador', () => {
  it('guarda la cadena tal como se teclea, sin interpretarla', () => {
    // Un `1.` a medio escribir no puede convertirse en NaN al guardarse.
    const draft = stage(['N2', 'node.x', '1.']);
    expect(Object.values(draft)).toEqual(['1.']);
  });

  it('cuenta y retira entradas', () => {
    const draft = stage(['N2', 'node.x', '1'], ['N2', 'node.y', '2']);
    expect(datasheetDraftCount(draft)).toBe(2);
    expect(datasheetDraftCount(unstageDatasheetEdit(draft, 'N2', 'node.x'))).toBe(1);
    expect(unstageDatasheetEdit(draft, 'N9', 'node.x')).toBe(draft);
  });
});

describe('interpretación del borrador', () => {
  it('convierte del sistema mostrado a unidades base', () => {
    // 1 ft = 0.3048 m: si el plan guardase 12, el nudo se iría a doce metros.
    const plan = planOf('kip-ft', ['N2', 'node.x', '12']);
    expect(plan.changes).toHaveLength(1);
    expect(plan.changes[0].after).toBeCloseTo(12 * 0.3048, 10);
    expect(plan.applicable).toBe(true);
  });

  it('no convierte lo adimensional', () => {
    expect(planOf('kip-ft', ['ML1', 'memberLoad.end', '0.5']).changes[0].after).toBe(0.5);
  });

  it('descarta el cambio que devuelve el valor original', () => {
    const plan = planOf('kN-m', ['N2', 'node.x', '0']);
    expect(plan.changes).toEqual([]);
    expect(plan.applicable).toBe(false);
  });

  it('lleva el valor anterior para que la revisión no compare formularios', () => {
    expect(planOf('kN-m', ['N2', 'node.y', '5']).changes[0])
      .toMatchObject({ rowId: 'N2', targetKind: 'node', before: 4, after: 5 });
  });

  it('rechaza lo que no es número', () => {
    const plan = planOf('kN-m', ['N2', 'node.x', 'dos']);
    expect(plan.errors).toEqual([{ rowId: 'N2', fieldId: 'node.x', code: 'not-a-number', raw: 'dos' }]);
    expect(plan.applicable).toBe(false);
  });

  it('rechaza rigidez no positiva', () => {
    expect(planOf('kN-m', ['M2', 'member.A', '0']).errors[0].code).toBe('not-positive');
    expect(planOf('kN-m', ['M2', 'member.E', '-1']).errors[0].code).toBe('not-positive');
  });

  it('rechaza una posición fuera de la barra', () => {
    expect(planOf('kN-m', ['ML1', 'memberLoad.end', '1.4']).errors[0].code).toBe('out-of-range');
    expect(planOf('kN-m', ['ML1', 'memberLoad.start', '-0.2']).errors[0].code).toBe('out-of-range');
  });

  it('rechaza una opción que no está en la unión del dominio', () => {
    expect(planOf('kN-m', ['N1', 'node.support.type', 'flotante']).errors[0].code).toBe('unknown-option');
  });

  it('rechaza un caso de carga que el proyecto no declara', () => {
    expect(planOf('kN-m', ['NL1', 'nodalLoad.caseId', 'LC9']).errors[0].code).toBe('unknown-option');
    expect(planOf('kN-m', ['NL1', 'nodalLoad.caseId', 'LC2']).applicable).toBe(true);
  });

  it('rechaza un identificador que el catálogo no reconoce', () => {
    expect(planOf('kN-m', ['M2', 'member.sectionId', 'w999x999']).errors[0].code).toBe('unknown-option');
  });

  it('rechaza un campo fuera de la familia de su carga', () => {
    expect(planOf('kN-m', ['ML1', 'memberLoad.px', '3']).errors[0].code).toBe('ineligible');
  });

  it('rechaza una fila que ya no existe', () => {
    expect(planOf('kN-m', ['N9', 'node.x', '1']).errors[0].code).toBe('unknown-row');
  });

  it('un solo error deja el plan entero sin aplicar', () => {
    const plan = planOf('kN-m', ['N2', 'node.x', '1'], ['N3', 'node.x', 'dos']);
    expect(plan.changes).toHaveLength(1);
    expect(plan.errors).toHaveLength(1);
    expect(plan.applicable).toBe(false);
  });

  it('un booleano acepta las dos formas que teclea el usuario', () => {
    expect(planOf('kN-m', ['N1', 'node.internalHinge', 'true']).changes[0].after).toBe(true);
    expect(planOf('kN-m', ['N2', 'node.internalHinge', 'false']).changes[0].after).toBe(false);
    expect(planOf('kN-m', ['N1', 'node.internalHinge', 'quizá']).errors[0].code).toBe('unknown-option');
  });

  it('avisa de los nudos que quedarían coincidentes sin fusionarlos', () => {
    // N2 está en (0, 4) y N3 en (6, 4): llevar N3 a x = 0 los superpone.
    const plan = planOf('kN-m', ['N3', 'node.x', '0']);
    expect([...plan.coincidentNodeIds].sort()).toEqual(['N2', 'N3']);
    // Avisar no es bloquear: el modelo queda exactamente como se tecleó.
    expect(plan.applicable).toBe(true);
  });

  it('no avisa cuando nada se superpone', () => {
    expect(planOf('kN-m', ['N3', 'node.x', '7']).coincidentNodeIds).toEqual([]);
  });

  it('no avisa cuando el plan no mueve ningún nudo', () => {
    expect(planOf('kN-m', ['M2', 'member.I', '0.0004']).coincidentNodeIds).toEqual([]);
  });

  it('un borrador vacío no es aplicable', () => {
    const plan = interpretDatasheetEdits(project, EMPTY_DATASHEET_DRAFT, 'kN-m');
    expect(plan).toMatchObject({ changes: [], errors: [], applicable: false });
  });
});
