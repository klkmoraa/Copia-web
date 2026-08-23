/**
 * Constructor de secciones: propiedades geométricas a partir de dimensiones.
 *
 * Hasta ahora una sección era o una entrada del catálogo o cuatro números
 * escritos a mano. Esto permite lo de en medio: describir la forma y que el
 * área, las inercias y los módulos salgan de la geometría.
 *
 * ## Un núcleo, no seis fórmulas
 *
 * Todas las formas menos el tubo circular se describen como una lista de
 * **rectángulos con signo**: los positivos son material y los negativos son
 * huecos. Un cajón es el rectángulo exterior menos el interior; una doble T son
 * tres rectángulos; una sección compuesta es la concatenación de dos listas.
 *
 * Escribir seis juegos de fórmulas cerradas habría sido seis oportunidades de
 * equivocarse en un exponente, y el módulo plástico —donde el eje neutro no
 * pasa por el centroide— es justo donde esas fórmulas se tuercen. Con el núcleo
 * geométrico, `Zx` se calcula igual para todas: se busca el eje que parte el
 * área en dos mitades y se suman los momentos estáticos.
 *
 * ## Qué idealiza
 *
 * Aristas vivas: sin acuerdos de laminación en las doble T ni radios de
 * esquina en los tubos rectangulares. Por eso los valores no coinciden **al
 * dígito** con los del catálogo, que sí los llevan, y por eso el gate declara
 * una tolerancia medida por forma en vez de fingir una igualdad que no existe.
 * La diferencia es material real que la sección tiene y esta descripción no.
 */

/** Rectángulo con signo: área positiva es material, negativa es hueco. */
export interface SectionRectangle {
  width: number;
  height: number;
  /** Centro del rectángulo en el sistema de la descripción, no en el del centroide. */
  centerX: number;
  centerY: number;
  /** `true` para restar. */
  hole?: boolean;
}

export interface SectionProperties {
  area: number;
  centroidX: number;
  centroidY: number;
  /** Inercia respecto del eje horizontal que pasa por el centroide. */
  inertiaX: number;
  inertiaY: number;
  /** Módulo elástico respecto de la fibra más alejada. */
  sectionModulusX: number;
  sectionModulusY: number;
  plasticModulusX: number;
  radiusOfGyrationX: number;
  radiusOfGyrationY: number;
  /** Distancia del centroide a la fibra extrema superior e inferior. */
  extremeFiberTop: number;
  extremeFiberBottom: number;
}

const signedArea = (rectangle: SectionRectangle) =>
  (rectangle.hole ? -1 : 1) * rectangle.width * rectangle.height;

/**
 * Propiedades de una lista de rectángulos con signo.
 *
 * Steiner para las inercias, y para el módulo plástico una bisección sobre la
 * posición del eje que iguala las dos mitades del área. La bisección es general
 * y funciona con huecos; una fórmula cerrada por forma, no.
 */
export const propertiesOfRectangles = (rectangles: readonly SectionRectangle[]): SectionProperties => {
  const area = rectangles.reduce((sum, rectangle) => sum + signedArea(rectangle), 0);
  if (!(area > 0)) throw new Error('La sección descrita no tiene área positiva.');

  const centroidX = rectangles.reduce((sum, rectangle) => sum + signedArea(rectangle) * rectangle.centerX, 0) / area;
  const centroidY = rectangles.reduce((sum, rectangle) => sum + signedArea(rectangle) * rectangle.centerY, 0) / area;

  const inertiaAbout = (axis: 'x' | 'y') => rectangles.reduce((sum, rectangle) => {
    const own = axis === 'x'
      ? (rectangle.width * rectangle.height ** 3) / 12
      : (rectangle.height * rectangle.width ** 3) / 12;
    const arm = axis === 'x' ? rectangle.centerY - centroidY : rectangle.centerX - centroidX;
    const sign = rectangle.hole ? -1 : 1;
    return sum + sign * (own + rectangle.width * rectangle.height * arm * arm);
  }, 0);

  const inertiaX = inertiaAbout('x');
  const inertiaY = inertiaAbout('y');

  const top = Math.max(...rectangles.filter((rectangle) => !rectangle.hole).map((rectangle) => rectangle.centerY + rectangle.height / 2));
  const bottom = Math.min(...rectangles.filter((rectangle) => !rectangle.hole).map((rectangle) => rectangle.centerY - rectangle.height / 2));
  const extremeFiberTop = top - centroidY;
  const extremeFiberBottom = centroidY - bottom;
  const left = Math.min(...rectangles.filter((rectangle) => !rectangle.hole).map((rectangle) => rectangle.centerX - rectangle.width / 2));
  const right = Math.max(...rectangles.filter((rectangle) => !rectangle.hole).map((rectangle) => rectangle.centerX + rectangle.width / 2));

  /** Área que queda por encima de una cota, contando los huecos en negativo. */
  const areaAbove = (level: number) => rectangles.reduce((sum, rectangle) => {
    const rectangleTop = rectangle.centerY + rectangle.height / 2;
    const rectangleBottom = rectangle.centerY - rectangle.height / 2;
    const overlap = Math.max(0, Math.min(rectangleTop, top) - Math.max(rectangleBottom, level));
    return sum + (rectangle.hole ? -1 : 1) * rectangle.width * overlap;
  }, 0);

  // Eje neutro plástico: la cota que deja la mitad del área a cada lado. El área
  // por encima decrece monótonamente con la cota, así que la bisección no puede
  // quedarse en un mínimo local.
  let low = bottom;
  let high = top;
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const middle = (low + high) / 2;
    if (areaAbove(middle) > area / 2) low = middle; else high = middle;
  }
  const plasticAxis = (low + high) / 2;

  /** Momento estático de la porción de un rectángulo a un lado del eje plástico. */
  const staticMoment = (rectangle: SectionRectangle, from: number, to: number) => {
    const rectangleTop = rectangle.centerY + rectangle.height / 2;
    const rectangleBottom = rectangle.centerY - rectangle.height / 2;
    const sliceTop = Math.min(rectangleTop, to);
    const sliceBottom = Math.max(rectangleBottom, from);
    const height = sliceTop - sliceBottom;
    if (!(height > 0)) return 0;
    const centre = (sliceTop + sliceBottom) / 2;
    return (rectangle.hole ? -1 : 1) * rectangle.width * height * Math.abs(centre - plasticAxis);
  };
  const plasticModulusX = rectangles.reduce((sum, rectangle) =>
    sum + staticMoment(rectangle, plasticAxis, top) + staticMoment(rectangle, bottom, plasticAxis), 0);

  return {
    area,
    centroidX,
    centroidY,
    inertiaX,
    inertiaY,
    sectionModulusX: inertiaX / Math.max(extremeFiberTop, extremeFiberBottom),
    sectionModulusY: inertiaY / Math.max(right - centroidX, centroidX - left),
    plasticModulusX,
    radiusOfGyrationX: Math.sqrt(inertiaX / area),
    radiusOfGyrationY: Math.sqrt(inertiaY / area),
    extremeFiberTop,
    extremeFiberBottom,
  };
};

export type BuiltSectionShape =
  | { kind: 'rectangle'; depth: number; width: number }
  | { kind: 'i-shape'; depth: number; width: number; webThickness: number; flangeThickness: number }
  | { kind: 'channel'; depth: number; width: number; webThickness: number; flangeThickness: number }
  | { kind: 'angle'; depth: number; width: number; thickness: number }
  | { kind: 'box'; depth: number; width: number; thickness: number }
  | { kind: 'tube'; outerDiameter: number; thickness: number }
  | { kind: 'composite'; parts: readonly SectionRectangle[] };

const positive = (label: string, value: number) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} debe ser un número positivo.`);
  return value;
};

/**
 * Descompone una forma en rectángulos con signo.
 *
 * La doble T y la U comparten descomposición —dos alas de ancho completo y un
 * alma entre ellas—, y se diferencian sólo en dónde está el alma: centrada o
 * pegada al borde. Esa es exactamente la diferencia entre las dos secciones.
 */
export const rectanglesOf = (shape: BuiltSectionShape): SectionRectangle[] => {
  switch (shape.kind) {
    case 'rectangle': {
      const depth = positive('El canto', shape.depth);
      const width = positive('El ancho', shape.width);
      return [{ width, height: depth, centerX: 0, centerY: 0 }];
    }
    case 'i-shape':
    case 'channel': {
      const depth = positive('El canto', shape.depth);
      const width = positive('El ancho', shape.width);
      const web = positive('El espesor del alma', shape.webThickness);
      const flange = positive('El espesor del ala', shape.flangeThickness);
      if (2 * flange >= depth) throw new Error('Las alas consumen todo el canto de la sección.');
      if (web >= width) throw new Error('El alma es más ancha que el ala.');
      const webHeight = depth - 2 * flange;
      // La U tiene el alma pegada al borde izquierdo; la doble T, centrada.
      const webCentre = shape.kind === 'channel' ? -width / 2 + web / 2 : 0;
      return [
        { width, height: flange, centerX: 0, centerY: (depth - flange) / 2 },
        { width, height: flange, centerX: 0, centerY: -(depth - flange) / 2 },
        { width: web, height: webHeight, centerX: webCentre, centerY: 0 },
      ];
    }
    case 'angle': {
      const depth = positive('El ala vertical', shape.depth);
      const width = positive('El ala horizontal', shape.width);
      const thickness = positive('El espesor', shape.thickness);
      if (thickness >= depth || thickness >= width) throw new Error('El espesor consume el ala completa.');
      return [
        { width: thickness, height: depth, centerX: thickness / 2, centerY: depth / 2 },
        { width: width - thickness, height: thickness, centerX: thickness + (width - thickness) / 2, centerY: thickness / 2 },
      ];
    }
    case 'box': {
      const depth = positive('El canto', shape.depth);
      const width = positive('El ancho', shape.width);
      const thickness = positive('El espesor', shape.thickness);
      if (2 * thickness >= depth || 2 * thickness >= width) throw new Error('El espesor cierra el hueco de la sección.');
      return [
        { width, height: depth, centerX: 0, centerY: 0 },
        { width: width - 2 * thickness, height: depth - 2 * thickness, centerX: 0, centerY: 0, hole: true },
      ];
    }
    case 'composite':
      if (!shape.parts.length) throw new Error('Una sección compuesta necesita al menos un rectángulo.');
      return [...shape.parts];
    case 'tube':
      throw new Error('El tubo circular no se descompone en rectángulos; usa buildSection.');
  }
};

/** Propiedades del tubo circular, que no admite descomposición en rectángulos. */
const tubeProperties = (outerDiameter: number, thickness: number): SectionProperties => {
  const outer = positive('El diámetro exterior', outerDiameter);
  const wall = positive('El espesor', thickness);
  if (2 * wall >= outer) throw new Error('El espesor cierra el tubo.');
  const inner = outer - 2 * wall;
  const area = (Math.PI / 4) * (outer ** 2 - inner ** 2);
  const inertia = (Math.PI / 64) * (outer ** 4 - inner ** 4);
  return {
    area,
    centroidX: 0,
    centroidY: 0,
    inertiaX: inertia,
    inertiaY: inertia,
    sectionModulusX: (2 * inertia) / outer,
    sectionModulusY: (2 * inertia) / outer,
    // Módulo plástico de una corona circular: (D³ − d³) / 6.
    plasticModulusX: (outer ** 3 - inner ** 3) / 6,
    radiusOfGyrationX: Math.sqrt(inertia / area),
    radiusOfGyrationY: Math.sqrt(inertia / area),
    extremeFiberTop: outer / 2,
    extremeFiberBottom: outer / 2,
  };
};

/** Propiedades geométricas de una forma descrita. Todas las magnitudes en unidades base (m). */
export const buildSection = (shape: BuiltSectionShape): SectionProperties =>
  shape.kind === 'tube'
    ? tubeProperties(shape.outerDiameter, shape.thickness)
    : propertiesOfRectangles(rectanglesOf(shape));
