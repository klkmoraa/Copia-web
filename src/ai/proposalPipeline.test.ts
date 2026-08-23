import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProjectModel } from '../types';
import { standardSections } from '../data/standardSections';
import { confirmProposal, prepareProposal } from './proposalCompiler';
import { validateCommandProposal } from './proposalValidation';
import { allowedUnits, toBaseUnits } from './proposalUnits';
import { createLocalProposalProvider } from './localProposalProvider';
import type { CommandProposalV1, ProposalRequest } from './commandProposal';

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const baseProject = (): ProjectModel => ({
  schemaVersion: 1,
  id: 'P1',
  name: 'Proyecto',
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 4, y: 0, support: { type: 'roller' } },
  ],
  members: [{ id: 'M1', i: 'A', j: 'B', type: 'frame', E: 2e8, A: 0.01, I: 1e-4 }],
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

const readyProposal = (operation: unknown) => ({
  version: 1, proposalId: UUID, snapshotHash: HASH, status: 'ready',
  summary: 'Cambio propuesto', operation,
});

describe('validador · lo que acepta', () => {
  it('acepta una propuesta lista y bien formada', () => {
    const outcome = validateCommandProposal(readyProposal({
      kind: 'member.update', memberId: 'M1', changes: { E: { value: 210, unit: 'GPa' } },
    }));
    expect(outcome.ok).toBe(true);
  });

  it('acepta las tres formas de contestar y ninguna más', () => {
    for (const [status, field, text] of [['needs-clarification', 'question', '¿Qué barra?'], ['rejected', 'reason', 'Fuera de alcance']] as const) {
      const outcome = validateCommandProposal({ version: 1, proposalId: UUID, snapshotHash: HASH, status, summary: 'x', [field]: text });
      expect(outcome.ok, status).toBe(true);
    }
    const invented = validateCommandProposal({ version: 1, proposalId: UUID, snapshotHash: HASH, status: 'applied', summary: 'x' });
    expect(invented.ok).toBe(false);
  });
});

describe('validador · lo que rechaza, que es donde está el valor', () => {
  const rejects = (input: unknown, path: string) => {
    const outcome = validateCommandProposal(input);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.path).toBe(path);
  };

  it('rechaza una propiedad no declarada en vez de ignorarla', () => {
    rejects({ ...readyProposal({ kind: 'member.update', memberId: 'M1', changes: { label: 'x' } }), extra: 1 }, '');
  });

  it('rechaza una propiedad no declarada dentro de los cambios', () => {
    rejects(readyProposal({ kind: 'member.update', memberId: 'M1', changes: { rotationalSpringI: 5 } }), 'operation.changes');
  });

  it('rechaza una operación fuera de la allowlist', () => {
    rejects(readyProposal({ kind: 'member.delete', memberId: 'M1' }), 'operation.kind');
  });

  it('rechaza otra versión del contrato en vez de interpretarla con estas reglas', () => {
    rejects({ ...readyProposal({ kind: 'member.section.apply', memberId: 'M1', sectionId: 's' }), version: 2 }, 'version');
  });

  it('exige un UUID y un SHA-256 de verdad', () => {
    rejects({ ...readyProposal({ kind: 'member.section.apply', memberId: 'M1', sectionId: 's' }), proposalId: 'abc' }, 'proposalId');
    rejects({ ...readyProposal({ kind: 'member.section.apply', memberId: 'M1', sectionId: 's' }), snapshotHash: 'abc' }, 'snapshotHash');
  });

  it('no convierte un número escrito como texto', () => {
    rejects(readyProposal({ kind: 'member.update', memberId: 'M1', changes: { E: { value: '210', unit: 'GPa' } } }), 'operation.changes.E.value');
  });

  it('rechaza una cantidad sin unidad: un número suelto no es una cantidad', () => {
    rejects(readyProposal({ kind: 'member.update', memberId: 'M1', changes: { E: { value: 210 } } }), 'operation.changes.E.unit');
  });

  it('rechaza una propuesta que no cambia nada', () => {
    rejects(readyProposal({ kind: 'member.update', memberId: 'M1', changes: {} }), 'operation.changes');
  });

  it('rechaza un resumen vacío o desmedido', () => {
    rejects({ ...readyProposal({ kind: 'member.section.apply', memberId: 'M1', sectionId: 's' }), summary: '' }, 'summary');
    rejects({ ...readyProposal({ kind: 'member.section.apply', memberId: 'M1', sectionId: 's' }), summary: 'x'.repeat(241) }, 'summary');
  });

  it('rechaza cualquier cosa que no sea un objeto', () => {
    for (const input of [null, 42, 'ready', [], undefined]) expect(validateCommandProposal(input).ok).toBe(false);
  });
});

describe('unidades', () => {
  it('convierte a unidades base', () => {
    expect(toBaseUnits({ value: 210, unit: 'GPa' }, 'elasticModulus')).toBeCloseTo(2.1e8, 3);
    expect(toBaseUnits({ value: 100, unit: 'cm2' }, 'area')).toBeCloseTo(0.01, 12);
    expect(toBaseUnits({ value: 1000, unit: 'cm4' }, 'inertia')).toBeCloseTo(1e-5, 15);
    expect(toBaseUnits({ value: 7850, unit: 'kg/m3' }, 'density')).toBe(7850);
  });

  it('rechaza una unidad que no pertenece a la magnitud en vez de convertirla', () => {
    expect(() => toBaseUnits({ value: 210, unit: 'GPa' }, 'area')).toThrow(/no es una unidad admitida/);
    expect(() => toBaseUnits({ value: 1, unit: 'kg/cm2' }, 'elasticModulus')).toThrow(/no es una unidad admitida/);
  });

  it('publica su lista cerrada', () => {
    expect(allowedUnits('area')).toEqual(['m2', 'cm2', 'mm2', 'in2']);
  });
});

describe('compilación sobre un clon', () => {
  const validated = (operation: unknown): CommandProposalV1 => {
    const outcome = validateCommandProposal(readyProposal(operation));
    if (!outcome.ok) throw new Error(`${outcome.path}: ${outcome.reason}`);
    return outcome.value;
  };

  it('prepara un cambio de propiedades y describe exactamente qué haría', () => {
    const outcome = prepareProposal(baseProject(), HASH, validated({
      kind: 'member.update', memberId: 'M1', changes: { A: { value: 200, unit: 'cm2' } },
    }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    /* Dos campos, no uno: escribir el área a mano rompe la identidad de
       catálogo de la sección, y `compileProjectCommand` lo marca poniendo
       `sectionOrigin: 'custom'`. El diff lo enseña porque el usuario tiene que
       verlo antes de aceptar — es precisamente la clase de consecuencia lateral
       que una propuesta aceptada a ciegas escondería. */
    expect(outcome.prepared.diff.changes).toEqual([{
      kind: 'member', id: 'M1', change: 'modified',
      fields: [
        { field: 'A', before: 0.01, after: 0.02 },
        { field: 'sectionOrigin', before: undefined, after: 'custom' },
      ],
    }]);
  });

  it('NO toca el proyecto real al preparar', () => {
    const project = baseProject();
    const before = JSON.stringify(project);
    prepareProposal(project, HASH, validated({
      kind: 'member.update', memberId: 'M1', changes: { A: { value: 999, unit: 'cm2' } },
    }));
    expect(JSON.stringify(project)).toBe(before);
  });

  it('rechaza una propuesta razonada sobre un estado que ya no es el actual', () => {
    const outcome = prepareProposal(baseProject(), OTHER_HASH, validated({
      kind: 'member.update', memberId: 'M1', changes: { A: { value: 200, unit: 'cm2' } },
    }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('stale-snapshot');
  });

  it('rechaza un identificador que no existe en el modelo', () => {
    const outcome = prepareProposal(baseProject(), HASH, validated({
      kind: 'member.update', memberId: 'M99', changes: { A: { value: 200, unit: 'cm2' } },
    }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('unknown-id');
  });

  it('rechaza una sección que no está en el catálogo', () => {
    const outcome = prepareProposal(baseProject(), HASH, validated({
      kind: 'member.section.apply', memberId: 'M1', sectionId: 'inventada',
    }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('unknown-id');
  });

  it('toma los números del catálogo local, nunca de la propuesta', () => {
    const section = standardSections[0];
    const outcome = prepareProposal(baseProject(), HASH, validated({
      kind: 'member.section.apply', memberId: 'M1', sectionId: section.id,
    }));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const fields = Object.fromEntries(outcome.prepared.diff.changes[0].fields.map((field) => [field.field, field.after]));
    expect(fields.A).toBe(section.area);
    expect(fields.I).toBe(section.inertiaX);
  });

  it('rechaza una unidad equivocada de campo', () => {
    const outcome = prepareProposal(baseProject(), HASH, validated({
      kind: 'member.update', memberId: 'M1', changes: { A: { value: 210, unit: 'GPa' } },
    }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('bad-units');
  });

  it('rechaza un valor no positivo donde el solver espera una rigidez', () => {
    const outcome = prepareProposal(baseProject(), HASH, validated({
      kind: 'member.update', memberId: 'M1', changes: { A: { value: -5, unit: 'cm2' } },
    }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('bad-units');
  });

  it('rechaza una propuesta que no cambiaría nada del modelo actual', () => {
    const outcome = prepareProposal(baseProject(), HASH, validated({
      kind: 'member.update', memberId: 'M1', changes: { A: { value: 100, unit: 'cm2' } },
    }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('no-effect');
  });

  it('no compila una propuesta que no está lista', () => {
    const clarification = validateCommandProposal({
      version: 1, proposalId: UUID, snapshotHash: HASH, status: 'needs-clarification', summary: 'x', question: '¿cuál?',
    });
    expect(clarification.ok).toBe(true);
    if (!clarification.ok) return;
    const outcome = prepareProposal(baseProject(), HASH, clarification.value);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('not-ready');
  });
});

describe('confirmación', () => {
  const prepared = () => {
    const outcome = validateCommandProposal(readyProposal({
      kind: 'member.update', memberId: 'M1', changes: { A: { value: 200, unit: 'cm2' } },
    }));
    if (!outcome.ok) throw new Error('propuesta inválida');
    const preparation = prepareProposal(baseProject(), HASH, outcome.value);
    if (!preparation.ok) throw new Error(preparation.reason);
    return preparation.prepared;
  };

  it('entrega el comando cuando todo coincide', () => {
    const result = confirmProposal(prepared(), { proposalId: UUID, snapshotHash: HASH }, HASH);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.command.kind).toBe('member.update');
  });

  it('rechaza una confirmación que nombra otra propuesta', () => {
    const result = confirmProposal(prepared(), { proposalId: '00000000-0000-4000-8000-000000000000', snapshotHash: HASH }, HASH);
    expect(result.ok).toBe(false);
  });

  it('rechaza una confirmación que nombra otro estado', () => {
    const result = confirmProposal(prepared(), { proposalId: UUID, snapshotHash: OTHER_HASH }, HASH);
    expect(result.ok).toBe(false);
  });

  it('rechaza si el proyecto cambió mientras se revisaba', () => {
    const result = confirmProposal(prepared(), { proposalId: UUID, snapshotHash: HASH }, OTHER_HASH);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('cambió');
  });
});

describe('proveedor local', () => {
  const request = (intent: string): ProposalRequest => ({
    intent,
    snapshotHash: HASH,
    memberIds: ['M1', 'M12'],
    sectionIds: standardSections.slice(0, 3).map((section) => section.id),
    materialIds: ['steel-a992'],
  });

  it('propone aplicar una sección del catálogo', async () => {
    const section = standardSections[0];
    const raw = await createLocalProposalProvider().propose(request(`aplica ${section.id} a M1`));
    const outcome = validateCommandProposal(raw);
    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.value.status === 'ready') {
      expect(outcome.value.operation).toEqual({ kind: 'member.section.apply', memberId: 'M1', sectionId: section.id });
    }
  });

  it('pregunta en vez de adivinar cuando no hay barra identificada', async () => {
    const raw = await createLocalProposalProvider().propose(request('sube la inercia un poco'));
    const outcome = validateCommandProposal(raw);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value.status).toBe('needs-clarification');
  });

  it('se niega cuando la petición no cae en la allowlist', async () => {
    const raw = await createLocalProposalProvider().propose(request('borra M1'));
    const outcome = validateCommandProposal(raw);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value.status).toBe('rejected');
  });

  it('no confunde M1 con M12', async () => {
    const raw = await createLocalProposalProvider().propose(request('pon E = 210 GPa en M12'));
    const outcome = validateCommandProposal(raw);
    expect(outcome.ok).toBe(true);
    if (outcome.ok && outcome.value.status === 'ready') expect(outcome.value.operation.memberId).toBe('M12');
  });

  it('lo que produce pasa el validador extremo a extremo y llega a comando', async () => {
    const raw = await createLocalProposalProvider().propose(request('pon E = 210 GPa en M1'));
    const outcome = validateCommandProposal(raw);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const preparation = prepareProposal(baseProject(), HASH, outcome.value);
    expect(preparation.ok, preparation.ok ? '' : preparation.reason).toBe(true);
    if (preparation.ok) expect(preparation.prepared.diff.changes[0].fields[0].field).toBe('E');
  });
});

describe('la frontera de red', () => {
  it('src/ai no contiene ninguna forma de salir del dispositivo', () => {
    const directory = path.resolve(import.meta.dirname);
    const forbidden = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /EventSource/, /sendBeacon/, /https?:\/\/[^\s'"`)]+/];
    const offenders: string[] = [];
    for (const file of readdirSync(directory).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))) {
      const source = readFileSync(path.join(directory, file), 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(source)) offenders.push(`${file}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('al proveedor sólo le llegan identificadores y la intención, nunca el modelo', () => {
    const project = baseProject();
    const request: ProposalRequest = {
      intent: 'lo que sea',
      snapshotHash: HASH,
      memberIds: project.members.map((member) => member.id),
      sectionIds: [],
      materialIds: [],
    };
    const serialized = JSON.stringify(request);
    // Ni el nombre del proyecto, ni coordenadas, ni cargas, ni propiedades.
    expect(serialized).not.toContain(project.name);
    expect(serialized).not.toContain('nodes');
    expect(serialized).not.toContain('nodalLoads');
    expect(Object.keys(request).sort()).toEqual(['intent', 'materialIds', 'memberIds', 'sectionIds', 'snapshotHash']);
  });
});
