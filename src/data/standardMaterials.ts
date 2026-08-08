/**
 * Catálogo de materiales estructurales estándar (AISC / Eurocódigo / ACI / NDS).
 *
 * Todos los valores numéricos ya están en las unidades base internas del motor
 * (ver `src/engine/units.ts`): elasticModulus y shearModulus en kN/m², unitWeight
 * en kN/m³, density en kg/m³, yieldStrength en kN/m² y thermalExpansion en 1/°C.
 * No requieren conversión antes de asignarse a `MemberModel.E` / `G` / `density`.
 *
 * Fuente de los valores: dataset técnico verificado en
 * `Antigravity-propuestas/recursos/AG-009-dataset.json` (AISC Shapes Database v15.0,
 * ArcelorMittal Orange Book / EN 10365, ACI CODE-318-19, ANSI/AWC NDS / EN 338 / EN 14080).
 */

export type MaterialCategory = 'STEEL' | 'CONCRETE' | 'TIMBER' | 'ALUMINUM';

export interface StandardMaterial {
  id: string;
  name: string;
  category: MaterialCategory;
  elasticModulus: number; // kN/m², internal base unit
  shearModulus: number; // kN/m²
  poissonRatio: number;
  unitWeight: number; // kN/m³
  density: number; // kg/m³
  yieldStrength: number; // kN/m²
  thermalExpansion: number; // 1/°C
}

export const standardMaterials: readonly StandardMaterial[] = [
  { id: 'steel-a36', name: 'Acero estructural ASTM A36/A36M', category: 'STEEL', elasticModulus: 200000000, shearModulus: 76923076.9231, poissonRatio: 0.3, unitWeight: 78.5, density: 7850, yieldStrength: 250000, thermalExpansion: 0.000012 },
  { id: 'steel-a992', name: 'Acero estructural ASTM A992/A992M / ASTM A572 Gr. 50', category: 'STEEL', elasticModulus: 200000000, shearModulus: 76923076.9231, poissonRatio: 0.3, unitWeight: 78.5, density: 7850, yieldStrength: 345000, thermalExpansion: 0.000012 },
  { id: 'steel-a500-grade-b', name: 'Acero estructural tubular ASTM A500/A500M Grado B', category: 'STEEL', elasticModulus: 200000000, shearModulus: 76923076.9231, poissonRatio: 0.3, unitWeight: 78.5, density: 7850, yieldStrength: 315000, thermalExpansion: 0.000012 },
  { id: 'steel-stainless-aisi304', name: 'Acero inoxidable estructural AISI 304 / EN 1.4301', category: 'STEEL', elasticModulus: 200000000, shearModulus: 76923076.9231, poissonRatio: 0.3, unitWeight: 78.5, density: 7850, yieldStrength: 210000, thermalExpansion: 0.000016 },
  { id: 'concrete-21mpa', name: "Concreto normal f'c = 21 MPa", category: 'CONCRETE', elasticModulus: 21538105.7663, shearModulus: 8974210.73596, poissonRatio: 0.2, unitWeight: 24, density: 2400, yieldStrength: 21000, thermalExpansion: 0.00001 },
  { id: 'concrete-28mpa', name: "Concreto normal f'c = 28 MPa", category: 'CONCRETE', elasticModulus: 24870062.324, shearModulus: 10362525.9683, poissonRatio: 0.2, unitWeight: 24, density: 2400, yieldStrength: 28000, thermalExpansion: 0.00001 },
  { id: 'concrete-35mpa', name: "Concreto normal f'c = 35 MPa", category: 'CONCRETE', elasticModulus: 27805574.9806, shearModulus: 11585656.2419, poissonRatio: 0.2, unitWeight: 24, density: 2400, yieldStrength: 35000, thermalExpansion: 0.00001 },
  { id: 'concrete-42mpa', name: "Concreto de alta resistencia f'c = 42 MPa", category: 'CONCRETE', elasticModulus: 30459481.2825, shearModulus: 12691450.5344, poissonRatio: 0.2, unitWeight: 24, density: 2400, yieldStrength: 42000, thermalExpansion: 0.00001 },
  { id: 'timber-c18', name: 'Madera estructural blanda C18 (EN 338)', category: 'TIMBER', elasticModulus: 9000000, shearModulus: 560000, poissonRatio: 0.35, unitWeight: 3.73, density: 380, yieldStrength: 18000, thermalExpansion: 0.000005 },
  { id: 'timber-c24', name: 'Madera estructural blanda C24 (EN 338 / Pino Radiata seleccionado)', category: 'TIMBER', elasticModulus: 11000000, shearModulus: 690000, poissonRatio: 0.35, unitWeight: 4.12, density: 420, yieldStrength: 24000, thermalExpansion: 0.000005 },
  { id: 'timber-gl24h', name: 'Madera laminada encolada GL24h (EN 14080 / Glulam)', category: 'TIMBER', elasticModulus: 11500000, shearModulus: 650000, poissonRatio: 0.35, unitWeight: 4.12, density: 420, yieldStrength: 24000, thermalExpansion: 0.000005 },
  { id: 'aluminum-6061-t6', name: 'Aleación de aluminio estructural 6061-T6 / EN AW-6061', category: 'ALUMINUM', elasticModulus: 68900000, shearModulus: 26000000, poissonRatio: 0.33, unitWeight: 26.5, density: 2700, yieldStrength: 240000, thermalExpansion: 0.0000236 },
];

export const findStandardMaterial = (id: string): StandardMaterial | undefined =>
  standardMaterials.find((material) => material.id === id);
