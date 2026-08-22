import { describe, expect, it } from 'vitest';
import { createDatasheetProject } from './datasheetFixtures';
import { datasheetColumns, projectDatasheetRows } from './datasheetModel';
import { mapPasteToEdits, parseClipboardGrid } from './datasheetPaste';

const project = createDatasheetProject();
const rows = projectDatasheetRows(project, 'nodes');
const columns = datasheetColumns('nodes');

describe('lectura del portapapeles', () => {
  it('parte por tabulador y por salto de línea', () => {
    expect(parseClipboardGrid('1\t2\n3\t4')).toEqual([['1', '2'], ['3', '4']]);
  });

  it('acepta el salto de línea de Windows', () => {
    expect(parseClipboardGrid('1\t2\r\n3\t4')).toEqual([['1', '2'], ['3', '4']]);
  });

  it('descarta la línea final vacía que añade toda hoja de cálculo', () => {
    expect(parseClipboardGrid('1\t2\n')).toEqual([['1', '2']]);
  });

  it('trata una celda sola como un bloque de uno', () => {
    expect(parseClipboardGrid('7')).toEqual([['7']]);
  });

  it('no inventa un bloque a partir de nada', () => {
    expect(parseClipboardGrid('')).toEqual([]);
    expect(parseClipboardGrid('\n')).toEqual([]);
  });
});

describe('anclaje del bloque', () => {
  // Columnas de nudos: 0 id · 1 x · 2 y · 3 apoyo · 4 restricciones · 5 rótula · 6 cargas
  it('ancla en la celda enfocada y se extiende abajo y a la derecha', () => {
    const result = mapPasteToEdits({
      block: [['1', '2'], ['3', '4']],
      rows,
      columns,
      entity: 'nodes',
      anchor: { row: 0, column: 1 },
    });
    expect(result.edits).toEqual([
      { rowId: 'N1', fieldId: 'node.x', raw: '1' },
      { rowId: 'N1', fieldId: 'node.y', raw: '2' },
      { rowId: 'N2', fieldId: 'node.x', raw: '3' },
      { rowId: 'N2', fieldId: 'node.y', raw: '4' },
    ]);
    expect(result.droppedOutside).toBe(0);
    expect(result.droppedReadOnly).toBe(0);
  });

  it('cuenta lo que cae fuera de la tabla en vez de recortarlo en silencio', () => {
    const result = mapPasteToEdits({
      block: [['1'], ['2'], ['3'], ['4']],
      rows,
      columns,
      entity: 'nodes',
      anchor: { row: 2, column: 1 },
    });
    expect(result.edits).toEqual([{ rowId: 'N3', fieldId: 'node.x', raw: '1' }]);
    expect(result.droppedOutside).toBe(3);
  });

  it('cuenta lo que se sale por la derecha', () => {
    const result = mapPasteToEdits({
      block: [['1', '2', '3']],
      rows,
      columns,
      entity: 'nodes',
      anchor: { row: 0, column: columns.length - 1 },
    });
    expect(result.droppedOutside).toBe(2);
  });

  it('cuenta lo que cae sobre una columna que no se edita', () => {
    // La columna 0 es el id, que es identidad y nunca se escribe.
    const result = mapPasteToEdits({
      block: [['X1', '9']],
      rows,
      columns,
      entity: 'nodes',
      anchor: { row: 0, column: 0 },
    });
    expect(result.edits).toEqual([{ rowId: 'N1', fieldId: 'node.x', raw: '9' }]);
    expect(result.droppedReadOnly).toBe(1);
  });

  it('cuenta lo que cae sobre una columna derivada', () => {
    // La columna 4 es Restricciones, que se calcula del apoyo.
    const result = mapPasteToEdits({
      block: [['X Y']],
      rows,
      columns,
      entity: 'nodes',
      anchor: { row: 0, column: 4 },
    });
    expect(result.edits).toEqual([]);
    expect(result.droppedReadOnly).toBe(1);
  });

  it('salta las celdas de otra familia en la tabla de cargas', () => {
    const loadRows = projectDatasheetRows(project, 'loads');
    const loadColumns = datasheetColumns('loads');
    const fxIndex = loadColumns.findIndex((column) => column.id === 'fx');
    const result = mapPasteToEdits({
      block: [['5'], ['6']],
      rows: loadRows,
      columns: loadColumns,
      entity: 'loads',
      anchor: { row: 0, column: fxIndex },
    });
    // NL1 es nodal y acepta Fx; ML1 es repartida y no tiene dónde escribirlo.
    expect(result.edits).toEqual([{ rowId: 'NL1', fieldId: 'nodalLoad.fx', raw: '5' }]);
    expect(result.droppedReadOnly).toBe(1);
  });

  it('resuelve el caso contra la familia de cada fila', () => {
    const loadRows = projectDatasheetRows(project, 'loads');
    const loadColumns = datasheetColumns('loads');
    const caseIndex = loadColumns.findIndex((column) => column.id === 'case');
    const result = mapPasteToEdits({
      block: [['LC2'], ['LC2']],
      rows: loadRows,
      columns: loadColumns,
      entity: 'loads',
      anchor: { row: 0, column: caseIndex },
    });
    expect(result.edits).toEqual([
      { rowId: 'NL1', fieldId: 'nodalLoad.caseId', raw: 'LC2' },
      { rowId: 'ML1', fieldId: 'memberLoad.caseId', raw: 'LC2' },
    ]);
  });
});
