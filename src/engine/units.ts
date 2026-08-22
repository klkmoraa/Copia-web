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
      translationalStiffness: 'kN/m', rotationalStiffness: 'kN·m/rad', density: 'kg/m³',
    },
    factors: {
      length: 1, force: 1, moment: 1, distributedForce: 1,
      elasticModulus: 1 / 1000, area: 1, inertia: 1, sectionModulus: 1,
      translationalStiffness: 1, rotationalStiffness: 1, density: 1,
    },
  },
  'N-mm': {
    labels: {
      length: 'mm', force: 'N', moment: 'N·mm', distributedForce: 'N/mm',
      elasticModulus: 'MPa', area: 'mm²', inertia: 'mm⁴', sectionModulus: 'mm³',
      translationalStiffness: 'N/mm', rotationalStiffness: 'N·mm/rad', density: 'kg/m³',
    },
    factors: {
      length: 1000, force: 1000, moment: 1_000_000, distributedForce: 1,
      elasticModulus: 1 / 1000, area: 1_000_000, inertia: 1_000_000_000_000, sectionModulus: 1_000_000_000,
      translationalStiffness: 1, rotationalStiffness: 1_000_000, density: 1,
    },
  },
  'kgf-m': {
    labels: {
      length: 'm', force: 'kgf', moment: 'kgf·m', distributedForce: 'kgf/m',
      elasticModulus: 'kgf/cm²', area: 'cm²', inertia: 'cm⁴', sectionModulus: 'cm³',
      translationalStiffness: 'kgf/m', rotationalStiffness: 'kgf·m/rad', density: 'kg/m³',
    },
    factors: {
      length: 1, force: 101.9716212978, moment: 101.9716212978, distributedForce: 101.9716212978,
      elasticModulus: 0.01019716212978, area: 10_000, inertia: 100_000_000, sectionModulus: 1_000_000,
      translationalStiffness: 101.9716212978, rotationalStiffness: 101.9716212978, density: 1,
    },
  },
  'kip-ft': {
    labels: {
      length: 'ft', force: 'kip', moment: 'kip·ft', distributedForce: 'kip/ft',
      elasticModulus: 'ksi', area: 'in²', inertia: 'in⁴', sectionModulus: 'in³',
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
