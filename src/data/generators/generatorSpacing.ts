import { cleanCoordinate } from '../structuralEditing';

/**
 * Separaciones de un generador: uniformes o listas explícitas no uniformes.
 *
 * Es el único contrato de espaciamiento del núcleo de generación. Toda familia
 * (claros, crujías, niveles, paneles, retículas) lo resuelve con las mismas
 * reglas y los mismos mensajes, de modo que una geometría irregular no es un
 * caso especial sino la forma general del contrato.
 */
export type SpacingSpec =
  | { readonly kind: 'uniform'; readonly count: number; readonly spacing: number }
  | { readonly kind: 'list'; readonly values: readonly number[] };

/**
 * Cota por eje. El presupuesto total de entidades vive en el generador; este
 * límite sólo evita que una lista o una cuenta absurda llegue a construirse.
 */
export const MAX_SPACING_DIVISIONS = 200;

/**
 * Precisión con la que se fija toda coordenada generada. Acumular separaciones
 * en punto flotante produce ruido (0.1 + 0.1 + 0.1 = 0.30000000000000004) que
 * ensucia el modelo y depende del orden de la suma. Doce cifras significativas
 * quedan muy por debajo de la tolerancia topológica del proyecto y hacen que la
 * misma geometría se escriba siempre con los mismos números.
 */
const COORDINATE_PRECISION = 12;

/** Redondeo compartido por toda coordenada que produce el núcleo de generación. */
export const roundGeneratedCoordinate = (value: number): number =>
  cleanCoordinate(Number(value.toPrecision(COORDINATE_PRECISION)));

const assertPositiveLength = (value: number, message: string): void => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(message);
};

/** Longitudes de cada división, en el orden declarado por el usuario. */
export const resolveSpacingSegments = (spec: SpacingSpec, label: string): number[] => {
  if (spec.kind === 'uniform') {
    if (!Number.isInteger(spec.count) || spec.count < 1) {
      throw new Error(`${label}: la cantidad de divisiones debe ser un entero mayor o igual que 1.`);
    }
    if (spec.count > MAX_SPACING_DIVISIONS) {
      throw new Error(`${label}: admite hasta ${MAX_SPACING_DIVISIONS} divisiones.`);
    }
    assertPositiveLength(spec.spacing, `${label}: la separación debe ser un número finito mayor que cero.`);
    return Array.from({ length: spec.count }, () => spec.spacing);
  }

  if (spec.kind === 'list') {
    if (!Array.isArray(spec.values) || spec.values.length === 0) {
      throw new Error(`${label}: la lista de separaciones no puede estar vacía.`);
    }
    if (spec.values.length > MAX_SPACING_DIVISIONS) {
      throw new Error(`${label}: admite hasta ${MAX_SPACING_DIVISIONS} divisiones.`);
    }
    return spec.values.map((value, index) => {
      assertPositiveLength(value, `${label}: la separación ${index + 1} debe ser un número finito mayor que cero.`);
      return value;
    });
  }

  throw new Error(`${label}: el tipo de separación no es válido.`);
};

/**
 * Coordenadas acumuladas relativas al origen del generador. Siempre devuelve
 * una estación más que divisiones, y limpia el ruido de punto flotante para que
 * dos ejecuciones con los mismos parámetros produzcan literalmente los mismos
 * números.
 */
export const resolveSpacingStations = (spec: SpacingSpec, label: string): number[] => {
  const segments = resolveSpacingSegments(spec, label);
  const stations = [0];
  let position = 0;
  for (const segment of segments) {
    position += segment;
    stations.push(roundGeneratedCoordinate(position));
  }
  return stations;
};

export const spacingDivisionCount = (spec: SpacingSpec, label: string): number =>
  resolveSpacingSegments(spec, label).length;

export const spacingTotalLength = (spec: SpacingSpec, label: string): number =>
  resolveSpacingStations(spec, label).at(-1)!;

export const isUniformSpacing = (spec: SpacingSpec, label: string): boolean => {
  const segments = resolveSpacingSegments(spec, label);
  return segments.every((segment) => segment === segments[0]);
};
