import { describe, expect, it } from 'vitest';
import { createDefaultProject, CURRENT_SCHEMA_VERSION } from './defaultProject';
import { normalizeProject } from './migrate';

describe('project schema migration and validation', () => {
  it('preserves explicit identity from the current schema without consulting numeric equality', () => {
    const source = createDefaultProject();
    const member = source.members[0] as typeof source.members[number] & Record<string, unknown>;
    Object.assign(member, {
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog',
    });

    const normalized = normalizeProject(JSON.parse(JSON.stringify(source)));

    expect(normalized.members[0]).toMatchObject({
      materialId: 'steel-a992', materialOrigin: 'catalog',
      sectionId: 'ipe-300', sectionOrigin: 'catalog',
    });
  });

  it('marks legacy members explicitly and never identifies catalog presets from matching floats', () => {
    const source = createDefaultProject();
    const legacy = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
    legacy.schemaVersion = 5;
    const member = (legacy.members as Array<Record<string, unknown>>)[0];
    member.E = 200_000_000;
    member.G = 76_923_076.9231;
    member.density = 7850;
    member.A = 0.00538;
    member.I = 0.0000836;
    delete member.materialId;
    delete member.materialOrigin;
    delete member.sectionId;
    delete member.sectionOrigin;

    const normalized = normalizeProject(legacy);

    expect(normalized.members[0]).toMatchObject({ materialOrigin: 'legacy', sectionOrigin: 'legacy' });
    expect(normalized.members[0]).not.toHaveProperty('materialId');
    expect(normalized.members[0]).not.toHaveProperty('sectionId');
  });

  it('upgrades a v2 project and preserves v3 hinge and rigid offset data', () => {
    const source = createDefaultProject();
    const legacy = {
      ...source,
      schemaVersion: 2,
      nodes: source.nodes.map((node, index) => index === 2 ? { ...node, internalHinge: true } : node),
      members: source.members.map((member, index) => index === 1
        ? { ...member, rigidOffsetI: 0.2, rigidOffsetJ: 0.1 }
        : member),
      settings: { ...source.settings, language: 'en' },
    };
    const result = normalizeProject(legacy);

    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.nodes[2].internalHinge).toBe(true);
    expect(result.members[1].rigidOffsetI).toBe(0.2);
    expect(result.settings.language).toBe('en');
  });

  it('preserva y valida assertions educativas estructuradas', () => {
    const source = createDefaultProject();
    source.educationalCase = {
      kind: 'original-practice', sourceTitle: 'Prueba propia', chapter: 'Control', note: 'Caso verificable', expectedResults: [],
      expectedAssertions: [{ id: 'RA', label: 'Reacción A', target: { kind: 'node-result', nodeId: source.nodes[0].id, component: 'ry' }, expected: 12, atol: 1e-8, rtol: 1e-7 }],
    };
    const normalized = normalizeProject(source);
    expect(normalized.educationalCase?.expectedAssertions).toEqual(source.educationalCase.expectedAssertions);

    source.educationalCase.expectedAssertions![0].target = { kind: 'node-result', nodeId: 'missing', component: 'ry' };
    expect(() => normalizeProject(source)).toThrow(/educationalCase\.expectedAssertions\[0\]\.target\.nodeId/);
  });

  it('rejects projects written by a future incompatible schema', () => {
    expect(() => normalizeProject({
      ...createDefaultProject(),
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
    })).toThrow(/más nueva/);
  });

  it('rejects non-finite values, invalid enums and broken references with a field path', () => {
    const nonFinite = createDefaultProject();
    nonFinite.nodes[0].x = Number.NaN;
    expect(() => normalizeProject(nonFinite)).toThrow(/nodes\[0\]\.x/);

    const badUnit = createDefaultProject() as unknown as Record<string, unknown>;
    badUnit.settings = { ...(badUnit.settings as object), units: 'banana' };
    expect(() => normalizeProject(badUnit)).toThrow(/settings\.units/);

    const missingNode = createDefaultProject();
    missingNode.members[0].i = 'DOES-NOT-EXIST';
    expect(() => normalizeProject(missingNode)).toThrow(/members\[0\]\.i/);
  });

  it('rejects duplicated stable identifiers', () => {
    const project = createDefaultProject();
    project.nodes[1].id = project.nodes[0].id;
    expect(() => normalizeProject(project)).toThrow(/repetido/);
  });

  it('canonicalizes a reversed distributed interval and swaps end intensities', () => {
    const project = createDefaultProject();
    const load = project.memberLoads[0];
    load.start = 0.8;
    load.end = 0.2;
    load.qyStart = -2;
    load.qyEnd = -8;
    const normalized = normalizeProject(project);
    const result = normalized.memberLoads[0];

    expect(result.start).toBe(0.2);
    expect(result.end).toBe(0.8);
    expect(result.qyStart).toBe(-8);
    expect(result.qyEnd).toBe(-2);
  });

  it('rechaza URLs ejecutables y textos sobredimensionados en la frontera de importación', () => {
    const unsafeUrl = createDefaultProject();
    unsafeUrl.combinations[0].sourceUrl = 'javascript:alert(1)';
    expect(() => normalizeProject(unsafeUrl)).toThrow(/solo se permiten URLs http o https/);

    const oversized = createDefaultProject();
    oversized.name = 'x'.repeat(20_001);
    expect(() => normalizeProject(oversized)).toThrow(/excede 20000 caracteres/);
  });
});

describe('P-Delta settings survive normalization', () => {
  it('conserva analysisMode y pDeltaConfig al recargar, importar o deshacer', () => {
    // Sin esto, `normalizeProject` los descartaba en silencio y todo proyecto
    // reabierto volvía a primer orden con el selector aún en P-Delta.
    const source = createDefaultProject();
    const configured = {
      ...source,
      settings: {
        ...source.settings,
        analysisMode: 'p-delta' as const,
        pDeltaConfig: { maxLoadSteps: 20, minimumStep: 1 / 128 },
      },
    };
    const normalized = normalizeProject(JSON.parse(JSON.stringify(configured)));
    expect(normalized.settings.analysisMode).toBe('p-delta');
    expect(normalized.settings.pDeltaConfig).toEqual({ maxLoadSteps: 20, minimumStep: 1 / 128 });
  });

  it('un proyecto sin ajustes P-Delta sigue siendo válido y de primer orden', () => {
    const normalized = normalizeProject(JSON.parse(JSON.stringify(createDefaultProject())));
    expect(normalized.settings.analysisMode).toBeUndefined();
    expect(normalized.settings.pDeltaConfig).toBeUndefined();
  });

  it('rechaza un analysisMode desconocido en vez de aceptarlo', () => {
    const source = createDefaultProject();
    const broken = { ...source, settings: { ...source.settings, analysisMode: 'segundo-orden' } };
    expect(() => normalizeProject(JSON.parse(JSON.stringify(broken)))).toThrow();
  });
});
