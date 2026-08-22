import { describe, expect, it } from 'vitest';
import { createBlankSpace3DProject, createSpace3DPortalExample } from './defaultProject';

describe('Space3D project defaults', () => {
  it('crea un proyecto discriminado sin compartir arrays', () => {
    const a = createBlankSpace3DProject();
    const b = createBlankSpace3DProject();
    expect(a.analysisSpace).toBe('space-3d');
    expect(a.schemaVersion).toBe(1);
    expect(a.units).toBe('kN-m');
    expect(a.nodes).not.toBe(b.nodes);
    expect(a.members).not.toBe(b.members);
  });

  it('incluye un ejemplo espacial estable con carga fuera del plano', () => {
    const example = createSpace3DPortalExample();
    expect(new Set(example.nodes.map((node) => node.z)).size).toBeGreaterThan(1);
    expect(example.members.length).toBeGreaterThanOrEqual(3);
    expect(example.nodalLoads.some((load) => load.fz !== 0)).toBe(true);
  });
});
