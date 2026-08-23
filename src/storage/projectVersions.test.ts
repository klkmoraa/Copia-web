import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { InMemoryProjectRepository } from './projectRepository';
import { compareVersionWithCurrent, compareVersions, listNamedVersions, restoreNamedVersion, saveNamedVersion } from './projectVersions';

const baseProject = (): ProjectModel => ({
  schemaVersion: 1,
  id: 'P1',
  name: 'Proyecto',
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

describe('versiones nombradas', () => {
  it('guarda una versión con su nombre y la recupera de la lista', async () => {
    const repository = new InMemoryProjectRepository();
    await repository.saveProject(baseProject());
    const version = await saveNamedVersion(repository, baseProject(), 'Antes de subir las cargas');
    expect(version.label).toBe('Antes de subir las cargas');
    const versions = await listNamedVersions(repository, 'P1');
    expect(versions.map((item) => item.label)).toEqual(['Antes de subir las cargas']);
  });

  it('exige un nombre: una lista de instantáneas sin nombre no es un historial', async () => {
    const repository = new InMemoryProjectRepository();
    await expect(saveNamedVersion(repository, baseProject(), '   ')).rejects.toThrow(/nombre/);
  });

  it('no confunde una versión con una recuperación automática', async () => {
    const repository = new InMemoryProjectRepository();
    await repository.saveProject(baseProject());
    await repository.createRecovery(baseProject(), 'conflict');
    await repository.createRecovery(baseProject(), 'migration');
    await saveNamedVersion(repository, baseProject(), 'La mía');
    expect(await listNamedVersions(repository, 'P1')).toHaveLength(1);
    // Pero las automáticas siguen ahí: la lista de versiones filtra, no borra.
    expect(await repository.listRecoveries('P1')).toHaveLength(3);
  });

  it('sólo devuelve las versiones del proyecto pedido', async () => {
    const repository = new InMemoryProjectRepository();
    const other = { ...baseProject(), id: 'P2' };
    await repository.saveProject(baseProject());
    await repository.saveProject(other);
    await saveNamedVersion(repository, baseProject(), 'De P1');
    await saveNamedVersion(repository, other, 'De P2');
    expect((await listNamedVersions(repository, 'P1')).map((item) => item.label)).toEqual(['De P1']);
  });

  it('restaura por la misma ruta que una recuperación', async () => {
    const repository = new InMemoryProjectRepository();
    await repository.saveProject(baseProject());
    const version = await saveNamedVersion(repository, baseProject(), 'Original');
    const edited = clone(baseProject());
    edited.nodes[1].x = 99;
    await repository.saveProject(edited);
    expect((await repository.openProject('P1'))!.project.nodes[1].x).toBe(99);
    await restoreNamedVersion(repository, version.id);
    expect((await repository.openProject('P1'))!.project.nodes[1].x).toBe(4);
  });
});

describe('comparación de versiones', () => {
  it('dos versiones del mismo modelo son idénticas y no hace falta recorrerlas', async () => {
    const repository = new InMemoryProjectRepository();
    const first = await saveNamedVersion(repository, baseProject(), 'A');
    const second = await saveNamedVersion(repository, baseProject(), 'B');
    expect(first.checksum).toBe(second.checksum);
    const comparison = compareVersions(first, second);
    expect(comparison.identical).toBe(true);
    expect(comparison.diff.changes).toEqual([]);
  });

  it('dice qué cambió entre dos versiones', async () => {
    const repository = new InMemoryProjectRepository();
    const before = await saveNamedVersion(repository, baseProject(), 'Antes');
    const edited = clone(baseProject());
    edited.nodes[1].x = 6;
    edited.nodalLoads.push({ id: 'NL1', nodeId: 'B', caseId: 'LC1', fx: 0, fy: -10, mz: 0 });
    const after = await saveNamedVersion(repository, edited, 'Después');
    const comparison = compareVersions(before, after);
    expect(comparison.identical).toBe(false);
    expect(comparison.diff.summary).toEqual({ added: 1, removed: 0, modified: 1 });
  });

  it('compara una versión guardada con lo que se está editando ahora', async () => {
    const repository = new InMemoryProjectRepository();
    const version = await saveNamedVersion(repository, baseProject(), 'Guardada');
    const current = clone(baseProject());
    current.members[0].A = 0.05;
    const diff = compareVersionWithCurrent(version, current);
    expect(diff.changes).toEqual([{
      kind: 'member', id: 'AB', change: 'modified',
      fields: [{ field: 'A', before: 0.01, after: 0.05 }],
    }]);
  });
});
