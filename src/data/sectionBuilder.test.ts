import { describe, expect, it } from 'vitest';
import { buildSection, propertiesOfRectangles, rectanglesOf, type BuiltSectionShape } from './sectionBuilder';
import { standardSections, type StandardSection } from './standardSections';

describe('núcleo geométrico', () => {
  it('reproduce el rectángulo macizo, cuyas propiedades son exactas', () => {
    const b = 0.2;
    const d = 0.5;
    const p = buildSection({ kind: 'rectangle', depth: d, width: b });
    expect(p.area).toBeCloseTo(b * d, 12);
    expect(p.inertiaX).toBeCloseTo((b * d ** 3) / 12, 15);
    expect(p.inertiaY).toBeCloseTo((d * b ** 3) / 12, 15);
    expect(p.sectionModulusX).toBeCloseTo((b * d ** 2) / 6, 15);
    // El módulo plástico del rectángulo es b·d²/4, y sale de la bisección del
    // eje neutro, no de una fórmula escrita para este caso.
    expect(p.plasticModulusX).toBeCloseTo((b * d ** 2) / 4, 9);
    expect(p.radiusOfGyrationX).toBeCloseTo(d / Math.sqrt(12), 12);
  });

  it('resta los huecos: el cajón es el macizo menos el interior', () => {
    const p = buildSection({ kind: 'box', depth: 0.3, width: 0.2, thickness: 0.01 });
    const outer = 0.2 * 0.3;
    const inner = 0.18 * 0.28;
    expect(p.area).toBeCloseTo(outer - inner, 12);
    expect(p.inertiaX).toBeCloseTo((0.2 * 0.3 ** 3 - 0.18 * 0.28 ** 3) / 12, 15);
  });

  it('el tubo circular sigue las fórmulas de la corona', () => {
    const D = 0.1;
    const t = 0.008;
    const d = D - 2 * t;
    const p = buildSection({ kind: 'tube', outerDiameter: D, thickness: t });
    expect(p.area).toBeCloseTo((Math.PI / 4) * (D ** 2 - d ** 2), 12);
    expect(p.inertiaX).toBeCloseTo((Math.PI / 64) * (D ** 4 - d ** 4), 15);
    expect(p.plasticModulusX).toBeCloseTo((D ** 3 - d ** 3) / 6, 12);
  });

  it('coloca el centroide donde manda la simetría, y lo desplaza donde no la hay', () => {
    const doubleT = buildSection({ kind: 'i-shape', depth: 0.3, width: 0.15, webThickness: 0.008, flangeThickness: 0.012 });
    expect(doubleT.centroidX).toBeCloseTo(0, 12);
    expect(doubleT.centroidY).toBeCloseTo(0, 12);
    expect(doubleT.extremeFiberTop).toBeCloseTo(doubleT.extremeFiberBottom, 12);

    const angle = buildSection({ kind: 'angle', depth: 0.1, width: 0.06, thickness: 0.008 });
    // Un angular no es simétrico respecto de ningún eje: sus dos fibras
    // extremas no pueden estar a la misma distancia.
    expect(angle.extremeFiberTop).not.toBeCloseTo(angle.extremeFiberBottom, 4);
    expect(angle.sectionModulusX).toBeCloseTo(angle.inertiaX / Math.max(angle.extremeFiberTop, angle.extremeFiberBottom), 15);
  });

  it('la U y la doble T comparten inercia fuerte y difieren en la débil', () => {
    const dimensions = { depth: 0.3, width: 0.15, webThickness: 0.008, flangeThickness: 0.012 } as const;
    const doubleT = buildSection({ kind: 'i-shape', ...dimensions });
    const channel = buildSection({ kind: 'channel', ...dimensions });
    // Misma descomposición y misma distribución respecto del eje fuerte.
    expect(channel.inertiaX).toBeCloseTo(doubleT.inertiaX, 15);
    expect(channel.area).toBeCloseTo(doubleT.area, 15);
    /* Pero el alma pegada al borde desplaza el centroide, y entonces las alas
       —que siguen siendo simétricas respecto del eje de la descripción— quedan
       excéntricas respecto del centroide real y aportan su término de Steiner.
       Por eso la inercia débil de la U es **mayor**, no menor: es el teorema de
       los ejes paralelos apareciendo, y es la comprobación de que el centroide
       desplazado se está aplicando de verdad. */
    expect(channel.centroidX).toBeLessThan(0);
    expect(channel.inertiaY).toBeGreaterThan(doubleT.inertiaY);
    expect(channel.inertiaY - doubleT.inertiaY).toBeCloseTo(
      2 * dimensions.width * dimensions.flangeThickness * channel.centroidX ** 2
      + (dimensions.depth - 2 * dimensions.flangeThickness) * dimensions.webThickness
        * ((-dimensions.width / 2 + dimensions.webThickness / 2 - channel.centroidX) ** 2
          - (0 - 0) ** 2),
      12,
    );
  });

  it('una sección compuesta es la concatenación de sus partes', () => {
    // Dos rectángulos pegados equivalen a uno del doble de ancho.
    const halves = propertiesOfRectangles([
      { width: 0.1, height: 0.4, centerX: -0.05, centerY: 0 },
      { width: 0.1, height: 0.4, centerX: 0.05, centerY: 0 },
    ]);
    const whole = buildSection({ kind: 'rectangle', depth: 0.4, width: 0.2 });
    expect(halves.area).toBeCloseTo(whole.area, 15);
    expect(halves.inertiaX).toBeCloseTo(whole.inertiaX, 15);
    expect(halves.inertiaY).toBeCloseTo(whole.inertiaY, 15);
    expect(halves.plasticModulusX).toBeCloseTo(whole.plasticModulusX, 9);
  });

  it('el módulo plástico es mayor que el elástico, como exige su definición', () => {
    for (const shape of [
      { kind: 'rectangle', depth: 0.4, width: 0.2 },
      { kind: 'i-shape', depth: 0.3, width: 0.15, webThickness: 0.008, flangeThickness: 0.012 },
      { kind: 'box', depth: 0.3, width: 0.2, thickness: 0.01 },
      { kind: 'tube', outerDiameter: 0.1, thickness: 0.008 },
    ] as BuiltSectionShape[]) {
      const p = buildSection(shape);
      expect(p.plasticModulusX, shape.kind).toBeGreaterThan(p.sectionModulusX);
    }
  });

  it('rechaza geometrías imposibles en vez de devolver números', () => {
    expect(() => buildSection({ kind: 'rectangle', depth: 0, width: 0.2 })).toThrow(/positivo/);
    expect(() => buildSection({ kind: 'i-shape', depth: 0.02, width: 0.15, webThickness: 0.008, flangeThickness: 0.012 })).toThrow(/canto/);
    expect(() => buildSection({ kind: 'box', depth: 0.3, width: 0.2, thickness: 0.15 })).toThrow(/hueco/);
    expect(() => buildSection({ kind: 'tube', outerDiameter: 0.1, thickness: 0.05 })).toThrow(/cierra/);
    expect(() => rectanglesOf({ kind: 'composite', parts: [] })).toThrow(/al menos/);
  });
});

/**
 * El gate que se valida solo: reconstruir cada perfil del catálogo desde **sus
 * propias dimensiones almacenadas** y compararlo con sus propiedades
 * almacenadas. Si una fórmula está mal, el catálogo lo delata.
 *
 * Las tolerancias no son un margen de comodidad: son la diferencia medida entre
 * la sección idealizada de aristas vivas y la sección real, que lleva acuerdos
 * de laminación en las doble T y radios de esquina en los tubos rectangulares.
 * Ese material existe y esta descripción no lo tiene. En el rectángulo macizo,
 * donde no hay nada que idealizar, la tolerancia es cero absoluto.
 */
const shapeOf = (section: StandardSection): BuiltSectionShape => {
  switch (section.shapeType) {
    case 'I': return { kind: 'i-shape', depth: section.depth, width: section.width, webThickness: section.webThickness, flangeThickness: section.flangeThickness };
    case 'C': return { kind: 'channel', depth: section.depth, width: section.width, webThickness: section.webThickness, flangeThickness: section.flangeThickness };
    case 'L': return { kind: 'angle', depth: section.depth, width: section.width, thickness: section.webThickness };
    case 'HSS_RECT': return { kind: 'box', depth: section.depth, width: section.width, thickness: section.webThickness };
    case 'HSS_ROUND': return { kind: 'tube', outerDiameter: section.depth, thickness: section.webThickness };
    case 'RECT': return { kind: 'rectangle', depth: section.depth, width: section.width };
  }
};

/** Tolerancias medidas sobre el catálogo completo, por forma y propiedad (fracción). */
const TOLERANCE: Record<StandardSection['shapeType'], Record<string, number>> = {
  // Acuerdos alma-ala: material real que la idealización de aristas vivas no tiene.
  I: { area: 0.055, inertiaX: 0.06, inertiaY: 0.01, sectionModulusX: 0.06, plasticModulusX: 0.06, radiusOfGyrationX: 0.01 },
  // Radios de esquina del tubo conformado.
  HSS_RECT: { area: 0.05, inertiaX: 0.07, inertiaY: 0.07, sectionModulusX: 0.07, plasticModulusX: 0.06, radiusOfGyrationX: 0.015 },
  HSS_ROUND: { area: 0.02, inertiaX: 0.005, inertiaY: 0.005, sectionModulusX: 0.005, plasticModulusX: 0.005, radiusOfGyrationX: 0.005 },
  /* La inercia débil de una U es el caso peor de toda la tabla (25 %), y no es
     un error de la fórmula: el ala de un perfil U real tiene la cara interior
     inclinada, lo que desplaza el centroide en la dirección en la que Iy es
     sensible. La inercia fuerte, que es la que el solver usa como `I`, cae por
     debajo del 1 %. */
  C: { area: 0.01, inertiaX: 0.01, inertiaY: 0.26, sectionModulusX: 0.01, plasticModulusX: 0.01, radiusOfGyrationX: 0.005 },
  L: { area: 0.015, inertiaX: 0.02, inertiaY: 0.02, sectionModulusX: 0.03, plasticModulusX: 0.025, radiusOfGyrationX: 0.015 },
  /* Sin nada que idealizar. El margen que queda no es de la fórmula sino del
     catálogo, que guarda sus propiedades con doce cifras significativas: la
     reconstrucción las reproduce hasta donde están escritas. */
  RECT: { area: 1e-11, inertiaX: 1e-11, inertiaY: 1e-11, sectionModulusX: 1e-11, plasticModulusX: 1e-9, radiusOfGyrationX: 1e-11 },
};

describe('el catálogo valida las fórmulas', () => {
  it.each(standardSections.map((section) => [section.name, section] as const))(
    'reconstruye %s desde sus propias dimensiones',
    (_name, section) => {
      const built = buildSection(shapeOf(section));
      const tolerance = TOLERANCE[section.shapeType];
      const compare = (property: string, actual: number, expected: number) => {
        const error = Math.abs(actual - expected) / Math.abs(expected);
        expect(error, `${section.name} · ${property}: ${error.toExponential(2)}`).toBeLessThanOrEqual(tolerance[property]);
      };
      compare('area', built.area, section.area);
      compare('inertiaX', built.inertiaX, section.inertiaX);
      compare('inertiaY', built.inertiaY, section.inertiaY);
      compare('sectionModulusX', built.sectionModulusX, section.sectionModulusX);
      compare('plasticModulusX', built.plasticModulusX, section.plasticModulusX);
      compare('radiusOfGyrationX', built.radiusOfGyrationX, section.radiusOfGyrationX);
    },
  );

  it('el rectángulo macizo sale exacto hasta la precisión con que el catálogo lo guarda', () => {
    const rectangles = standardSections.filter((section) => section.shapeType === 'RECT');
    expect(rectangles.length).toBeGreaterThan(0);
    for (const section of rectangles) {
      const built = buildSection(shapeOf(section));
      // Doce cifras: lo que el catálogo escribe. Pedir quince sería exigirle al
      // archivo una precisión que no tiene, no a la fórmula.
      expect(Math.abs(built.area - section.area) / section.area, `${section.name} · área`).toBeLessThan(1e-11);
      expect(Math.abs(built.inertiaX - section.inertiaX) / section.inertiaX, `${section.name} · Ix`).toBeLessThan(1e-11);
    }
  });
});
