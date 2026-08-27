import type { CSSProperties, SVGProps } from 'react';

export type StructuralAssetFamily =
  | 'portal'
  | 'beam'
  | 'cantilever'
  | 'truss'
  | 'slab'
  | 'space-frame'
  | 'support'
  | 'load'
  | 'section'
  | 'connection';

export type StructuralAssetVariantName =
  | 'single-bay'
  | 'two-bay'
  | 'two-story'
  | 'industrial-pitched'
  | 'simply-supported'
  | 'two-span'
  | 'three-span'
  | 'overhang'
  | 'wall'
  | 'double'
  | 'stepped'
  | 'balcony'
  | 'pratt'
  | 'howe'
  | 'warren'
  | 'king-post'
  | 'one-way'
  | 'two-way'
  | 'waffle'
  | 'flat-slab'
  | 'single-module'
  | 'multi-bay'
  | 'industrial-shed'
  | 'pin'
  | 'roller'
  | 'fixed'
  | 'spring'
  | 'point'
  | 'distributed'
  | 'varying'
  | 'applied-moment'
  | 'rectangular'
  | 'circular'
  | 'i-profile'
  | 'box'
  | 'rigid'
  | 'pinned'
  | 'base-plate'
  | 'splice';

export type StructuralAssetMaterial = 'concrete' | 'steel' | 'timber' | 'technical';

export type StructuralAssetDetail = 'hero' | 'card' | 'compact';

export interface StructuralAssetVariant {
  readonly id: string;
  readonly family: StructuralAssetFamily;
  readonly variant: StructuralAssetVariantName;
  readonly label: string;
  readonly material: StructuralAssetMaterial;
}

export type StructuralAssetPreset = StructuralAssetVariant;

export interface StructuralAssetRenderOptions {
  readonly detail?: StructuralAssetDetail;
  readonly decorative?: boolean;
  readonly title?: string;
  readonly motion?: 'settle' | 'none';
}

export interface StructuralIllustrationProps
  extends StructuralAssetRenderOptions,
    Omit<SVGProps<SVGSVGElement>, 'aria-label' | 'children' | 'color' | 'role' | 'style' | 'title'> {
  readonly assetId: string;
  readonly style?: CSSProperties & Record<`--structural-asset-${string}`, string | number>;
}
