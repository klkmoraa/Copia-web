/**
 * Movimiento del foco dentro de la rejilla del datasheet.
 *
 * Vive fuera del componente porque es la parte del teclado que se puede probar
 * sin montar nada: qué celda queda enfocada tras cada tecla, con qué topes y con
 * qué modificadores. Lo que el componente conserva es sólo la posición actual.
 *
 * **El foco no es la selección.** Este módulo mueve el foco y nada más; qué
 * filas están seleccionadas lo decide el store del workspace. Confundirlos es lo
 * que hace que una rejilla accesible deje de serlo: recorrer la tabla con las
 * flechas no puede ir cambiando el objeto seleccionado en el lienzo.
 */

export interface GridPosition {
  row: number;
  column: number;
}

export interface GridBounds {
  rows: number;
  columns: number;
}

export type GridNavigationKey =
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown';

export interface GridNavigationModifiers {
  /** `Ctrl` en Windows y Linux, `Cmd` en macOS: ambos llevan al extremo. */
  extendToEdge?: boolean;
}

/** Filas que recorren `AvPág` y `RePág`; una pantalla aproximada de datasheet. */
export const GRID_PAGE_ROWS = 10;

export const isGridNavigationKey = (key: string): key is GridNavigationKey =>
  key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight'
  || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown';

const clamp = (value: number, maximum: number): number => {
  if (maximum < 0) return 0;
  return Math.min(maximum, Math.max(0, value));
};

/**
 * Posición resultante de pulsar `key`.
 *
 * Los bordes topan en vez de envolver: en una tabla de auditoría, saltar de la
 * última fila a la primera con una flecha hace perder el sitio sin avisar.
 * Devuelve la misma posición cuando la tecla no mueve nada, para que el
 * componente sepa si debe consumir el evento.
 */
export const moveGridFocus = (
  current: GridPosition,
  key: GridNavigationKey,
  bounds: GridBounds,
  modifiers: GridNavigationModifiers = {},
): GridPosition => {
  const lastRow = bounds.rows - 1;
  const lastColumn = bounds.columns - 1;
  const row = clamp(current.row, lastRow);
  const column = clamp(current.column, lastColumn);

  switch (key) {
    case 'ArrowUp': return { row: clamp(row - 1, lastRow), column };
    case 'ArrowDown': return { row: clamp(row + 1, lastRow), column };
    case 'ArrowLeft': return { row, column: clamp(column - 1, lastColumn) };
    case 'ArrowRight': return { row, column: clamp(column + 1, lastColumn) };
    case 'PageUp': return { row: clamp(row - GRID_PAGE_ROWS, lastRow), column };
    case 'PageDown': return { row: clamp(row + GRID_PAGE_ROWS, lastRow), column };
    case 'Home': return modifiers.extendToEdge
      ? { row: 0, column: 0 }
      : { row, column: 0 };
    case 'End': return modifiers.extendToEdge
      ? { row: clamp(lastRow, lastRow), column: clamp(lastColumn, lastColumn) }
      : { row, column: clamp(lastColumn, lastColumn) };
  }
};

/**
 * Reencaja el foco cuando la tabla cambia de tamaño —al buscar, filtrar o
 * cambiar de entidad—. Sin esto, un filtro que deja tres filas mantendría el
 * foco en la fila 40 y el `tabIndex` itinerante desaparecería de la rejilla.
 */
export const clampGridPosition = (position: GridPosition, bounds: GridBounds): GridPosition => ({
  row: clamp(position.row, bounds.rows - 1),
  column: clamp(position.column, bounds.columns - 1),
});
