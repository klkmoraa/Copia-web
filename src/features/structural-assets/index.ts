export { STRUCTURAL_ASSET_IDS, STRUCTURAL_ASSET_REGISTRY, getStructuralAsset } from './registry';
export { StructuralIllustration } from './StructuralIllustration';
export { ThreeStructuralImage } from './ThreeStructuralImage';
export {
  THREE_STRUCTURAL_ASSET_IDS,
  buildThreeStructuralGroup,
  renderThreeStructuralAssetDataUrl,
} from './threeStructuralRender';
export type { ThreeStructuralAssetId } from './threeStructuralRender';
export {
  THREE_TECHNICAL_ASSET_IDS,
  THREE_TECHNICAL_LOAD_COLORS,
  buildThreeTechnicalGroup,
} from './threeTechnicalAssets';
export type {
  StructuralAssetDetail,
  StructuralAssetFamily,
  StructuralAssetMaterial,
  StructuralAssetPreset,
  StructuralAssetRenderOptions,
  StructuralAssetVariant,
  StructuralAssetVariantName,
  StructuralIllustrationProps,
} from './types';
