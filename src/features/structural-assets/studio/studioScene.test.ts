// @vitest-environment jsdom
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildStudioScene, disposeStudioScene, getStudioExportDimensions, serializeStudioSvg, withStudioScene } from './studioScene';
import { createFactoryStudioParameters } from './presetRepository';
import { THREE_TECHNICAL_ASSET_IDS } from '../threeTechnicalAssets';

describe('Illustration Studio canonical scene and export', () => {
  it('applies the same normalized group and camera transforms used by preview and export', () => {
    const parameters = { ...createFactoryStudioParameters('portal:two-story'), widthScale: 1.4, heightScale: .8, depthScale: 1.2, camera: 'front' as const };
    const preview = buildStudioScene(parameters);
    const exported = buildStudioScene(parameters);
    expect(preview.group.userData.assetId).toBe('portal:two-story');
    expect(preview.group.scale.toArray()).toEqual([1.4, .8, 1.2]);
    expect(exported.group.scale.toArray()).toEqual(preview.group.scale.toArray());
    expect(exported.camera.position.toArray()).toEqual(preview.camera.position.toArray());
    expect(exported.camera.toJSON().object).toMatchObject({ left: preview.camera.left, right: preview.camera.right, top: preview.camera.top, bottom: preview.camera.bottom });
    expect(preview.scene.children.some((child) => child instanceof THREE.Mesh && (child as THREE.Mesh).geometry.type === 'PlaneGeometry')).toBe(false);
  });

  it('keeps technical load colors identical between Day and Night', () => {
    const colors = (theme: 'light' | 'dark') => {
      const bundle = buildStudioScene({ ...createFactoryStudioParameters('load:point'), previewTheme: theme });
      const result: string[] = [];
      bundle.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const material = object.material as THREE.MeshStandardMaterial;
        result.push(`#${material.color.getHexString()}`);
      });
      disposeStudioScene(bundle);
      return result;
    };
    expect(colors('light')).toContain('#2f73c8');
    expect(colors('dark')).toContain('#2f73c8');
  });

  it('uses an independently asserted 3:2 camera composition', () => {
    const bundle = buildStudioScene({ ...createFactoryStudioParameters('portal:two-story'), widthScale: 1.4, heightScale: .8, depthScale: 1.2, camera: 'front' });
    expect((bundle.camera.right - bundle.camera.left) / (bundle.camera.top - bundle.camera.bottom)).toBeCloseTo(1.5, 10);
    expect(bundle.group.scale.toArray()).toEqual([1.4, .8, 1.2]);
    expect(bundle.parameters).toMatchObject({ assetId: 'portal:two-story', camera: 'front', widthScale: 1.4, heightScale: .8, depthScale: 1.2 });
  });

  it('preserves the complete persistent technical palette for every technical asset under every theme and material override', () => {
    const expectedByAsset: Record<string, readonly string[]> = {
      'space-frame:single-module': ['#007d61', '#168a6c'], 'space-frame:multi-bay': ['#007d61', '#168a6c'], 'space-frame:two-story': ['#007d61', '#168a6c'], 'space-frame:industrial-shed': ['#007d61', '#168a6c'],
      'support:pin': ['#007d61'], 'support:roller': ['#007d61'], 'support:fixed': ['#007d61'], 'support:spring': ['#007d61'],
      'load:point': ['#007d61', '#2f73c8'], 'load:distributed': ['#007d61', '#65a323'], 'load:varying': ['#007d61', '#65a323'], 'load:applied-moment': ['#007d61', '#c65f86'],
      'section:rectangular': ['#168a6c'], 'section:circular': ['#168a6c'], 'section:i-profile': ['#007d61'], 'section:box': ['#007d61'],
      'connection:rigid': ['#007d61'], 'connection:pinned': ['#007d61', '#168a6c'], 'connection:base-plate': ['#007d61', '#168a6c'], 'connection:splice': ['#007d61'],
    };
    const colors = (assetId: (typeof THREE_TECHNICAL_ASSET_IDS)[number], previewTheme: 'light' | 'dark', material: 'concrete' | 'steel' | 'timber' | 'technical') => {
      const bundle = buildStudioScene({ ...createFactoryStudioParameters(assetId), previewTheme, material });
      const result = new Set<string>();
      bundle.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((candidate) => {
          if (candidate instanceof THREE.MeshStandardMaterial) result.add(`#${candidate.color.getHexString()}`);
        });
      });
      disposeStudioScene(bundle);
      return result;
    };
    for (const assetId of THREE_TECHNICAL_ASSET_IDS) for (const previewTheme of ['light', 'dark'] as const) for (const material of ['concrete', 'steel', 'timber', 'technical'] as const) {
      for (const expected of expectedByAsset[assetId]) expect(colors(assetId, previewTheme, material), `${assetId}/${previewTheme}/${material}`).toContain(expected);
    }
  }, 30_000);

  it('serializes a transparent 900x600 SVG from the transformed Three scene and camera', () => {
    const svg = serializeStudioSvg({ ...createFactoryStudioParameters('truss:warren'), widthScale: 1.25, camera: 'side' });
    expect(svg).toContain('width="900"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain('viewBox="-450 -300 900 600"');
    expect(svg).not.toMatch(/background(?:-color)?\s*:/i);
    expect(svg).not.toMatch(/<rect[^>]+(?:fill|style)=/i);
    expect(svg).toMatch(/<(?:path|polygon)/);
    expect(svg).toContain('data-studio-composition="3:2"');
    expect(svg).toContain('data-studio-camera="side"');
    expect(svg).toContain('data-studio-scales="1.25,1,1"');
    expect(svg).not.toMatch(/<(?:filter|linearGradient|radialGradient|image|script|foreignObject)\b/i);
    expect(svg).not.toMatch(/(?:href|src)=["'](?:https?:|\/\/)/i);
  });

  it('disposes the scene even when same-scene serialization fails', () => {
    const dispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    expect(() => withStudioScene(createFactoryStudioParameters('truss:warren'), () => { throw new Error('serialize failed'); })).toThrow('serialize failed');
    expect(dispose).toHaveBeenCalled();
    dispose.mockRestore();
  });

  it('defines exact transparent PNG dimensions at logical 900x600 for 1x, 2x and 4x', () => {
    expect(getStudioExportDimensions(1)).toEqual({ width: 900, height: 600, alpha: true });
    expect(getStudioExportDimensions(2)).toEqual({ width: 1800, height: 1200, alpha: true });
    expect(getStudioExportDimensions(4)).toEqual({ width: 3600, height: 2400, alpha: true });
  });
});
