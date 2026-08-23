import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { affectedObjects, describeDiff, diffProjects } from './projectDiff';

const baseProject = (): ProjectModel => ({
  schemaVersion: 1,
  id: 'test',
  name: 'test',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 4, y: 0, support: { type: 'roller' } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 2e8, A: 0.01, I: 1e-4 }],
  loadCases: [{ id: 'LC1', name: 'LC1', category: 'variable', active: true }],
  combinations: [],
  nodalLoads: [],
  memberLoads: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true, showGrid: true,
    showNodeLabels: true, showMemberLabels: false, showLocalAxes: false, showLoads: true,
    showDimensions: true, showResultValues: true, diagramScale: 1, deformedScale: 50, diagramSide: 'positive',
  },
});

const clone = (project: ProjectModel): ProjectModel => JSON.parse(JSON.stringify(project)) as ProjectModel;

describe('diff estructural', () => {
  it('un modelo consigo mismo no tiene cambios', () => {
    const project = baseProject();
    const diff = diffProjects(project, clone(project));
    expect(diff.identical).toBe(true);
    expect(diff.changes).toEqual([]);
    expect(describeDiff(diff)).toBe('Sin cambios.');
  });

  it('detecta un alta con su tipo y su identidad', () => {
    const after = clone(baseProject());
    after.nodes.push({ id: 'C', x: 4, y: 3, support: { type: 'none' } });
    const diff = diffProjects(baseProject(), after);
    expect(diff.changes).toEqual([{ kind: 'node', id: 'C', change: 'added', fields: [] }]);
    expect(diff.summary).toEqual({ added: 1, removed: 0, modified: 0 });
  });

  it('detecta una baja', () => {
    const after = clone(baseProject());
    after.members = [];
    const diff = diffProjects(baseProject(), after);
    expect(diff.changes).toEqual([{ kind: 'member', id: 'AB', change: 'removed', fields: [] }]);
  });

  it('detecta qué campo cambió, con su antes y su después', () => {
    const after = clone(baseProject());
    after.nodes[1].x = 5;
    const diff = diffProjects(baseProject(), after);
    expect(diff.changes).toEqual([{
      kind: 'node', id: 'B', change: 'modified',
      fields: [{ field: 'x', before: 4, after: 5 }],
    }]);
  });

  it('mira dentro de los objetos anidados, como el apoyo de un nudo', () => {
    const after = clone(baseProject());
    after.nodes[0].support = { type: 'fixed' };
    const diff = diffProjects(baseProject(), after);
    expect(diff.changes[0].fields[0].field).toBe('support');
    expect(diff.changes[0].fields[0].after).toEqual({ type: 'fixed' });
  });

  it('trata «ausente» y «undefined» como lo mismo, que es lo que significan', () => {
    const after = clone(baseProject());
    after.members[0] = { ...after.members[0], label: undefined };
    expect(diffProjects(baseProject(), after).identical).toBe(true);
  });

  it('por defecto no esconde nada: dos números distintos son un cambio', () => {
    const after = clone(baseProject());
    after.members[0].E = 2e8 + 1e-6;
    expect(diffProjects(baseProject(), after).identical).toBe(false);
  });

  it('con tolerancia declarada ignora el ruido del último bit', () => {
    const after = clone(baseProject());
    after.members[0].E = 2e8 * (1 + 1e-15);
    expect(diffProjects(baseProject(), after, { numericTolerance: 1e-12 }).identical).toBe(true);
    // Pero un cambio real sigue viéndose con la misma tolerancia puesta.
    after.members[0].E = 2.1e8;
    expect(diffProjects(baseProject(), after, { numericTolerance: 1e-12 }).identical).toBe(false);
  });

  it('recoge los ajustes del proyecto por separado de los objetos', () => {
    const after = clone(baseProject());
    after.settings.units = 'kip-ft';
    const diff = diffProjects(baseProject(), after);
    expect(diff.changes).toEqual([{
      kind: 'settings', id: 'settings', change: 'modified',
      fields: [{ field: 'units', before: 'kN-m', after: 'kip-ft' }],
    }]);
    // Los ajustes no son un objeto señalable en el lienzo.
    expect(affectedObjects(diff)).toEqual([]);
  });

  it('publica los objetos tocados en el vocabulario del Model Doctor', () => {
    const after = clone(baseProject());
    after.nodes[0].x = 1;
    after.members[0].A = 0.02;
    expect(affectedObjects(diffProjects(baseProject(), after))).toEqual([
      { kind: 'node', id: 'A' },
      { kind: 'member', id: 'AB' },
    ]);
  });

  it('es determinista: el mismo par de modelos da exactamente la misma lista', () => {
    const after = clone(baseProject());
    after.nodes.push({ id: 'C', x: 4, y: 3, support: { type: 'none' } });
    after.nodes[0].x = 1;
    after.members = [];
    expect(diffProjects(baseProject(), after)).toEqual(diffProjects(baseProject(), after));
  });

  it('resume en una línea lo que hay que confirmar', () => {
    const after = clone(baseProject());
    after.nodes.push({ id: 'C', x: 4, y: 3, support: { type: 'none' } });
    after.nodes[0].x = 1;
    after.members = [];
    expect(describeDiff(diffProjects(baseProject(), after))).toBe('1 alta(s), 1 modificación(es), 1 baja(s).');
  });

  it('distingue colecciones ausentes de colecciones vacías sin inventar cambios', () => {
    const before = baseProject();
    const after = clone(before);
    after.prescribedDisplacements = [];
    expect(diffProjects(before, after).identical).toBe(true);
  });

  it('un id reutilizado para otra cosa se lee como modificación, no como alta y baja', () => {
    const after = clone(baseProject());
    after.nodes[1] = { id: 'B', x: 99, y: 99, support: { type: 'fixed' } };
    const diff = diffProjects(baseProject(), after);
    expect(diff.summary).toEqual({ added: 0, removed: 0, modified: 1 });
    expect(diff.changes[0].fields.map((field) => field.field)).toEqual(['support', 'x', 'y']);
  });
});
