import { describe, expect, it } from 'vitest';
import { generateStructure } from '../../data/generators/structureGenerators';
import { MAX_SPACING_DIVISIONS } from '../../data/generators/generatorSpacing';
import type { UnitSystemId } from '../../types';
import {
  DEFAULT_GENERATOR_FORM,
  GENERATOR_SPACING_FIELDS,
  buildGeneratorParams,
  explicitPropertiesFromCatalog,
  generatorParamsSignature,
  parseSpacingDraft,
  parseSpacingList,
  spacingDraftDivisions,
  type GeneratorFormParseResult,
  type GeneratorFormState,
  type GeneratorSpacingDraft,
} from './structureGeneratorForm';

/** Las unidades internas coinciden con `kN-m`, así que aquí lo tecleado es lo generado. */
const UNITS: UnitSystemId = 'kN-m';

const form = (overrides: Partial<GeneratorFormState>): GeneratorFormState =>
  ({ ...DEFAULT_GENERATOR_FORM, ...overrides });

const uniform = (count: string, spacing: string): GeneratorSpacingDraft =>
  ({ mode: 'uniform', count, spacing, list: '' });

const list = (values: string): GeneratorSpacingDraft =>
  ({ mode: 'list', count: '3', spacing: '5', list: values });

const build = (overrides: Partial<GeneratorFormState>, units: UnitSystemId = UNITS) =>
  buildGeneratorParams(form(overrides), units);

const expectOk = (result: GeneratorFormParseResult) => {
  if (!result.ok) throw new Error(`Se esperaban parámetros válidos: ${JSON.stringify(result.errors)}`);
  return result.params;
};

const expectErrors = (result: GeneratorFormParseResult) => {
  if (result.ok) throw new Error('Se esperaban errores de formulario.');
  return result.errors;
};

describe('separaciones capturadas', () => {
  it('resuelve una separación uniforme', () => {
    expect(parseSpacingDraft(uniform('3', '5'))).toEqual({ ok: true, spec: { kind: 'uniform', count: 3, spacing: 5 } });
  });

  it('acepta coma decimal en la separación uniforme', () => {
    const parsed = parseSpacingDraft(uniform('2', '3,5'));
    expect(parsed.ok && parsed.spec).toEqual({ kind: 'uniform', count: 2, spacing: 3.5 });
  });

  it('resuelve una lista no uniforme con cualquiera de los separadores admitidos', () => {
    for (const text of ['4, 5, 4', '4 5 4', '4;5;4', '4\n5\n4']) {
      const parsed = parseSpacingDraft(list(text));
      expect(parsed.ok && parsed.spec).toEqual({ kind: 'list', values: [4, 5, 4] });
    }
  });

  it('rechaza una lista vacía, un cero y un texto que no es número', () => {
    expect(parseSpacingDraft(list('   ')).ok).toBe(false);
    const zero = parseSpacingDraft(list('4, 0, 4'));
    expect(zero.ok).toBe(false);
    // El mensaje señala cuál de las separaciones falla, no sólo que alguna lo hace.
    expect(!zero.ok && zero.error).toContain('2');
    expect(parseSpacingDraft(list('4, x, 4')).ok).toBe(false);
  });

  it('rechaza cantidades no enteras, menores que uno y por encima del tope del núcleo', () => {
    expect(parseSpacingDraft(uniform('2.5', '5')).ok).toBe(false);
    expect(parseSpacingDraft(uniform('0', '5')).ok).toBe(false);
    expect(parseSpacingDraft(uniform(String(MAX_SPACING_DIVISIONS + 1), '5')).ok).toBe(false);
    expect(parseSpacingDraft(uniform(String(MAX_SPACING_DIVISIONS), '5')).ok).toBe(true);
  });

  it('cuenta divisiones sólo cuando la separación es resoluble', () => {
    expect(spacingDraftDivisions(uniform('4', '5'))).toBe(4);
    expect(spacingDraftDivisions(list('4, 5, 4'))).toBe(3);
    expect(spacingDraftDivisions(list(''))).toBeNull();
  });

  it('ignora tokens vacíos, como los que deja pegar una columna de una hoja', () => {
    expect(parseSpacingList('4,5,')).toEqual([4, 5]);
  });

  it('conserva los dos modos, para que alternar no borre lo escrito', () => {
    const draft: GeneratorSpacingDraft = { mode: 'uniform', count: '3', spacing: '5', list: '4, 6, 4' };
    expect(parseSpacingDraft(draft).ok && parseSpacingDraft(draft)).toMatchObject({ spec: { kind: 'uniform' } });
    expect(parseSpacingDraft({ ...draft, mode: 'list' })).toMatchObject({ spec: { kind: 'list', values: [4, 6, 4] } });
  });
});

describe('parámetros por familia', () => {
  it('cada familia declara exactamente las separaciones que su núcleo consume', () => {
    expect(GENERATOR_SPACING_FIELDS['continuous-beam']).toEqual(['spans']);
    expect(GENERATOR_SPACING_FIELDS['portal-frame']).toEqual(['bays']);
    expect(GENERATOR_SPACING_FIELDS['multi-story-frame']).toEqual(['bays', 'stories']);
    expect(GENERATOR_SPACING_FIELDS.truss).toEqual(['panels']);
    expect(GENERATOR_SPACING_FIELDS.grid).toEqual(['columns', 'rows']);
  });

  it('construye una viga continua con separaciones irregulares', () => {
    const params = expectOk(build({ family: 'continuous-beam', spans: list('4, 6, 4') }));
    expect(params).toMatchObject({ kind: 'continuous-beam', spans: { kind: 'list', values: [4, 6, 4] } });
    expect(generateStructure(params).summary.nodeCount).toBe(4);
  });

  it('construye un pórtico con altura explícita', () => {
    expect(expectOk(build({ family: 'portal-frame', height: '4.5' }))).toMatchObject({ kind: 'portal-frame', height: 4.5 });
  });

  it('construye un marco de varios niveles con crujías y niveles independientes', () => {
    expect(expectOk(build({ family: 'multi-story-frame', bays: list('6, 4'), stories: list('4, 3, 3') }))).toMatchObject({
      kind: 'multi-story-frame',
      bays: { kind: 'list', values: [6, 4] },
      stories: { kind: 'list', values: [4, 3, 3] },
    });
  });

  it('construye las tres topologías de cercha y respeta los montantes de la Warren', () => {
    for (const topology of ['pratt', 'warren', 'howe'] as const) {
      expect(expectOk(build({ family: 'truss', topology, includeVerticals: false })))
        .toMatchObject({ kind: 'truss', topology, includeVerticals: false });
    }
  });

  it('construye una retícula con el modo de miembros elegido', () => {
    expect(expectOk(build({ family: 'grid', gridMembers: 'horizontal' }))).toMatchObject({ kind: 'grid', members: 'horizontal' });
  });

  it('lee sólo los campos de la familia activa', () => {
    // El peralte en blanco pertenece a la cercha: generar una viga no puede
    // fallar por un campo que esa familia ni siquiera muestra.
    expect(build({ family: 'continuous-beam', depth: '', height: 'x' }).ok).toBe(true);
  });

  it('señala el campo exacto que impide construir la familia activa', () => {
    expect(Object.keys(expectErrors(build({ family: 'truss', depth: '0' })))).toEqual(['depth']);
    expect(Object.keys(expectErrors(build({ family: 'portal-frame', height: '' })))).toEqual(['height']);
    expect(Object.keys(expectErrors(build({ family: 'grid', rows: list('') })))).toEqual(['rows']);
  });
});

describe('origen, apoyos y propiedades', () => {
  it('traslada la geometría al origen elegido', () => {
    const params = expectOk(build({ originX: '10', originY: '-2.5' }));
    expect(params.origin).toEqual({ x: 10, y: -2.5 });
    expect(generateStructure(params).nodes[0]).toMatchObject({ x: 10, y: -2.5 });
  });

  it('rechaza un origen que no es número, sin tocar el resto del formulario', () => {
    const errors = expectErrors(build({ originX: 'abc' }));
    expect(errors.originX).toBeTruthy();
    expect(errors.originY).toBeUndefined();
  });

  it('no declara ningún apoyo por defecto', () => {
    expect(DEFAULT_GENERATOR_FORM.support).toBe('none');
    const params = expectOk(buildGeneratorParams(DEFAULT_GENERATOR_FORM, UNITS));
    expect(params.baseSupport).toBeUndefined();
    expect(generateStructure(params).supportedNodeIds).toEqual([]);
  });

  it('aplica el apoyo sólo cuando se elige explícitamente', () => {
    const params = expectOk(build({ family: 'portal-frame', support: 'fixed' }));
    expect(params.baseSupport).toEqual({ type: 'fixed' });
    expect(generateStructure(params).supportedNodeIds.length).toBeGreaterThan(0);
  });

  it('no genera cargas ni apoyos silenciosos en ninguna familia', () => {
    for (const family of ['continuous-beam', 'portal-frame', 'multi-story-frame', 'truss', 'grid'] as const) {
      const structure = generateStructure(expectOk(build({ family })));
      expect(structure.nodes.every((node) => node.support.type === 'none')).toBe(true);
      expect(Object.keys(structure)).not.toContain('loads');
    }
  });

  it('toma los números del catálogo cuando la identidad es de catálogo', () => {
    const params = expectOk(build({ propertiesSource: 'catalog' }));
    expect(params.properties).toEqual({ kind: 'catalog', materialId: 'steel-a992', sectionId: 'w12x53' });
    expect(generateStructure(params).summary.properties.materialId).toBe('steel-a992');
  });

  it('rechaza una identidad de catálogo inexistente en el campo que la produjo', () => {
    const errors = expectErrors(build({ materialId: 'no-existe', sectionId: 'tampoco' }));
    expect(errors.materialId).toBeTruthy();
    expect(errors.sectionId).toBeTruthy();
  });

  it('marca como custom las propiedades explícitas', () => {
    const params = expectOk(build({
      propertiesSource: 'explicit',
      elasticModulus: '200000',
      area: '0.02',
      inertia: '0.0004',
    }));
    // `kN-m` muestra E en MPa; internamente son kN/m².
    expect(params.properties).toEqual({ kind: 'explicit', E: 200_000_000, A: 0.02, I: 0.0004 });
    const structure = generateStructure(params);
    expect(structure.members[0].materialOrigin).toBe('custom');
    expect(structure.summary.properties.materialId).toBeUndefined();
  });

  it('exige que E, A e I sean mayores que cero', () => {
    const errors = expectErrors(build({
      propertiesSource: 'explicit',
      elasticModulus: '0',
      area: '-1',
      inertia: '',
    }));
    expect(Object.keys(errors).sort()).toEqual(['area', 'elasticModulus', 'inertia']);
  });

  it('personalizar parte de los números que el catálogo ya resolvía', () => {
    const seeded = explicitPropertiesFromCatalog('steel-a992', 'w12x53', UNITS);
    if (!seeded) throw new Error('El catálogo por defecto debería resolverse.');
    const custom = expectOk(build({ propertiesSource: 'explicit', ...seeded }));
    const catalog = expectOk(build({ propertiesSource: 'catalog' }));
    const numbers = (result: typeof custom) => {
      const summary = generateStructure(result).summary.properties;
      return { E: summary.E, A: summary.A, I: summary.I };
    };
    expect(numbers(custom)).toEqual(numbers(catalog));
  });

  it('no siembra nada cuando la identidad de catálogo no existe', () => {
    expect(explicitPropertiesFromCatalog('no-existe', 'w12x53', UNITS)).toBeNull();
  });
});

describe('unidades', () => {
  it('convierte a unidades internas lo que se teclea en las de pantalla', () => {
    // 10 ft y 20 ft en `kip-ft` son 3.048 m y 6.096 m internos.
    const params = expectOk(build({ family: 'continuous-beam', originX: '10', spans: uniform('1', '20') }, 'kip-ft'));
    expect(params.origin!.x).toBeCloseTo(3.048, 9);
    expect(generateStructure(params).summary.bounds.maxX).toBeCloseTo(3.048 + 6.096, 6);
  });

  it('convierte también las listas no uniformes y los peraltes', () => {
    const params = expectOk(build({ family: 'truss', panels: list('1000, 2000'), depth: '500' }, 'N-mm'));
    expect(params).toMatchObject({ kind: 'truss', panels: { kind: 'list', values: [1, 2] }, depth: 0.5 });
  });

  it('convierte E, A e I con su propia magnitud', () => {
    const params = expectOk(build({
      propertiesSource: 'explicit',
      elasticModulus: '200000',
      area: '1000',
      inertia: '1000000',
    }, 'N-mm'));
    expect(params.properties).toMatchObject({ kind: 'explicit', E: 200_000_000, A: 1e-3, I: 1e-6 });
  });

  it('el mismo dibujo en dos sistemas distintos no produce la misma geometría', () => {
    const metric = expectOk(build({ spans: uniform('2', '5') }, 'kN-m'));
    const imperial = expectOk(build({ spans: uniform('2', '5') }, 'kip-ft'));
    expect(generatorParamsSignature(imperial)).not.toBe(generatorParamsSignature(metric));
  });
});

describe('determinismo de la traducción', () => {
  it('el mismo formulario produce siempre los mismos parámetros', () => {
    const first = expectOk(build({ family: 'truss', panels: list('1.5, 2, 1.5') }));
    const second = expectOk(build({ family: 'truss', panels: list('1.5, 2, 1.5') }));
    expect(generatorParamsSignature(first)).toBe(generatorParamsSignature(second));
  });

  it('un cambio que el núcleo no puede ver no cambia la firma', () => {
    const plain = expectOk(build({ spans: uniform('3', '5') }));
    const padded = expectOk(build({ spans: uniform(' 3 ', ' 5.0 ') }));
    expect(generatorParamsSignature(padded)).toBe(generatorParamsSignature(plain));
  });

  it('un cambio real sí la cambia', () => {
    const three = expectOk(build({ spans: uniform('3', '5') }));
    const four = expectOk(build({ spans: uniform('4', '5') }));
    expect(generatorParamsSignature(four)).not.toBe(generatorParamsSignature(three));
  });

  it('los valores iniciales ya generan una geometría válida en toda familia', () => {
    for (const family of ['continuous-beam', 'portal-frame', 'multi-story-frame', 'truss', 'grid'] as const) {
      expect(() => generateStructure(expectOk(build({ family })))).not.toThrow();
    }
  });
});
