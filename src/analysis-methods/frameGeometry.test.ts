/**
 * `buildFrameGrid` is the thing the Portal Method trusts to say "this member is column line 1,
 * storey 2" — get an index wrong here and every downstream moment is silently attributed to the
 * wrong bay. So this checks the grid comes back right on a well-formed frame, and comes back
 * `undefined` — never a best guess — the moment the geometry stops being a clean rectangle.
 */
import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import type { ProjectModel } from '../types';
import { buildFrameGrid } from './frameGeometry';

const FRAME = { type: 'frame' as const, E: 200e6, A: 0.01, I: 8e-5 };

/** Two bays, two storeys: 3×3 grid, 12 members. */
const twoByTwoFrame = (): ProjectModel => ({
  ...createDefaultProject(),
  nodes: [
    { id: 'A0', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'A1', x: 5, y: 0, support: { type: 'fixed' } },
    { id: 'A2', x: 9, y: 0, support: { type: 'fixed' } },
    { id: 'B0', x: 0, y: 3, support: { type: 'none' } },
    { id: 'B1', x: 5, y: 3, support: { type: 'none' } },
    { id: 'B2', x: 9, y: 3, support: { type: 'none' } },
    { id: 'C0', x: 0, y: 6.5, support: { type: 'none' } },
    { id: 'C1', x: 5, y: 6.5, support: { type: 'none' } },
    { id: 'C2', x: 9, y: 6.5, support: { type: 'none' } },
  ],
  members: [
    { id: 'colA0', i: 'A0', j: 'B0', ...FRAME },
    { id: 'colA1', i: 'A1', j: 'B1', ...FRAME },
    { id: 'colA2', i: 'A2', j: 'B2', ...FRAME },
    { id: 'colB0', i: 'B0', j: 'C0', ...FRAME },
    { id: 'colB1', i: 'B1', j: 'C1', ...FRAME },
    { id: 'colB2', i: 'B2', j: 'C2', ...FRAME },
    { id: 'beamB0', i: 'B0', j: 'B1', ...FRAME },
    { id: 'beamB1', i: 'B1', j: 'B2', ...FRAME },
    { id: 'beamC0', i: 'C0', j: 'C1', ...FRAME },
    { id: 'beamC1', i: 'C1', j: 'C2', ...FRAME },
  ],
});

describe('buildFrameGrid', () => {
  it('extrae la retícula de un pórtico de dos vanos y dos plantas', () => {
    const grid = buildFrameGrid(twoByTwoFrame());
    expect(grid).toBeDefined();
    if (!grid) return;
    expect(grid.columnLines).toEqual([0, 5, 9]);
    expect(grid.storyLevels).toEqual([0, 3, 6.5]);
    expect(grid.nodeGrid[0][0]).toBe('A0');
    expect(grid.nodeGrid[2][2]).toBe('C2');
    expect(grid.columns[1][1]?.memberId).toBe('colA1');
    expect(grid.columns[1][2]?.memberId).toBe('colB1');
    expect(grid.beams[0][2]?.memberId).toBe('beamC0');
    expect(grid.columns[0][1]?.height).toBeCloseTo(3, 9);
    expect(grid.beams[1][1]?.span).toBeCloseTo(4, 9);
  });

  it('no depende del orden de declaración de los nudos ni de la orientación i→j', () => {
    const project = twoByTwoFrame();
    project.nodes = [...project.nodes].reverse();
    project.members = project.members.map((member) => (
      member.id === 'colA1' ? { ...member, i: member.j, j: member.i } : member
    ));
    const grid = buildFrameGrid(project);
    expect(grid).toBeDefined();
    expect(grid?.columns[1][1]?.bottomNodeId).toBe('A1');
    expect(grid?.columns[1][1]?.topNodeId).toBe('B1');
  });

  it('se retira ante una retícula con un rincón faltante', () => {
    const project = twoByTwoFrame();
    project.nodes = project.nodes.filter((node) => node.id !== 'C2');
    project.members = project.members.filter((member) => !['colB2', 'beamC1'].includes(member.id));
    expect(buildFrameGrid(project)).toBeUndefined();
  });

  it('se retira ante un arriostramiento diagonal', () => {
    const project = twoByTwoFrame();
    project.members = [...project.members, { id: 'brace', i: 'A0', j: 'B1', ...FRAME }];
    expect(buildFrameGrid(project)).toBeUndefined();
  });

  it('se retira ante una liberación de momento o un nudo con rótula interna', () => {
    const released = twoByTwoFrame();
    released.members = released.members.map((member) => (
      member.id === 'beamB0' ? { ...member, releases: { iMoment: true } } : member
    ));
    expect(buildFrameGrid(released)).toBeUndefined();

    const hinged = twoByTwoFrame();
    hinged.nodes = hinged.nodes.map((node) => (node.id === 'B1' ? { ...node, internalHinge: true } : node));
    expect(buildFrameGrid(hinged)).toBeUndefined();
  });

  it('se retira ante una barra de armadura en la posición de una columna', () => {
    const project = twoByTwoFrame();
    project.members = project.members.map((member) => (
      member.id === 'colA1' ? { ...member, type: 'truss' as const } : member
    ));
    expect(buildFrameGrid(project)).toBeUndefined();
  });
});
