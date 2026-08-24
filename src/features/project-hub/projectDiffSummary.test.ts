import { describe, expect, it } from 'vitest';
import { diffProjects, type DiffChange, type ProjectDiff } from '../../data/projectDiff';
import { createDefaultProject } from '../../data/defaultProject';
import type { ProjectModel } from '../../types';
import {
  DIFF_ENTITY_ORDER,
  diffCounts,
  formatDiffValue,
  groupChangesByKind,
  limitChanges,
} from './projectDiffSummary';

const labels = { absent: 'ausente', yes: 'sí', no: 'no' };

const change = (kind: DiffChange['kind'], id: string): DiffChange =>
  ({ kind, id, change: 'modified', fields: [] });

const diffOf = (changes: DiffChange[]): ProjectDiff => ({
  changes,
  summary: { added: 0, removed: 0, modified: changes.length },
  identical: changes.length === 0,
});

/** Modelo mínimo con dos nudos y una barra, para diffs de verdad. */
const project = (): ProjectModel => ({
  ...createDefaultProject(),
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 4, y: 0, support: { type: 'roller' } },
  ],
  members: [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 2e8, A: 0.01, I: 1e-4 }],
});

describe('agrupación', () => {
  it('enseña las familias en el orden en que un modelo se construye, no en el del recorrido', () => {
    const grouped = groupChangesByKind(diffOf([
      change('combination', 'C1'),
      change('member', 'M1'),
      change('node', 'N1'),
      change('nodalLoad', 'NL1'),
    ]));
    expect(grouped.map((group) => group.kind)).toEqual(['node', 'member', 'nodalLoad', 'combination']);
  });

  it('ordena por id dentro de cada familia', () => {
    const grouped = groupChangesByKind(diffOf([change('node', 'N10'), change('node', 'N2'), change('node', 'N1')]));
    expect(grouped[0].changes.map((item) => item.id)).toEqual(['N1', 'N10', 'N2']);
  });

  it('no pierde ni inventa cambios al agrupar', () => {
    const changes = [change('node', 'N1'), change('member', 'M1'), change('settings', 'settings')];
    const grouped = groupChangesByKind(diffOf(changes));
    expect(grouped.flatMap((group) => group.changes)).toHaveLength(changes.length);
  });

  it('cubre todas las familias que el diff puede producir', () => {
    /* Si `projectDiff` estrena una familia y este orden no la nombra, sus
       cambios desaparecerían del panel en silencio. El gate no puede enumerar
       el tipo en tiempo de ejecución, así que compara contra un diff real que
       toca todas las colecciones. */
    const before = project();
    const after: ProjectModel = {
      ...project(),
      nodes: [{ id: 'N1', x: 1, y: 0, support: { type: 'pin' } }],
      members: [],
      nodalLoads: [{ id: 'NL1', nodeId: 'N1', caseId: 'LC1', fx: 1, fy: 0, mz: 0 }],
      memberLoads: [{ id: 'ML1', memberId: 'M1', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, qyStart: -1, qyEnd: -1 }],
      prescribedDisplacements: [{ id: 'PD1', nodeId: 'N1', caseId: 'LC1', component: 'ux', value: 0.01 }],
      memberInitialEffects: [{ id: 'IE1', memberId: 'M1', caseId: 'LC1', type: 'temperature', alpha: 1e-5, deltaT: 10 }],
      loadCases: [{ id: 'LC2', name: 'LC2', category: 'variable', active: true }],
      combinations: [{ id: 'CO1', name: 'ELU', factors: { LC2: 1.4 } }],
      settings: { ...project().settings, gridSize: 2 },
    };
    const kinds = new Set(diffProjects(before, after).changes.map((item) => item.kind));
    expect(kinds.size).toBeGreaterThan(0);
    for (const kind of kinds) expect(DIFF_ENTITY_ORDER, kind).toContain(kind);
  });
});

describe('cuentas', () => {
  it('devuelve las tres en orden fijo y omite las que valen cero', () => {
    expect(diffCounts({ changes: [], summary: { added: 2, removed: 0, modified: 5 }, identical: false }))
      .toEqual([{ change: 'added', count: 2 }, { change: 'modified', count: 5 }]);
  });

  it('un diff idéntico no publica ninguna cuenta', () => {
    expect(diffCounts({ changes: [], summary: { added: 0, removed: 0, modified: 0 }, identical: true })).toEqual([]);
  });
});

describe('valores', () => {
  it('traduce la ausencia y los booleanos, que son vocabulario', () => {
    expect(formatDiffValue(undefined, labels)).toBe('ausente');
    expect(formatDiffValue(null, labels)).toBe('ausente');
    expect(formatDiffValue(true, labels)).toBe('sí');
    expect(formatDiffValue(false, labels)).toBe('no');
  });

  it('enseña los números en las unidades base, sin convertir', () => {
    // 0,3 m se lee 0.3: el diff compara el modelo guardado, y el panel dice en
    // qué unidades está leyendo en vez de adivinar la magnitud de cada campo.
    expect(formatDiffValue(0.3, labels)).toBe('0.3');
    expect(formatDiffValue(200e6, labels)).toContain('e');
  });

  it('no deja pasar un no-número disfrazado de número', () => {
    expect(formatDiffValue(Number.NaN, labels)).toBe('NaN');
    expect(formatDiffValue(Number.POSITIVE_INFINITY, labels)).toBe('∞');
    expect(formatDiffValue(Number.NEGATIVE_INFINITY, labels)).toBe('−∞');
  });

  it('recorta lo que no cabe en una celda en vez de romper la fila', () => {
    const long = 'x'.repeat(200);
    expect(formatDiffValue(long, labels).length).toBeLessThan(60);
    expect(formatDiffValue(long, labels).endsWith('…')).toBe(true);
    expect(formatDiffValue({ type: 'custom', restrainX: true }, labels)).toContain('restrainX');
  });
});

describe('recorte de la lista', () => {
  it('dice cuántos quedan fuera en vez de cortar en silencio', () => {
    const changes = Array.from({ length: 120 }, (_, index) => change('node', `N${index}`));
    const limited = limitChanges(changes, 50);
    expect(limited.shown).toHaveLength(50);
    expect(limited.hidden).toBe(70);
  });

  it('no publica un resto negativo cuando cabe todo', () => {
    expect(limitChanges([change('node', 'N1')], 50)).toEqual({ shown: [change('node', 'N1')], hidden: 0 });
  });
});
