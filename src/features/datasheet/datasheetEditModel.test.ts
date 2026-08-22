import { describe, expect, it } from 'vitest';
import { createDatasheetProject } from './datasheetFixtures';
import { datasheetColumns, type DatasheetEntity } from './datasheetModel';
import {
  datasheetColumnField,
  datasheetField,
  datasheetFieldIneligibility,
  datasheetRowField,
} from './datasheetEditModel';

const project = createDatasheetProject();

describe('registro de campos editables', () => {
  const entities: readonly DatasheetEntity[] = ['nodes', 'members', 'loads'];

  it('da campo a toda columna inline y a ninguna cerrada', () => {
    for (const entity of entities) {
      for (const column of datasheetColumns(entity)) {
        const field = datasheetColumnField(entity, column.id);
        if (column.editability === 'inline') expect(field, `${entity}.${column.id}`).toBeDefined();
        else if (column.editability !== 'panel') expect(field, `${entity}.${column.id}`).toBeUndefined();
      }
    }
  });

  it('hereda cantidad y opciones de la edición múltiple en vez de redeclararlas', () => {
    expect(datasheetField('member.E').quantity).toBe('elasticModulus');
    expect(datasheetField('member.type').options).toEqual(['frame', 'truss', 'rigid']);
    expect(datasheetField('node.support.type').options)
      .toEqual(['none', 'pin', 'roller', 'fixed', 'custom']);
  });

  it('declara las dos coordenadas que ningún registro previo tiene', () => {
    expect(datasheetField('node.x')).toMatchObject({ kind: 'number', quantity: 'length' });
    expect(datasheetField('node.y')).toMatchObject({ kind: 'number', quantity: 'length' });
  });

  it('toma las opciones del caso de carga del proyecto, no de una unión fija', () => {
    expect(datasheetField('nodalLoad.caseId').optionsFrom).toBe('loadCases');
    expect(datasheetField('memberLoad.caseId').optionsFrom).toBe('loadCases');
  });

  it('exige positivo donde un cero haría singular la rigidez', () => {
    for (const id of ['member.E', 'member.A', 'member.I'] as const) {
      expect(datasheetField(id).positive, id).toBe(true);
    }
    // Un nudo en x = 0 es perfectamente legítimo.
    expect(datasheetField('node.x').positive).toBeUndefined();
  });

  it('acota las posiciones normalizadas del modelo', () => {
    expect(datasheetField('memberLoad.position')).toMatchObject({ min: 0, max: 1 });
    expect(datasheetField('memberLoad.start')).toMatchObject({ min: 0, max: 1 });
    expect(datasheetField('memberLoad.end')).toMatchObject({ min: 0, max: 1 });
  });

  it('resuelve la columna de caso contra la familia de su fila', () => {
    expect(datasheetRowField('loads', 'case', 'nodalLoad')).toBe('nodalLoad.caseId');
    expect(datasheetRowField('loads', 'case', 'memberLoad')).toBe('memberLoad.caseId');
  });

  it('no traduce un campo de otra familia: la celda está vacía y cerrada', () => {
    expect(datasheetRowField('loads', 'fx', 'nodalLoad')).toBe('nodalLoad.fx');
    expect(datasheetRowField('loads', 'fx', 'memberLoad')).toBeUndefined();
    expect(datasheetRowField('loads', 'qyStart', 'nodalLoad')).toBeUndefined();
    expect(datasheetRowField('loads', 'qyStart', 'memberLoad')).toBe('memberLoad.qyStart');
  });

  it('rechaza un campo fuera de la familia de su carga, con el motivo de bulk-edit', () => {
    const distributed = project.memberLoads[0];
    expect(datasheetFieldIneligibility('memberLoad.qyStart', { kind: 'memberLoad', load: distributed }))
      .toBeUndefined();
    expect(datasheetFieldIneligibility('memberLoad.px', { kind: 'memberLoad', load: distributed }))
      .toBe('load-family');
  });

  it('rechaza un campo de una familia sobre una entidad de otra', () => {
    expect(datasheetFieldIneligibility('member.E', { kind: 'node', node: project.nodes[0] }))
      .toBe('load-family');
  });

  it('rechaza rigidez sobre una barra rígida', () => {
    const rigid = { ...project.members[0], type: 'rigid' as const };
    expect(datasheetFieldIneligibility('member.E', { kind: 'member', member: rigid })).toBe('member-type');
    expect(datasheetFieldIneligibility('member.type', { kind: 'member', member: rigid })).toBeUndefined();
  });

  it('rechaza las restricciones fuera de un apoyo personalizado', () => {
    // N1 es empotrado: sus restricciones las fija el tipo, no tres banderas.
    expect(datasheetFieldIneligibility('node.support.restrainX', { kind: 'node', node: project.nodes[0] }))
      .toBe('support-type');
    const custom = { ...project.nodes[0], support: { type: 'custom' as const } };
    expect(datasheetFieldIneligibility('node.support.restrainX', { kind: 'node', node: custom }))
      .toBeUndefined();
  });

  it('deja las coordenadas siempre elegibles', () => {
    expect(datasheetFieldIneligibility('node.x', { kind: 'node', node: project.nodes[0] })).toBeUndefined();
  });
});
