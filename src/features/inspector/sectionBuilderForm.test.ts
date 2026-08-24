import { describe, expect, it } from 'vitest';
import { buildSection, type BuiltSectionShape } from '../../data/sectionBuilder';
import { standardSections } from '../../data/standardSections';
import {
  DEFAULT_SECTION_DIMENSIONS,
  SECTION_BUILDER_KINDS,
  SECTION_DIMENSION_KEYS,
  SECTION_SHAPE_TYPE_OF_KIND,
  previewGeometryOf,
  sectionBuilderIssue,
  seedFromStandardSection,
  shapeFromDimensions,
  type SectionDimensions,
} from './sectionBuilderForm';

const withDimension = (
  base: SectionDimensions,
  overrides: Partial<SectionDimensions>,
): SectionDimensions => ({ ...base, ...overrides });

describe('el motivo y el constructor dicen lo mismo', () => {
  /**
   * La malla: para cada forma, cada cota recorre una tira de valores que cruza
   * las fronteras interesantes —cero, negativo, no finito, y valores que hacen
   * que las alas se coman el canto o que el espesor cierre el hueco—. Es
   * deliberadamente más ancha que las combinaciones válidas: la mitad del
   * contrato es que un motivo aparezca sólo cuando el constructor lanza.
   */
  const probes = [Number.NaN, -0.05, 0, 1e-6, 0.004, 0.02, 0.08, 0.15, 0.3, 0.9];

  it.each(SECTION_BUILDER_KINDS.map((kind) => [kind] as const))(
    'hay motivo si y sólo si buildSection lanza · %s',
    (kind) => {
      let checked = 0;
      let refused = 0;
      for (const key of SECTION_DIMENSION_KEYS[kind]) {
        for (const value of probes) {
          const shape = shapeFromDimensions(kind, withDimension(DEFAULT_SECTION_DIMENSIONS, { [key]: value }));
          const issue = sectionBuilderIssue(shape);
          let threw = false;
          try { buildSection(shape); } catch { threw = true; }
          expect(Boolean(issue), `${kind} · ${key} = ${value} · motivo=${issue ?? 'ninguno'} · lanza=${threw}`)
            .toBe(threw);
          checked += 1;
          if (threw) refused += 1;
        }
      }
      // Una malla que nunca llega a una geometría imposible no probaría nada.
      expect(checked).toBeGreaterThan(0);
      expect(refused).toBeGreaterThan(0);
    },
  );

  it('nombra el motivo concreto, no uno cualquiera', () => {
    const issueOf = (shape: BuiltSectionShape) => sectionBuilderIssue(shape);
    expect(issueOf({ kind: 'rectangle', depth: 0, width: 0.2 })).toBe('non-positive');
    expect(issueOf({ kind: 'i-shape', depth: 0.02, width: 0.15, webThickness: 0.007, flangeThickness: 0.011 }))
      .toBe('flanges-consume-depth');
    expect(issueOf({ kind: 'i-shape', depth: 0.3, width: 0.006, webThickness: 0.007, flangeThickness: 0.011 }))
      .toBe('web-wider-than-flange');
    expect(issueOf({ kind: 'angle', depth: 0.1, width: 0.06, thickness: 0.06 })).toBe('thickness-consumes-leg');
    expect(issueOf({ kind: 'box', depth: 0.3, width: 0.2, thickness: 0.15 })).toBe('thickness-closes-hole');
    expect(issueOf({ kind: 'tube', outerDiameter: 0.1, thickness: 0.05 })).toBe('thickness-closes-tube');
  });

  it('acepta la sección con la que arranca el formulario', () => {
    for (const kind of SECTION_BUILDER_KINDS) {
      const shape = shapeFromDimensions(kind, DEFAULT_SECTION_DIMENSIONS);
      expect(sectionBuilderIssue(shape), kind).toBeUndefined();
      expect(buildSection(shape).area, kind).toBeGreaterThan(0);
    }
  });
});

describe('arrancar desde un perfil del catálogo', () => {
  it('reproduce el área del perfil dentro de la tolerancia que su forma admite', () => {
    /* No es una segunda comprobación de las fórmulas —de eso se encarga
       `sectionBuilder.test.ts` sobre el catálogo entero—, sino de que la semilla
       llega **con las cotas del perfil elegido** y no con las de otro. Un 12 %
       es holgado para el margen real (≤ 5,5 %) y estrecho para confundir un
       perfil con cualquier otro del catálogo. */
    for (const section of standardSections) {
      const seed = seedFromStandardSection(section);
      const built = buildSection(shapeFromDimensions(seed.kind, seed.dimensions));
      expect(Math.abs(built.area - section.area) / section.area, section.name).toBeLessThan(0.12);
    }
  });

  it('conserva por defecto las cotas que la forma elegida no usa', () => {
    const pipe = standardSections.find((section) => section.shapeType === 'HSS_ROUND');
    expect(pipe).toBeDefined();
    const seed = seedFromStandardSection(pipe!);
    expect(seed.kind).toBe('tube');
    // Un tubo no tiene ala: su espesor no puede filtrarse al campo del ala.
    expect(seed.dimensions.flangeThickness).toBe(DEFAULT_SECTION_DIMENSIONS.flangeThickness);
    expect(seed.dimensions.outerDiameter).toBe(pipe!.depth);
  });

  it('traduce cada tipo del catálogo a la forma que le corresponde', () => {
    const kindByShapeType = new Map(standardSections.map((section) => [
      section.shapeType,
      seedFromStandardSection(section).kind,
    ]));
    expect(Object.fromEntries(kindByShapeType)).toEqual({
      I: 'i-shape', C: 'channel', L: 'angle', HSS_RECT: 'box', HSS_ROUND: 'tube', RECT: 'rectangle',
    });
  });
});

describe('vista previa', () => {
  it('devuelve el tipo dibujable de cada forma, sin estrenar dibujo', () => {
    expect(new Set(Object.values(SECTION_SHAPE_TYPE_OF_KIND)))
      .toEqual(new Set(['RECT', 'I', 'C', 'L', 'HSS_RECT', 'HSS_ROUND']));
  });

  it('toma las cotas de la descripción y no de A e I', () => {
    const dimensions = withDimension(DEFAULT_SECTION_DIMENSIONS, { webThickness: 0.02, flangeThickness: 0.03 });
    const geometry = previewGeometryOf('i-shape', dimensions);
    expect(geometry).toEqual({ depth: 0.3, width: 0.15, web: 0.02, flange: 0.03 });
    // El tubo es cuadrado en su caja: el diámetro manda en las dos direcciones.
    const tube = previewGeometryOf('tube', withDimension(DEFAULT_SECTION_DIMENSIONS, { outerDiameter: 0.2 }));
    expect(tube.depth).toBe(0.2);
    expect(tube.width).toBe(0.2);
  });

  it('nunca publica una cota nula que un cambio de forma tomaría por escrita', () => {
    for (const kind of SECTION_BUILDER_KINDS) {
      const geometry = previewGeometryOf(kind, DEFAULT_SECTION_DIMENSIONS);
      for (const [key, value] of Object.entries(geometry)) {
        expect(value, `${kind} · ${key}`).toBeGreaterThan(0);
      }
    }
  });
});
