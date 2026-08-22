import { describe, expect, it } from 'vitest';
import {
  derivedSpace3DId,
  deriveSpace3DFromPlanarProject,
  space3dMatchesPlanarSource,
  unresolvedSpace3DBridgeNotes,
} from './bridge2d';
import { validateSpace3DProject } from '../model/validation';
import { createDefaultProject, createBlankProject } from '../../data/defaultProject';
import type { ProjectModel } from '../../types';

const planar = (): ProjectModel => createDefaultProject();

const codesOf = (source: ProjectModel) => deriveSpace3DFromPlanarProject(source).notes.map((note) => note.code);

describe('2D to Space 3D bridge', () => {
  it('conserva nombre, unidades y una identidad derivada del proyecto fuente', () => {
    const source = planar();
    const { project } = deriveSpace3DFromPlanarProject(source);
    expect(project.analysisSpace).toBe('space-3d');
    expect(project.name).toBe(source.name);
    expect(project.units).toBe(source.settings.units);
    expect(project.id).toBe(derivedSpace3DId(source.id));
    expect(project.id).not.toBe(source.id);
  });

  it('no muta el proyecto 2D de origen', () => {
    const source = planar();
    const before = structuredClone(source);
    deriveSpace3DFromPlanarProject(source);
    expect(source).toEqual(before);
  });

  it('proyecta cada nudo a z = 0 conservando su identificador y coordenadas', () => {
    const source = planar();
    const { project } = deriveSpace3DFromPlanarProject(source);
    expect(project.nodes).toHaveLength(source.nodes.length);
    project.nodes.forEach((node, index) => {
      expect(node.id).toBe(source.nodes[index].id);
      expect(node.x).toBe(source.nodes[index].x);
      expect(node.y).toBe(source.nodes[index].y);
      expect(node.z).toBe(0);
    });
  });

  it('traduce los apoyos plano a plano y deja libres los GDL fuera del plano', () => {
    const source = createBlankProject();
    source.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 4, y: 0, support: { type: 'pin' } },
      { id: 'C', x: 8, y: 0, support: { type: 'roller' } },
      { id: 'D', x: 12, y: 0, support: { type: 'none' } },
    ];
    const { project, notes } = deriveSpace3DFromPlanarProject(source);
    const restraints = (id: string) => project.nodes.find((node) => node.id === id)!.restraints;

    expect(restraints('A')).toMatchObject({ ux: true, uy: true, rz: true });
    expect(restraints('B')).toMatchObject({ ux: true, uy: true, rz: false });
    expect(restraints('C')).toMatchObject({ ux: false, uy: true, rz: false });
    expect(restraints('D')).toMatchObject({ ux: false, uy: false, rz: false });

    // Ningún apoyo plano restringe uz, rx ni ry: se declara, no se inventa.
    for (const id of ['A', 'B', 'C', 'D']) {
      expect(restraints(id).uz).toBe(false);
      expect(restraints(id).rx).toBe(false);
      expect(restraints(id).ry).toBe(false);
    }
    expect(notes.map((note) => note.code)).toContain('out-of-plane-unrestrained');
  });

  it('mapea la inercia 2D al eje fuerte local y marca como pendiente lo que el plano no sabe', () => {
    const source = planar();
    const { project, notes } = deriveSpace3DFromPlanarProject(source);
    const member = project.members[0];
    const origin = source.members[0];

    expect(member.i).toBe(origin.i);
    expect(member.j).toBe(origin.j);
    expect(member.E).toBe(origin.E);
    expect(member.A).toBe(origin.A);
    expect(member.Iz).toBe(origin.I);

    // Nada en un modelo plano define el eje débil ni la torsión: quedan a cero,
    // que es lo que el validador rechaza y el editor pide completar.
    expect(member.Iy).toBe(0);
    expect(member.J).toBe(0);
    const codes = notes.map((note) => note.code);
    expect(codes).toContain('pending-weak-axis-inertia');
    expect(codes).toContain('pending-torsion-constant');
    expect(validateSpace3DProject(project).some((issue) => issue.code === 'invalid-property')).toBe(true);
  });

  it('deriva G sólo cuando el miembro plano lo declara', () => {
    const source = createBlankProject();
    source.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 4, y: 0, support: { type: 'none' } },
    ];
    source.members = [
      { id: 'M1', i: 'A', j: 'B', type: 'frame', E: 2e8, A: 0.01, I: 8e-5, G: 7.7e7 },
      { id: 'M2', i: 'A', j: 'B', type: 'frame', E: 2e8, A: 0.01, I: 8e-5 },
    ];
    const { project, notes } = deriveSpace3DFromPlanarProject(source);
    expect(project.members[0].G).toBe(7.7e7);
    expect(project.members[1].G).toBe(0);
    expect(notes.filter((note) => note.code === 'pending-shear-modulus').map((note) => note.entityId)).toEqual(['M2']);
  });

  it('orienta el eje local y en el plano, también en un pilar vertical', () => {
    const source = createBlankProject();
    source.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 0, y: 4, support: { type: 'none' } },
    ];
    source.members = [{ id: 'M1', i: 'A', j: 'B', type: 'frame', E: 2e8, A: 0.01, I: 8e-5 }];
    const { project } = deriveSpace3DFromPlanarProject(source);
    const reference = project.members[0].orientation.localYReferenceGlobal;

    // Con [0,1,0] la referencia sería paralela al pilar y la geometría degeneraría.
    expect(Math.abs(reference[2])).toBeCloseTo(0, 12);
    expect(Math.hypot(...reference)).toBeCloseTo(1, 12);
    expect(validateSpace3DProject(project).some((issue) => issue.code === 'degenerate-orientation')).toBe(false);
  });

  it('traslada cargas nodales conservando el eje del momento y anulando fz', () => {
    const source = planar();
    source.nodalLoads = [{ id: 'L1', nodeId: source.nodes[1].id, caseId: source.loadCases[0].id, fx: 3, fy: -7, mz: 11 }];
    const { project } = deriveSpace3DFromPlanarProject(source);
    expect(project.nodalLoads).toEqual([{
      id: 'L1', nodeId: source.nodes[1].id, caseId: source.loadCases[0].id,
      fx: 3, fy: -7, fz: 0, mx: 0, my: 0, mz: 11,
    }]);
  });

  it('conserva casos y combinaciones con sus factores', () => {
    const source = planar();
    const { project } = deriveSpace3DFromPlanarProject(source);
    expect(project.loadCases.map((item) => item.id)).toEqual(source.loadCases.map((item) => item.id));
    for (const combination of source.combinations) {
      const twin = project.loadCombinations.find((item) => item.id === combination.id)!;
      expect(twin.name).toBe(combination.name);
      expect(Object.fromEntries(twin.terms.map((term) => [term.caseId, term.factor]))).toEqual(combination.factors);
    }
  });

  it('declara todo lo que S3D-1 no admite en vez de descartarlo en silencio', () => {
    const source = planar();
    expect(source.memberLoads.length).toBeGreaterThan(0);
    const codes = codesOf(source);
    expect(codes).toContain('dropped-member-load');

    const rich = createBlankProject();
    rich.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed', spring: { kx: 10 } } },
      { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 30 } },
      { id: 'C', x: 8, y: 0, support: { type: 'none' }, internalHinge: true },
    ];
    rich.members = [
      { id: 'M1', i: 'A', j: 'B', type: 'truss', E: 2e8, A: 0.01, I: 8e-5 },
      { id: 'M2', i: 'B', j: 'C', type: 'frame', E: 2e8, A: 0.01, I: 8e-5, releases: { iMoment: true } },
    ];
    rich.prescribedDisplacements = [{ id: 'P1', nodeId: 'A', caseId: rich.loadCases[0].id, component: 'uy', value: 0.01 }];
    const richCodes = codesOf(rich);
    for (const code of [
      'dropped-support-spring', 'dropped-inclined-support', 'dropped-internal-hinge',
      'truss-member-as-frame', 'dropped-member-release', 'dropped-prescribed-displacement',
    ]) expect(richCodes).toContain(code);
  });

  it('reconoce el proyecto derivado que sigue correspondiendo a su fuente', () => {
    const source = planar();
    const { project } = deriveSpace3DFromPlanarProject(source);
    expect(space3dMatchesPlanarSource(project, source)).toBe(true);

    // Completar propiedades 3D no rompe la correspondencia: es trabajo del usuario.
    const completed = {
      ...project,
      members: project.members.map((member) => ({ ...member, Iy: 3e-5, J: 2e-5, G: 7.7e7 })),
    };
    expect(space3dMatchesPlanarSource(completed, source)).toBe(true);

    // Añadir geometría propia en 3D no es divergencia del 2D.
    const extended = {
      ...project,
      nodes: [...project.nodes, { id: 'N-3D', x: 1, y: 1, z: 2, restraints: project.nodes[0].restraints }],
    };
    expect(space3dMatchesPlanarSource(extended, source)).toBe(true);

    // Borrar un nudo que venía del 2D sí lo es.
    const trimmed = { ...project, nodes: project.nodes.slice(1) };
    expect(space3dMatchesPlanarSource(trimmed, source)).toBe(false);

    // Mover un nudo en 2D sí rompe la correspondencia.
    const moved = { ...source, nodes: source.nodes.map((node, index) => (index === 0 ? { ...node, x: node.x + 1 } : node)) };
    expect(space3dMatchesPlanarSource(project, moved)).toBe(false);

    const other = { ...project, id: 'space3d-portal' };
    expect(space3dMatchesPlanarSource(other, source)).toBe(false);
  });

  it('marca como bloqueante todo lo que no se pudo mapear con autoridad', () => {
    const source = createBlankProject();
    source.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 4, y: 0, support: { type: 'none' } },
    ];
    source.members = [{ id: 'M1', i: 'A', j: 'B', type: 'truss', E: 2e8, A: 0.01, I: 8e-5 }];
    const { notes } = deriveSpace3DFromPlanarProject(source);

    // Una barra de celosía en 2D libera los momentos de extremo; S3D-1 no tiene
    // liberaciones, así que convertirla a pórtico cambia su comportamiento.
    const truss = notes.find((note) => note.code === 'truss-member-as-frame')!;
    expect(truss.blocking).toBe(true);
    expect(notes.filter((note) => note.code.startsWith('pending-')).every((note) => note.blocking)).toBe(true);
    expect(notes.find((note) => note.code === 'out-of-plane-unrestrained')!.blocking).toBe(true);
  });

  it('resuelve las propiedades pendientes cuando el usuario las completa', () => {
    const source = createBlankProject();
    source.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
      { id: 'B', x: 4, y: 0, support: { type: 'none' } },
    ];
    source.members = [{ id: 'M1', i: 'A', j: 'B', type: 'frame', E: 2e8, A: 0.01, I: 8e-5 }];
    const { project, notes } = deriveSpace3DFromPlanarProject(source);

    expect(unresolvedSpace3DBridgeNotes(notes, project, new Set()).map((note) => note.code))
      .toEqual(expect.arrayContaining(['pending-shear-modulus', 'pending-weak-axis-inertia', 'pending-torsion-constant']));

    const completed = {
      ...project,
      members: project.members.map((member) => ({ ...member, G: 7.7e7, Iy: 3e-5, J: 2e-5 })),
      nodes: project.nodes.map((node) => ({ ...node, restraints: { ...node.restraints, uz: true, rx: true, ry: true } })),
    };
    expect(unresolvedSpace3DBridgeNotes(notes, completed, new Set())).toEqual([]);
  });

  it('deja resolver por reconocimiento explícito lo que no es un número', () => {
    const source = createBlankProject();
    source.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'fixed', spring: { kx: 10 } } },
      { id: 'B', x: 4, y: 0, support: { type: 'none' } },
    ];
    source.members = [{ id: 'M1', i: 'A', j: 'B', type: 'truss', E: 2e8, A: 0.01, I: 8e-5, G: 7.7e7 }];
    const { project, notes } = deriveSpace3DFromPlanarProject(source);
    const completed = {
      ...project,
      members: project.members.map((member) => ({ ...member, Iy: 3e-5, J: 2e-5 })),
      nodes: project.nodes.map((node) => ({ ...node, restraints: { ...node.restraints, uz: true, rx: true, ry: true } })),
    };

    const pending = unresolvedSpace3DBridgeNotes(notes, completed, new Set());
    expect(pending.map((note) => note.code).sort()).toEqual(['dropped-support-spring', 'truss-member-as-frame']);
    expect(unresolvedSpace3DBridgeNotes(notes, completed, new Set(['dropped-support-spring', 'truss-member-as-frame']))).toEqual([]);
  });

  it('deriva un proyecto vacío sin romperse', () => {
    const blank = createBlankProject();
    const { project, notes } = deriveSpace3DFromPlanarProject(blank);
    expect(project.nodes).toEqual([]);
    expect(project.members).toEqual([]);
    expect(notes.map((note) => note.code)).not.toContain('pending-torsion-constant');
  });
});
