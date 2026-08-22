import { describe, expect, it } from 'vitest';
import { findGeneratorFixture, generatorFixtures } from './generatorFixtures';
import { MAX_GENERATED_ENTITIES, generateStructure } from './structureGenerators';
import type { GeneratorParams } from './generatorTypes';

const PROPERTIES = { kind: 'explicit', E: 200e6, A: 0.01, I: 8e-5 } as const;

const beam = (overrides: Partial<Extract<GeneratorParams, { kind: 'continuous-beam' }>> = {}): GeneratorParams => ({
  kind: 'continuous-beam',
  spans: { kind: 'uniform', count: 2, spacing: 5 },
  properties: PROPERTIES,
  ...overrides,
});

describe('generateStructure · fixtures manuales', () => {
  it.each(generatorFixtures.map((fixture) => [fixture.id] as const))('reproduce el fixture %s', (id) => {
    const fixture = findGeneratorFixture(id);
    const structure = generateStructure(fixture.params);

    expect(structure.nodes.map((node) => [node.id, node.x, node.y])).toEqual(
      fixture.nodes.map((node) => [...node]),
    );
    expect(structure.members.map((member) => [member.id, member.i, member.j])).toEqual(
      fixture.members.map((member) => [...member]),
    );
    expect(structure.supportedNodeIds).toEqual(fixture.supportedNodeIds);
    expect(structure.warnings.map((warning) => warning.code)).toEqual(fixture.warningCodes);
  });

  it.each(generatorFixtures.map((fixture) => [fixture.id] as const))('%s es determinista', (id) => {
    const fixture = findGeneratorFixture(id);
    expect(generateStructure(structuredClone(fixture.params)))
      .toEqual(generateStructure(structuredClone(fixture.params)));
  });

  it.each(generatorFixtures.map((fixture) => [fixture.id] as const))('%s aplica el apoyo elegido y sólo ese', (id) => {
    const fixture = findGeneratorFixture(id);
    const structure = generateStructure(fixture.params);
    const supported = new Set(fixture.supportedNodeIds);

    for (const node of structure.nodes) {
      if (supported.has(node.id)) expect(node.support).toEqual(fixture.params.baseSupport);
      else expect(node.support).toEqual({ type: 'none' });
    }
  });
});

describe('generateStructure · roles y propiedades', () => {
  it('distingue columnas de vigas en un pórtico', () => {
    const structure = generateStructure(findGeneratorFixture('portal-frame-two-bays').params);
    expect(structure.memberRoles).toEqual({
      M1: 'column', M2: 'column', M3: 'column', M4: 'beam', M5: 'beam',
    });
    expect(structure.nodeRoles).toEqual({
      N1: 'base', N2: 'base', N3: 'base', N4: 'joint', N5: 'joint', N6: 'joint',
    });
  });

  it('distingue cordones, montantes y diagonales en una cercha', () => {
    const structure = generateStructure(findGeneratorFixture('truss-warren-four-panels').params);
    expect(structure.summary.memberCountsByRole).toEqual({
      'bottom-chord': 4, 'top-chord': 3, vertical: 2, diagonal: 4,
    });
    expect(structure.nodeRoles.N1).toBe('bottom-chord');
    expect(structure.nodeRoles.N6).toBe('top-chord');
  });

  it('crea miembros de tipo frame por defecto', () => {
    expect(generateStructure(beam()).members.every((member) => member.type === 'frame')).toBe(true);
  });

  it('crea cerchas con miembros de tipo truss por defecto', () => {
    const structure = generateStructure(findGeneratorFixture('truss-pratt-four-panels').params);
    expect(structure.members.every((member) => member.type === 'truss')).toBe(true);
  });

  it('respeta el tipo de miembro solicitado', () => {
    expect(generateStructure(beam({ memberType: 'truss' })).members.every((member) => member.type === 'truss')).toBe(true);
  });

  it('copia las propiedades de catálogo a cada miembro y las declara en el resumen', () => {
    const structure = generateStructure(beam({
      properties: { kind: 'catalog', materialId: 'steel-a992', sectionId: 'ipe-300' },
    }));

    for (const member of structure.members) {
      expect(member.materialId).toBe('steel-a992');
      expect(member.materialOrigin).toBe('catalog');
      expect(member.sectionId).toBe('ipe-300');
      expect(member.sectionOrigin).toBe('catalog');
      expect(member.A).toBe(0.00538);
    }
    expect(structure.summary.properties).toEqual({
      materialId: 'steel-a992', sectionId: 'ipe-300', E: 200000000, A: 0.00538, I: 0.0000836,
    });
  });

  it('no crea cargas de ningún tipo', () => {
    const structure = generateStructure(beam({ baseSupport: { type: 'pin' } }));
    expect(Object.keys(structure)).not.toContain('nodalLoads');
    expect(Object.keys(structure)).not.toContain('memberLoads');
  });
});

describe('generateStructure · resumen', () => {
  it('mide exactamente lo que se crearía', () => {
    const structure = generateStructure(findGeneratorFixture('continuous-beam-non-uniform').params);
    expect(structure.summary).toEqual({
      nodeCount: 4,
      memberCount: 3,
      supportedNodeCount: 0,
      memberCountsByRole: { beam: 3 },
      totalMemberLength: 15,
      bounds: { minX: 0, minY: 0, maxX: 15, maxY: 0 },
      properties: { E: 200e6, A: 0.01, I: 8e-5 },
    });
  });

  it('mide la longitud total incluyendo diagonales', () => {
    const structure = generateStructure({
      kind: 'truss',
      topology: 'pratt',
      panels: { kind: 'uniform', count: 2, spacing: 3 },
      depth: 4,
      properties: PROPERTIES,
    });
    // 2 cordones inferiores + 2 superiores de 3 m, 3 montantes de 4 m y 2 diagonales de 5 m.
    expect(structure.summary.totalMemberLength).toBe(12 + 12 + 10);
  });
});

describe('generateStructure · avisos', () => {
  it('avisa cuando el modelo queda sin apoyos', () => {
    expect(generateStructure(beam()).warnings).toEqual([{
      code: 'no-supports',
      message: 'La geometría se genera sin apoyos. Añádelos antes de analizar el modelo.',
    }]);
  });

  it('no avisa de apoyos cuando el usuario eligió uno', () => {
    expect(generateStructure(beam({ baseSupport: { type: 'pin' } })).warnings).toEqual([]);
  });

  it('trata un apoyo explícitamente nulo como ausencia de apoyos', () => {
    const structure = generateStructure(beam({ baseSupport: { type: 'none' } }));
    expect(structure.supportedNodeIds).toEqual([]);
    expect(structure.warnings.map((warning) => warning.code)).toEqual(['no-supports']);
  });

  it('avisa de nodos aislados cuando la retícula no crea miembros', () => {
    const structure = generateStructure({
      kind: 'grid',
      columns: { kind: 'uniform', count: 1, spacing: 4 },
      rows: { kind: 'uniform', count: 1, spacing: 3 },
      members: 'none',
      properties: PROPERTIES,
    });
    expect(structure.members).toEqual([]);
    expect(structure.warnings.map((warning) => warning.code)).toEqual(['no-supports', 'isolated-nodes']);
  });

  it('avisa cuando el modelo es grande', () => {
    const structure = generateStructure(beam({
      spans: { kind: 'uniform', count: 200, spacing: 1 },
      baseSupport: { type: 'pin' },
    }));
    expect(structure.warnings.map((warning) => warning.code)).toEqual(['large-model']);
  });
});

describe('generateStructure · validación de parámetros', () => {
  it('rechaza un origen no finito', () => {
    expect(() => generateStructure(beam({ origin: { x: Number.NaN, y: 0 } })))
      .toThrow('El origen X debe ser finito.');
  });

  it('rechaza una altura de pórtico no positiva', () => {
    expect(() => generateStructure({ kind: 'portal-frame', bays: { kind: 'uniform', count: 1, spacing: 5 }, height: 0, properties: PROPERTIES }))
      .toThrow('La altura debe ser un número finito mayor que cero.');
  });

  it('rechaza un peralte de cercha no positivo', () => {
    expect(() => generateStructure({ kind: 'truss', topology: 'pratt', panels: { kind: 'uniform', count: 2, spacing: 3 }, depth: -1, properties: PROPERTIES }))
      .toThrow('El peralte debe ser un número finito mayor que cero.');
  });

  it('rechaza vínculos rígidos', () => {
    expect(() => generateStructure(beam({ memberType: 'rigid' })))
      .toThrow('Los generadores no crean vínculos rígidos.');
  });

  it('rechaza un tipo de miembro desconocido', () => {
    expect(() => generateStructure(beam({ memberType: 'cable' as never })))
      .toThrow('El tipo de miembro no es válido.');
  });

  it('rechaza un apoyo desconocido', () => {
    expect(() => generateStructure(beam({ baseSupport: { type: 'flotante' as never } })))
      .toThrow('El tipo de apoyo no es válido.');
  });

  it('rechaza una topología de cercha desconocida', () => {
    expect(() => generateStructure({ kind: 'truss', topology: 'fink' as never, panels: { kind: 'uniform', count: 2, spacing: 3 }, depth: 2, properties: PROPERTIES }))
      .toThrow('La topología de cercha no es válida.');
  });

  it('rechaza un modo de miembros de retícula desconocido', () => {
    expect(() => generateStructure({ kind: 'grid', columns: { kind: 'uniform', count: 1, spacing: 4 }, rows: { kind: 'uniform', count: 1, spacing: 3 }, members: 'diagonal' as never, properties: PROPERTIES }))
      .toThrow('El modo de miembros de la retícula no es válido.');
  });

  it('rechaza una familia desconocida', () => {
    expect(() => generateStructure({ kind: 'domo', properties: PROPERTIES } as never))
      .toThrow('El generador solicitado no es válido.');
  });

  it('nombra el eje al validar una separación inválida', () => {
    expect(() => generateStructure({ kind: 'multi-story-frame', bays: { kind: 'uniform', count: 2, spacing: 5 }, stories: { kind: 'list', values: [3, 0] }, properties: PROPERTIES }))
      .toThrow('Niveles: la separación 2 debe ser un número finito mayor que cero.');
  });

  it('rechaza una geometría por encima del presupuesto de entidades', () => {
    expect(() => generateStructure({
      kind: 'grid',
      columns: { kind: 'uniform', count: 60, spacing: 1 },
      rows: { kind: 'uniform', count: 60, spacing: 1 },
      properties: PROPERTIES,
    })).toThrow(`La geometría generada excede el límite de ${MAX_GENERATED_ENTITIES.toLocaleString('es-MX')} entidades. Reduce las divisiones.`);
  });
});
