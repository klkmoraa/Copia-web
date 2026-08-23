import { describe, expect, it } from 'vitest';
import { createBlankProject, createDefaultProject } from '../../data/defaultProject';
import type { MemberModel, ProjectModel } from '../../types';
import {
  SELECTION_QUERIES,
  availableSelectionQueries,
  countOf,
  selectionQueryById,
  toSelection,
} from './selectByProperty';

const run = (id: Parameters<typeof selectionQueryById>[0], project: ProjectModel, selection = null) =>
  selectionQueryById(id).run(project, selection);

/** El pórtico de ejemplo: N1 y N2 articulados, N3 y N4 libres, tres barras de pórtico. */
const example = () => createDefaultProject();

describe('consultas sobre nudos', () => {
  it('separa apoyos de nudos libres sin solaparse y sin dejarse ninguno', () => {
    const project = example();
    const supported = run('nodes.supported', project);
    const free = run('nodes.free', project);

    expect(supported.nodeIds).toEqual(['N1', 'N2']);
    expect(free.nodeIds).toEqual(['N3', 'N4']);
    // Partición: ni un nudo en los dos, ni un nudo fuera de los dos.
    expect(supported.nodeIds.filter((id) => free.nodeIds.includes(id))).toEqual([]);
    expect(supported.nodeIds.length + free.nodeIds.length).toBe(project.nodes.length);
    // Una consulta de nudos no arrastra barras.
    expect(supported.memberIds).toEqual([]);
  });

  it('distingue el tipo de apoyo', () => {
    const project = example();
    expect(run('nodes.support.pin', project).nodeIds).toEqual(['N1', 'N2']);
    expect(run('nodes.support.roller', project).nodeIds).toEqual([]);
    expect(run('nodes.support.fixed', project).nodeIds).toEqual([]);
  });

  it('encuentra los nudos con carga aplicada', () => {
    const project = example();
    project.nodalLoads = [{ id: 'NL1', nodeId: 'N3', caseId: 'LC1', fx: 0, fy: -10, mz: 0 }];
    expect(run('nodes.loaded', project).nodeIds).toEqual(['N3']);
  });
});

describe('consultas sobre barras', () => {
  it('separa cargadas de sin carga como partición del modelo', () => {
    const project = example();
    const loaded = run('members.loaded', project);
    const unloaded = run('members.unloaded', project);

    expect(loaded.memberIds.length + unloaded.memberIds.length).toBe(project.members.length);
    expect(loaded.memberIds.filter((id) => unloaded.memberIds.includes(id))).toEqual([]);
    expect(loaded.memberIds).toContain('M2');
  });

  it('encuentra las liberaciones de momento en cualquiera de los dos extremos', () => {
    const project = example();
    project.members[0].releases = { iMoment: true };
    project.members[1].releases = { jMoment: true };
    project.members[2].releases = { iMoment: false, jMoment: false };
    expect(run('members.released', project).memberIds).toEqual(['M1', 'M2']);
  });

  it('distingue el tipo de elemento', () => {
    const project = example();
    project.members[2].type = 'truss';
    expect(run('members.frame', project).memberIds).toEqual(['M1', 'M2']);
    expect(run('members.truss', project).memberIds).toEqual(['M3']);
  });
});

describe('«similares a la selección»', () => {
  const withSections = (): ProjectModel => {
    const project = example();
    // M1 y M3 comparten catálogo; M2 es otro perfil.
    project.members = project.members.map((member, index): MemberModel => ({
      ...member,
      sectionId: index === 1 ? 'IPE-300' : 'IPE-200',
      materialId: 'S275',
    }));
    return project;
  };

  it('trae todo lo que comparte sección y material, incluida la propia selección', () => {
    const project = withSections();
    const result = selectionQueryById('members.similar').run(project, { kind: 'member', id: 'M1' });
    expect(result.memberIds).toEqual(['M1', 'M3']);
  });

  /**
   * Sin identidad de catálogo la comparación cae a los números del solver, que
   * es lo que el solver realmente usa. Dos barras con la misma E, A e I son la
   * misma sección aunque nadie les haya puesto nombre.
   */
  it('compara por los números del solver cuando no hay identidad de catálogo', () => {
    const project = example();
    project.members[1] = { ...project.members[1], I: 5e-5 };
    const result = selectionQueryById('members.similar').run(project, { kind: 'member', id: 'M1' });
    expect(result.memberIds).toEqual(['M1', 'M3']);
  });

  it('parte de una selección múltiple y une sus clases', () => {
    const project = withSections();
    const result = selectionQueryById('members.similar').run(project, {
      kind: 'multi', nodeIds: [], memberIds: ['M1', 'M2'],
    });
    expect(result.memberIds).toEqual(['M1', 'M2', 'M3']);
  });

  it('parte de una carga en barra: seleccionar la carga es señalar su barra', () => {
    const project = withSections();
    const load = project.memberLoads[0];
    const result = selectionQueryById('members.similar').run(project, { kind: 'memberLoad', id: load.id });
    expect(result.memberIds).toContain(load.memberId);
  });

  it('no inventa nada sin selección', () => {
    expect(selectionQueryById('members.similar').run(example(), null).memberIds).toEqual([]);
  });
});

describe('el resultado alimenta al bulk-edit sin pegamento', () => {
  /**
   * `Selection` ya admitía `multi` antes de este cambio: es exactamente la misma
   * forma que produce arrastrar un rectángulo sobre el lienzo, y por eso el
   * panel de edición masiva la consume sin una línea de adaptación.
   */
  it('produce siempre una selección múltiple, aunque encuentre un solo objeto', () => {
    const project = example();
    project.members[0].releases = { iMoment: true };
    const selection = toSelection(run('members.released', project));
    expect(selection).toEqual({ kind: 'multi', nodeIds: [], memberIds: ['M1'] });
  });

  it('deselecciona en vez de devolver una selección múltiple vacía', () => {
    expect(toSelection(run('nodes.support.fixed', example()))).toBeNull();
  });
});

describe('qué se ofrece', () => {
  it('sólo ofrece consultas que hoy encuentran algo', () => {
    const offered = availableSelectionQueries(example(), null).map((entry) => entry.query.id);
    // No hay armaduras ni empotramientos en el pórtico de ejemplo.
    expect(offered).not.toContain('members.truss');
    expect(offered).not.toContain('nodes.support.fixed');
    expect(offered).toContain('nodes.support.pin');
    // Y ninguna se ofrece con recuento cero.
    for (const entry of availableSelectionQueries(example(), null)) expect(entry.count).toBeGreaterThan(0);
  });

  it('no ofrece nada sobre un modelo vacío', () => {
    expect(availableSelectionQueries(createBlankProject(), null)).toEqual([]);
  });

  it('declara cada consulta una sola vez', () => {
    const ids = SELECTION_QUERIES.map((query) => query.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('recuenta nudos y barras juntos', () => {
    expect(countOf({ nodeIds: ['N1'], memberIds: ['M1', 'M2'] })).toBe(3);
  });
});
