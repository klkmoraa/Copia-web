import { useState } from 'react';
import { StructuralIllustration } from './StructuralIllustration';
import type { StructuralRenderTheme } from './threePortalAssets';
import type { ThreeStructuralAssetId } from './threeStructuralRender';
import './threeStructuralImage.css';

interface ThreeStructuralImageProps {
  assetId: ThreeStructuralAssetId;
  theme: 'light' | 'dark';
  alt?: string;
  className?: string;
  eager?: boolean;
}

export const resolveStructuralAssetUrl = (
  assetId: ThreeStructuralAssetId,
  theme: StructuralRenderTheme,
  baseUrl = import.meta.env.BASE_URL,
) => {
  const [family, variant] = assetId.split(':');
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}assets/structural/${theme}/${family}/${variant}.png`;
};

export function ThreeStructuralImage({ assetId, theme, alt = '', className = '', eager = false }: ThreeStructuralImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <StructuralIllustration assetId={assetId} detail="hero" decorative={alt.length === 0} title={alt || undefined} motion="none" className={className} />;
  return <img
    alt={alt}
    className={`three-structural-image ${className}`.trim()}
    data-structural-asset-id={assetId}
    data-structural-render="three-prerender"
    data-render-theme={theme === 'dark' ? 'night' : 'day'}
    decoding="async"
    draggable={false}
    height="600"
    loading={eager ? 'eager' : 'lazy'}
    onError={() => setFailed(true)}
    src={resolveStructuralAssetUrl(assetId, theme === 'dark' ? 'night' : 'day')}
    width="900"
  />;
}
