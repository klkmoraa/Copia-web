import { describe, expect, it } from 'vitest';
import { selectGeometryByBox } from './selectionGeometry';

const nodes = [
  { id: 'A', x: 0, y: 0 },
  { id: 'B', x: 5, y: 0 },
  { id: 'C', x: 10, y: 0 },
];
const members = [
  { id: 'AB', i: 'A', j: 'B' },
  { id: 'BC', i: 'B', j: 'C' },
];

describe('CAD box selection', () => {
  it('uses a left-to-right window and requires complete containment', () => {
    const result = selectGeometryByBox({ x: -1, y: -1 }, { x: 6, y: 1 }, nodes, members);
    expect(result.mode).toBe('window');
    expect(result.nodeIds).toEqual(['A', 'B']);
    expect(result.memberIds).toEqual(['AB']);
  });

  it('uses a right-to-left crossing and includes intersected members', () => {
    const result = selectGeometryByBox({ x: 6, y: 1 }, { x: 4, y: -1 }, nodes, members);
    expect(result.mode).toBe('crossing');
    expect(result.nodeIds).toEqual(['B']);
    expect(result.memberIds).toEqual(['AB', 'BC']);
  });

  it('respects node/member selection filters', () => {
    const result = selectGeometryByBox(
      { x: -1, y: -1 }, { x: 6, y: 1 }, nodes, members,
      { nodes: false, members: true },
    );
    expect(result.nodeIds).toEqual([]);
    expect(result.memberIds).toEqual(['AB']);
  });
});
