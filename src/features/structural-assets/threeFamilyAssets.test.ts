import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildThreeFamilyGroup, THREE_FAMILY_ASSET_IDS } from './threeFamilyAssets';

describe('Three.js structural family scenes', () => {
  it('builds sixteen distinct editable scenes across beams, cantilevers, trusses and slabs', () => {
    const signatures = THREE_FAMILY_ASSET_IDS.map((assetId) => {
      const group = buildThreeFamilyGroup(assetId, 'day');
      const meshes: THREE.Mesh[] = [];
      group.traverse((object) => { if (object instanceof THREE.Mesh) meshes.push(object); });
      expect(meshes.length, assetId).toBeGreaterThan(3);
      expect(group.userData.assetId).toBe(assetId);
      return meshes.map((mesh) => `${mesh.geometry.type}:${mesh.position.toArray().map((value) => value.toFixed(2)).join(',')}:${mesh.quaternion.toArray().map((value) => value.toFixed(3)).join(',')}`).join('|');
    });
    expect(new Set(signatures)).toHaveLength(16);
  });

  it('keeps every family free of textures, backgrounds and non-editable raster content', () => {
    for (const assetId of THREE_FAMILY_ASSET_IDS) {
      const group = buildThreeFamilyGroup(assetId, 'night');
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
        expect(object.material.map, assetId).toBeNull();
        expect(object.material.roughness, assetId).toBeGreaterThanOrEqual(0.78);
      });
    }
  });
});
