import { describe, expect, it } from 'vitest';
import {
  GRID_PAGE_ROWS,
  clampGridPosition,
  isGridNavigationKey,
  moveGridFocus,
} from './datasheetGridNavigation';

const bounds = { rows: 5, columns: 4 };
const at = (row: number, column: number) => ({ row, column });

describe('grid navigation keys', () => {
  it('recognises exactly the keys that move the focus', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']) {
      expect(isGridNavigationKey(key), key).toBe(true);
    }
    for (const key of ['Enter', 'F2', 'Escape', ' ', 'Tab', 'a']) {
      expect(isGridNavigationKey(key), key).toBe(false);
    }
  });
});

describe('moveGridFocus', () => {
  it('moves one cell per arrow', () => {
    expect(moveGridFocus(at(2, 2), 'ArrowUp', bounds)).toEqual(at(1, 2));
    expect(moveGridFocus(at(2, 2), 'ArrowDown', bounds)).toEqual(at(3, 2));
    expect(moveGridFocus(at(2, 2), 'ArrowLeft', bounds)).toEqual(at(2, 1));
    expect(moveGridFocus(at(2, 2), 'ArrowRight', bounds)).toEqual(at(2, 3));
  });

  it('stops at the edges instead of wrapping', () => {
    // Envolver haría perder el sitio sin avisar en una tabla de auditoría.
    expect(moveGridFocus(at(0, 0), 'ArrowUp', bounds)).toEqual(at(0, 0));
    expect(moveGridFocus(at(0, 0), 'ArrowLeft', bounds)).toEqual(at(0, 0));
    expect(moveGridFocus(at(4, 3), 'ArrowDown', bounds)).toEqual(at(4, 3));
    expect(moveGridFocus(at(4, 3), 'ArrowRight', bounds)).toEqual(at(4, 3));
  });

  it('takes Home and End to the ends of the row', () => {
    expect(moveGridFocus(at(2, 2), 'Home', bounds)).toEqual(at(2, 0));
    expect(moveGridFocus(at(2, 2), 'End', bounds)).toEqual(at(2, 3));
  });

  it('takes Ctrl+Home and Ctrl+End to the ends of the grid', () => {
    expect(moveGridFocus(at(2, 2), 'Home', bounds, { extendToEdge: true })).toEqual(at(0, 0));
    expect(moveGridFocus(at(2, 2), 'End', bounds, { extendToEdge: true })).toEqual(at(4, 3));
  });

  it('moves a page of rows without changing column', () => {
    const tall = { rows: 40, columns: 3 };
    expect(moveGridFocus(at(20, 1), 'PageUp', tall)).toEqual(at(20 - GRID_PAGE_ROWS, 1));
    expect(moveGridFocus(at(20, 1), 'PageDown', tall)).toEqual(at(20 + GRID_PAGE_ROWS, 1));
    expect(moveGridFocus(at(2, 1), 'PageUp', tall)).toEqual(at(0, 1));
  });

  it('reports the same position when the key cannot move anything', () => {
    const single = { rows: 1, columns: 1 };
    expect(moveGridFocus(at(0, 0), 'ArrowDown', single)).toEqual(at(0, 0));
    expect(moveGridFocus(at(0, 0), 'End', single, { extendToEdge: true })).toEqual(at(0, 0));
  });

  it('survives an empty grid without producing a negative index', () => {
    const empty = { rows: 0, columns: 0 };
    expect(moveGridFocus(at(0, 0), 'ArrowUp', empty)).toEqual(at(0, 0));
    expect(moveGridFocus(at(3, 3), 'End', empty, { extendToEdge: true })).toEqual(at(0, 0));
  });
});

describe('clampGridPosition', () => {
  it('brings a stale position back inside a shrunken table', () => {
    // Es lo que ocurre al filtrar: sin esto la rejilla se queda sin su única
    // parada de tabulación porque ninguna celda lleva el tabIndex itinerante.
    expect(clampGridPosition(at(40, 9), bounds)).toEqual(at(4, 3));
  });

  it('leaves a valid position untouched', () => {
    expect(clampGridPosition(at(1, 2), bounds)).toEqual(at(1, 2));
  });
});
