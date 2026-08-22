import { datasheetRowField, type DatasheetFieldId } from './datasheetEditModel';
import type { GridPosition } from './datasheetGridNavigation';
import type { DatasheetColumn, DatasheetEntity, DatasheetRow } from './datasheetModel';

/**
 * Pegado sobre la rejilla: interpretar y **contar lo que se descarta**.
 *
 * Un recorte silencioso es el peor fallo posible aquí. El usuario pega cien
 * celdas, se escriben sesenta y cree que se escribieron cien. Por eso el
 * resultado lleva cuántas quedaron fuera y por qué, y la revisión lo enseña
 * antes de que nadie pulse Aplicar.
 */

export interface DatasheetPasteEdit {
  rowId: string;
  fieldId: DatasheetFieldId;
  raw: string;
}

export interface DatasheetPasteResult {
  edits: readonly DatasheetPasteEdit[];
  /** Celdas del bloque que caen más allá del borde de la tabla. */
  droppedOutside: number;
  /** Celdas que caen sobre una columna, o una fila, que no admite ese campo. */
  droppedReadOnly: number;
}

/**
 * Texto tabular a matriz.
 *
 * El tabulador y el salto de línea son el formato que toda hoja de cálculo pone
 * en el portapapeles. No se intenta adivinar un CSV con comillas: es un formato
 * distinto y ambiguo, y confundirlos partiría un valor entrecomillado por sus
 * comas internas.
 */
export const parseClipboardGrid = (text: string): string[][] => {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (normalized === '') return [];
  return normalized.split('\n').map((line) => line.split('\t'));
};

export interface DatasheetPasteInput {
  block: readonly (readonly string[])[];
  rows: readonly DatasheetRow[];
  columns: readonly DatasheetColumn[];
  entity: DatasheetEntity;
  /** Celda enfocada; el bloque se extiende desde ella hacia abajo y a la derecha. */
  anchor: GridPosition;
}

export const mapPasteToEdits = ({
  block,
  rows,
  columns,
  entity,
  anchor,
}: DatasheetPasteInput): DatasheetPasteResult => {
  const edits: DatasheetPasteEdit[] = [];
  let droppedOutside = 0;
  let droppedReadOnly = 0;

  block.forEach((line, lineIndex) => {
    const row = rows[anchor.row + lineIndex];
    line.forEach((raw, cellIndex) => {
      const column = columns[anchor.column + cellIndex];
      if (!row || !column) {
        droppedOutside += 1;
        return;
      }
      // La columna dice si se edita; la fila dice con qué campo. En la tabla de
      // cargas la segunda respuesta puede ser «con ninguno», y eso es un
      // descarte legítimo que también hay que contar.
      const fieldId = column.editability === 'inline'
        ? datasheetRowField(entity, column.id, row.kind)
        : undefined;
      if (!fieldId) {
        droppedReadOnly += 1;
        return;
      }
      edits.push({ rowId: row.id, fieldId, raw });
    });
  });

  return { edits, droppedOutside, droppedReadOnly };
};
