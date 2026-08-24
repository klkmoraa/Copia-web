import type { UnitSystemId } from '../types';

export type UnitQuantity =
  | 'length'
  | 'force'
  | 'moment'
  | 'distributedForce'
  | 'elasticModulus'
  | 'area'
  | 'inertia'
  /** Módulo elástico de sección W (un volumen). Sólo presentación: η usa la base. */
  | 'sectionModulus'
  /**
   * Dimensión de una sección transversal: canto, ancho, espesor de ala o alma.
   *
   * Es una longitud, y sin embargo no es `length`. Nadie escribe el espesor de
   * un alma en metros ni en pies: un IPE 300 tiene el alma de 7,1 mm, que en la
   * cantidad `length` del sistema kN-m se teclea como 0,0071 y en kip-ft como
   * 0,0233. Esa es exactamente la clase de número en la que un cero de más pasa
   * inadvertido. La cantidad es presentación pura —el constructor de secciones
   * calcula en unidades base, como todo lo demás— y elige por sistema la unidad
   * en la que un catálogo real publica sus dimensiones.
   */
  | 'sectionDimension'
  | 'translationalStiffness'
  | 'rotationalStiffness'
  | 'density';

interface UnitDefinition {
  labels: Record<UnitQuantity, string>;
  factors: Record<UnitQuantity, number>;
}

/** Internal base units are kN, m, kN·m, kN/m, kN/m², m² and m⁴. */
const definitions: Record<UnitSystemId, UnitDefinition> = {
  'kN-m': {
    labels: {
      length: 'm', force: 'kN', moment: 'kN·m', distributedForce: 'kN/m',
      elasticModulus: 'MPa', area: 'm²', inertia: 'm⁴', sectionModulus: 'm³',
      sectionDimension: 'mm',
      translationalStiffness: 'kN/m', rotationalStiffness: 'kN·m/rad', density: 'kg/m³',
    },
    factors: {
      length: 1, force: 1, moment: 1, distributedForce: 1,
      elasticModulus: 1 / 1000, area: 1, inertia: 1, sectionModulus: 1,
      sectionDimension: 1000,
      translationalStiffness: 1, rotationalStiffness: 1, density: 1,
    },
  },
  'N-mm': {
    labels: {
      length: 'mm', force: 'N', moment: 'N·mm', distributedForce: 'N/mm',
      elasticModulus: 'MPa', area: 'mm²', inertia: 'mm⁴', sectionModulus: 'mm³',
      sectionDimension: 'mm',
      translationalStiffness: 'N/mm', rotationalStiffness: 'N·mm/rad', density: 'kg/m³',
    },
    factors: {
      length: 1000, force: 1000, moment: 1_000_000, distributedForce: 1,
      elasticModulus: 1 / 1000, area: 1_000_000, inertia: 1_000_000_000_000, sectionModulus: 1_000_000_000,
      sectionDimension: 1000,
      translationalStiffness: 1, rotationalStiffness: 1_000_000, density: 1,
    },
  },
  'kgf-m': {
    labels: {
      length: 'm', force: 'kgf', moment: 'kgf·m', distributedForce: 'kgf/m',
      elasticModulus: 'kgf/cm²', area: 'cm²', inertia: 'cm⁴', sectionModulus: 'cm³',
      sectionDimension: 'cm',
      translationalStiffness: 'kgf/m', rotationalStiffness: 'kgf·m/rad', density: 'kg/m³',
    },
    factors: {
      length: 1, force: 101.9716212978, moment: 101.9716212978, distributedForce: 101.9716212978,
      elasticModulus: 0.01019716212978, area: 10_000, inertia: 100_000_000, sectionModulus: 1_000_000,
      sectionDimension: 100,
      translationalStiffness: 101.9716212978, rotationalStiffness: 101.9716212978, density: 1,
    },
  },
  'kip-ft': {
    labels: {
      length: 'ft', force: 'kip', moment: 'kip·ft', distributedForce: 'kip/ft',
      elasticModulus: 'ksi', area: 'in²', inertia: 'in⁴', sectionModulus: 'in³',
      sectionDimension: 'in',
      translationalStiffness: 'kip/ft', rotationalStiffness: 'kip·ft/rad', density: 'lb/ft³',
    },
    factors: {
      length: 3.28083989501312,
      force: 0.22480894387096,
      moment: 0.73756214927727,
      distributedForce: 0.06852176585679,
      elasticModulus: 1.45037737730209e-4,
      area: 1550.0031000062,
      inertia: 2_402_509.60999038,
      sectionModulus: 61_023.7440947323,
      sectionDimension: 39.3700787401575,
      translationalStiffness: 0.06852176585679,
      rotationalStiffness: 0.73756214927727,
      density: 0.0624279605761,
    },
  },
};

export const unitLabel = (system: UnitSystemId, quantity: UnitQuantity): string => definitions[system].labels[quantity];
export const toDisplay = (value: number, system: UnitSystemId, quantity: UnitQuantity): number => value * definitions[system].factors[quantity];
export const fromDisplay = (value: number, system: UnitSystemId, quantity: UnitQuantity): number => value / definitions[system].factors[quantity];

export const formatDisplay = (
  value: number,
  system: UnitSystemId,
  quantity: UnitQuantity,
  digits = 3,
): string => {
  const converted = toDisplay(value, system, quantity);
  const magnitude = Math.abs(converted);
  if ((magnitude > 0 && magnitude < 10 ** (-digits)) || magnitude >= 1e7) return `${converted.toExponential(digits)} ${unitLabel(system, quantity)}`;
  return `${converted.toFixed(digits)} ${unitLabel(system, quantity)}`;
};
