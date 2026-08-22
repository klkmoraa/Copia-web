import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { applyProjectPatch, compileProjectCommand } from '../../commands/projectCommand';
import { buildDxfImportCommand, parseAsciiDxf } from './dxfParser';

const ascii = (...pairs: Array<[number, string | number]>) => pairs.flatMap(([code, value]) => [String(code), String(value)]).join('\n');

describe('bounded ASCII DXF import', () => {
  it('previews LINE and straight LWPOLYLINE entities with declared units', () => {
    const inspection = parseAsciiDxf(ascii(
      [0, 'SECTION'], [2, 'HEADER'], [9, '$ACADVER'], [1, 'AC1027'], [9, '$INSUNITS'], [70, 4], [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'LINE'], [8, 'AXIS'], [10, 0], [20, 0], [11, 1000], [21, 0],
      [0, 'LWPOLYLINE'], [8, 'FRAME'], [90, 3], [70, 0], [10, 0], [20, 0], [10, 0], [20, 1000], [10, 1000], [20, 1000],
      [0, 'ENDSEC'], [0, 'EOF'],
    ));

    expect(inspection.acadVersion).toBe('AC1027');
    expect(inspection.insertionUnits).toBe(4);
    expect(inspection.layers).toEqual(['AXIS', 'FRAME']);
    expect(inspection.segments).toHaveLength(3);
    expect(inspection.counts).toEqual({ accepted: 2, rejected: 0 });
    expect(inspection.canImport).toBe(true);
  });

  it('blocks unsupported, curved, paper-space, or non-planar content with diagnostics', () => {
    const inspection = parseAsciiDxf(ascii(
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'CIRCLE'], [10, 0], [20, 0], [40, 2],
      [0, 'LWPOLYLINE'], [90, 2], [10, 0], [20, 0], [42, 1], [10, 2], [20, 0],
      [0, 'LINE'], [67, 1], [10, 0], [20, 0], [11, 1], [21, 0],
      [0, 'ENDSEC'], [0, 'EOF'],
    ));

    expect(inspection.canImport).toBe(false);
    expect(inspection.counts.rejected).toBe(3);
    expect(inspection.diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      'unsupported-entity', 'curved-polyline', 'paper-space',
    ]));
  });

  it('builds a reversible command using an explicit existing member as the structural template', () => {
    const project = createDefaultProject();
    Object.assign(project.members[0] as object, {
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog',
    });
    const inspection = parseAsciiDxf(ascii(
      [0, 'SECTION'], [2, 'HEADER'], [9, '$INSUNITS'], [70, 4], [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'], [0, 'LINE'], [8, 'STEEL'], [10, 0], [20, 0], [11, 1000], [21, 0], [0, 'ENDSEC'], [0, 'EOF'],
    ));
    const command = buildDxfImportCommand(project, inspection, {
      sourceName: 'frame.dxf', sourceUnit: 'mm', templateMemberId: project.members[0].id,
    });
    const compiled = compileProjectCommand(project, command);
    const imported = applyProjectPatch(project, compiled.forward);

    expect(project.members).toHaveLength(3);
    expect(imported.members).toHaveLength(4);
    expect(imported.nodes).toHaveLength(6);
    expect(imported.members[3]).toMatchObject({ E: project.members[0].E, A: project.members[0].A, I: project.members[0].I });
    expect(imported.members[3]).toMatchObject({ materialOrigin: 'imported', sectionOrigin: 'imported' });
    expect(imported.members[3]).not.toHaveProperty('materialId');
    expect(imported.members[3]).not.toHaveProperty('sectionId');
    expect(imported.nodes.slice(-2).map((node) => [node.x, node.y])).toEqual([[0, 0], [1, 0]]);
    expect(applyProjectPatch(imported, compiled.inverse)).toEqual(project);
  });

  it('requires an explicit unit when INSUNITS is missing', () => {
    const inspection = parseAsciiDxf(ascii(
      [0, 'SECTION'], [2, 'ENTITIES'], [0, 'LINE'], [10, 0], [20, 0], [11, 1], [21, 0], [0, 'ENDSEC'], [0, 'EOF'],
    ));
    expect(inspection.requiresUnitSelection).toBe(true);
    expect(inspection.diagnostics.map((item) => item.code)).toContain('units-required');
  });
});
