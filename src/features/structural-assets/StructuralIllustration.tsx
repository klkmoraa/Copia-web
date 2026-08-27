import { getStructuralAsset } from './registry';
import { StructuralAssetGeometry } from './geometry';
import type { StructuralIllustrationProps } from './types';
import './structuralIllustration.css';

const detailDimensions = {
  hero: { width: 480, height: 320 },
  card: { width: 240, height: 160 },
  compact: { width: 120, height: 80 },
} as const;

export const StructuralIllustration = ({
  assetId,
  detail = 'card',
  decorative = true,
  title,
  motion = 'settle',
  className,
  style,
  ...svgProps
}: StructuralIllustrationProps) => {
  const asset = getStructuralAsset(assetId);
  if (!asset) return null;

  const accessibleTitle = title?.trim() || asset.label;
  const dimensions = detailDimensions[detail];
  const classes = [
    'structural-illustration',
    'structural-illustration--theme-aware',
    `structural-illustration--${asset.family}`,
    `structural-illustration--${asset.material}`,
    `structural-illustration--${detail}`,
    motion === 'settle' ? 'structural-illustration--motion-safe' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <svg
      {...svgProps}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : accessibleTitle}
      className={classes}
      data-detail={detail}
      data-family={asset.family}
      data-material={asset.material}
      data-motion={motion}
      data-reduced-motion="static"
      data-structural-asset-id={asset.id}
      data-variant={asset.variant}
      focusable="false"
      height={svgProps.height ?? dimensions.height}
      preserveAspectRatio="xMidYMid meet"
      role={decorative ? 'presentation' : 'img'}
      style={style}
      viewBox="0 0 240 160"
      width={svgProps.width ?? dimensions.width}
      xmlns="http://www.w3.org/2000/svg"
    >
      {decorative ? null : <title>{accessibleTitle}</title>}
      <StructuralAssetGeometry family={asset.family} variant={asset.variant} detail={detail} />
    </svg>
  );
};
