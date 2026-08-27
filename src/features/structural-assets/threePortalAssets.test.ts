import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { THREE_PORTAL_ASSET_IDS, buildPortalGroup } from './threePortalAssets';

describe('Three.js portal asset scenes', () => {
  it('builds four distinct editable 3D scenes from structural primitives', () => {
    const signatures = THREE_PORTAL_ASSET_IDS.map((assetId) => {
      const group = buildPortalGroup(assetId, 'day');
      const meshes: THREE.Mesh[] = [];
      group.traverse((object) => { if (object instanceof THREE.Mesh) meshes.push(object); });
      expect(group.userData.assetId).toBe(assetId);
      expect(meshes.length, assetId).toBeGreaterThan(14);
      expect(meshes.every((mesh) => mesh.geometry instanceof THREE.BufferGeometry), assetId).toBe(true);
      return meshes.map((mesh) => `${mesh.geometry.type}:${mesh.position.toArray().map((value) => value.toFixed(2)).join(',')}`).join('|');
    });
    expect(new Set(signatures)).toHaveLength(4);
  });

  it('keeps the approved emerald connection material identical in Day and Night', () => {
    const accentHexes = (theme: 'day' | 'night') => {
      const group = buildPortalGroup('portal:single-bay', theme);
      const colors = new Set<string>();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) colors.add(object.material.color.getHexString());
      });
      return colors;
    };
    expect(accentHexes('day')).toContain('007d61');
    expect(accentHexes('night')).toContain('007d61');
  });
});
