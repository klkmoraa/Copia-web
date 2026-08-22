import { describe, expect, it } from 'vitest';
import { generateStructure } from '../../data/generators/structureGenerators';
import type { GeneratorParams } from '../../data/generators/generatorTypes';
import type { UnitSystemId } from '../../types';
import {
  DEFAULT_GENERATOR_FORM,
  buildGeneratorParams,
  type GeneratorFormState,
} from './structureGeneratorForm';
import {
  buildGeneratorSummaryRows,
  countGeneratorDecisions,
  presentGeneratorWarnings,
} from './structureGeneratorSummary';

const UNITS: UnitSystemId = 'kN-m';

const paramsFor = (overrides: Partial<GeneratorFormState>, units: UnitSystemId = UNITS): GeneratorParams => {
  const result = buildGeneratorParams({ ...DEFAULT_GENERATOR_FORM, ...overrides }, units);
  if (!result.ok) throw new Error(`Parámetros inválidos: ${JSON.stringify(result.errors)}`);
  return result.params;
};

const rowsFor = (overrides: Partial<GeneratorFormState>, units: UnitSystemId = UNITS) =>
  buildGeneratorSummaryRows(generateStructure(paramsFor(overrides, units)).summary, units, 'es');

const valueOf = (rows: ReturnType<typeof buildGeneratorSummaryRows>, id: string) =>
  rows.find((row) => row.id === id)?.value;

describe('resumen exacto previo', () => {
  it('cuenta exactamente lo que la geometría contiene', () => {
    const structure = generateStructure(paramsFor({ family: 'portal-frame' }));
    const rows = buildGeneratorSummaryRows(structure.summary, UNITS, 'es');
    expect(valueOf(rows, 'nodes')).toBe(String(structure.nodes.length));
    expect(valueOf(rows, 'members')).toBe(String(structure.members.length));
  });

  it('desglosa las barras por rol, y sólo los roles presentes', () => {
    const detail = rowsFor({ family: 'truss' }).find((row) => row.id === 'members')?.detail ?? '';
    expect(detail).toContain('Cordón superior');
    expect(detail).toContain('Diagonales');
    expect(detail).not.toContain('Columnas');
  });

  it('dice «Ninguno» cuando no se pidió ningún apoyo, en vez de un cero suelto', () => {
    expect(valueOf(rowsFor({}), 'supports')).toBe('Ninguno');
    // Dos crujías son tres columnas, y por tanto tres nudos de base apoyados.
    expect(valueOf(rowsFor({ family: 'portal-frame', support: 'pin' }), 'supports')).toBe('3');
  });

  it('expresa longitudes y extensión en las unidades del proyecto', () => {
    const metric = rowsFor({ family: 'continuous-beam' }, 'kN-m');
    expect(valueOf(metric, 'extent')).toContain('m');
    // Los mismos 5 m tecleados en pies son otra geometría, y la extensión lo dice.
    const imperial = rowsFor({ family: 'continuous-beam' }, 'kip-ft');
    expect(valueOf(imperial, 'extent')).toContain('ft');
    expect(valueOf(imperial, 'extent')).not.toBe(valueOf(metric, 'extent'));
  });

  it('nombra la identidad de catálogo aplicada', () => {
    const rows = rowsFor({ propertiesSource: 'catalog' });
    expect(valueOf(rows, 'material')).toBe('steel-a992');
    expect(valueOf(rows, 'section')).toBe('w12x53');
    expect(rows.find((row) => row.id === 'custom-properties')).toBeUndefined();
  });

  it('enseña E, A e I cuando las propiedades son personalizadas', () => {
    const rows = rowsFor({
      propertiesSource: 'explicit',
      elasticModulus: '200000',
      area: '0.01',
      inertia: '0.0002',
    });
    expect(rows.find((row) => row.id === 'material')).toBeUndefined();
    const custom = valueOf(rows, 'custom-properties') ?? '';
    expect(custom).toContain('E ');
    expect(custom).toContain('MPa');
    expect(custom).toContain('m²');
  });

  it('traduce las etiquetas al idioma del proyecto', () => {
    const summary = generateStructure(paramsFor({})).summary;
    const spanish = buildGeneratorSummaryRows(summary, UNITS, 'es');
    const english = buildGeneratorSummaryRows(summary, UNITS, 'en');
    expect(spanish.find((row) => row.id === 'nodes')?.label).toBe('Nudos');
    expect(english.find((row) => row.id === 'nodes')?.label).toBe('Nodes');
    // Las filas y su orden son los mismos; sólo cambia el texto.
    expect(english.map((row) => row.id)).toEqual(spanish.map((row) => row.id));
  });
});

describe('avisos', () => {
  it('conserva el mensaje del núcleo y le pone un título traducible', () => {
    const warnings = generateStructure(paramsFor({})).warnings;
    const presented = presentGeneratorWarnings(warnings, 'es');
    const noSupports = presented.find((warning) => warning.code === 'no-supports');
    expect(noSupports?.title).toBe('Sin apoyos');
    expect(noSupports?.message).toBe(warnings.find((warning) => warning.code === 'no-supports')?.message);
    expect(presentGeneratorWarnings(warnings, 'en').find((w) => w.code === 'no-supports')?.title).toBe('No supports');
  });

  it('separa lo que exige una decisión de lo que sólo informa', () => {
    const truss = generateStructure(paramsFor({ family: 'truss', panels: { mode: 'list', count: '3', spacing: '5', list: '1, 2, 1' } }));
    const presented = presentGeneratorWarnings(truss.warnings, 'es');
    expect(presented.find((warning) => warning.code === 'no-supports')?.tone).toBe('decision');
    expect(presented.find((warning) => warning.code === 'non-uniform-truss-panels')?.tone).toBe('info');
  });

  it('cuenta sólo los avisos que piden una decisión', () => {
    const withoutSupports = generateStructure(paramsFor({ family: 'portal-frame' })).warnings;
    expect(countGeneratorDecisions(withoutSupports)).toBe(1);
    const withSupports = generateStructure(paramsFor({ family: 'portal-frame', support: 'pin' })).warnings;
    expect(countGeneratorDecisions(withSupports)).toBe(0);
  });

  it('presenta también los avisos que sólo existen al insertar en un proyecto', () => {
    const presented = presentGeneratorWarnings(
      [{ code: 'coincident-with-existing', message: 'Un nodo generado cae sobre un nodo existente.' }],
      'es',
    );
    expect(presented[0]).toMatchObject({ tone: 'decision', title: 'Nudos coincidentes' });
  });
});
