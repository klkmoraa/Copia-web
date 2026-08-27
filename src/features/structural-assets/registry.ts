import type {
  StructuralAssetFamily,
  StructuralAssetMaterial,
  StructuralAssetVariant,
  StructuralAssetVariantName,
} from './types';

const preset = (
  family: StructuralAssetFamily,
  variant: StructuralAssetVariantName,
  label: string,
  material: StructuralAssetMaterial,
): StructuralAssetVariant => Object.freeze({
  id: `${family}:${variant}`,
  family,
  variant,
  label,
  material,
});

export const STRUCTURAL_ASSET_REGISTRY: readonly StructuralAssetVariant[] = Object.freeze([
    preset('portal', 'single-bay', 'Single-bay portal frame', 'concrete'),
    preset('portal', 'two-bay', 'Two-bay portal frame', 'concrete'),
    preset('portal', 'two-story', 'Two-story portal frame', 'concrete'),
    preset('portal', 'industrial-pitched', 'Industrial pitched portal frame', 'steel'),
    preset('beam', 'simply-supported', 'Simply supported beam', 'concrete'),
    preset('beam', 'two-span', 'Two-span continuous beam', 'concrete'),
    preset('beam', 'three-span', 'Three-span continuous beam', 'steel'),
    preset('beam', 'overhang', 'Beam with overhang', 'steel'),
    preset('cantilever', 'wall', 'Wall cantilever', 'concrete'),
    preset('cantilever', 'double', 'Double cantilever', 'steel'),
    preset('cantilever', 'stepped', 'Stepped cantilever', 'concrete'),
    preset('cantilever', 'balcony', 'Cantilever balcony', 'concrete'),
    preset('truss', 'pratt', 'Pratt truss', 'steel'),
    preset('truss', 'howe', 'Howe truss', 'timber'),
    preset('truss', 'warren', 'Warren truss', 'steel'),
    preset('truss', 'king-post', 'King-post truss', 'timber'),
    preset('slab', 'one-way', 'One-way slab', 'concrete'),
    preset('slab', 'two-way', 'Two-way slab', 'concrete'),
    preset('slab', 'waffle', 'Waffle slab', 'concrete'),
    preset('slab', 'flat-slab', 'Flat slab', 'concrete'),
    preset('space-frame', 'single-module', 'Single-module space frame', 'steel'),
    preset('space-frame', 'multi-bay', 'Multi-bay space frame', 'steel'),
    preset('space-frame', 'two-story', 'Two-story space frame', 'concrete'),
    preset('space-frame', 'industrial-shed', 'Industrial shed frame', 'steel'),
    preset('support', 'pin', 'Pinned support', 'technical'),
    preset('support', 'roller', 'Roller support', 'technical'),
    preset('support', 'fixed', 'Fixed support', 'technical'),
    preset('support', 'spring', 'Spring support', 'technical'),
    preset('load', 'point', 'Point load', 'technical'),
    preset('load', 'distributed', 'Distributed load', 'technical'),
    preset('load', 'varying', 'Varying distributed load', 'technical'),
    preset('load', 'applied-moment', 'Applied moment', 'technical'),
    preset('section', 'rectangular', 'Rectangular section', 'concrete'),
    preset('section', 'circular', 'Circular section', 'concrete'),
    preset('section', 'i-profile', 'I-profile section', 'steel'),
    preset('section', 'box', 'Box section', 'steel'),
    preset('connection', 'rigid', 'Rigid connection', 'steel'),
    preset('connection', 'pinned', 'Pinned connection', 'steel'),
    preset('connection', 'base-plate', 'Base-plate connection', 'steel'),
    preset('connection', 'splice', 'Member splice', 'steel'),
]);

export const STRUCTURAL_ASSET_IDS: readonly string[] = Object.freeze(
  STRUCTURAL_ASSET_REGISTRY.map((asset) => asset.id),
);

const assetsById = new Map(STRUCTURAL_ASSET_REGISTRY.map((asset) => [asset.id, asset] as const));

export const getStructuralAsset = (id: string): StructuralAssetVariant | undefined => assetsById.get(id);
