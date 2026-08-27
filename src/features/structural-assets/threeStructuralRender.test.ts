import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { STRUCTURAL_ASSET_REGISTRY } from './registry';
import {
  buildThreeStructuralGroup,
  calculateOrthographicFrame,
  isThreeStructuralAssetId,
  THREE_STRUCTURAL_ASSET_IDS,
} from './threeStructuralRender';
import { buildThreeFamilyGroup, THREE_FAMILY_ASSET_IDS } from './threeFamilyAssets';

describe('Three.js structural render framing', () => {
  it('derives the Three.js manifest from canonical registry ids and order', () => {
    expect(THREE_STRUCTURAL_ASSET_IDS).toEqual(STRUCTURAL_ASSET_REGISTRY.map((asset) => asset.id));
    expect(THREE_STRUCTURAL_ASSET_IDS.every(isThreeStructuralAssetId)).toBe(true);
    expect(isThreeStructuralAssetId('unknown:asset')).toBe(false);
  });

  it('builds forty distinct editable scene signatures without cross-family collisions', () => {
    const signatures = new Set<string>();
    for (const assetId of THREE_STRUCTURAL_ASSET_IDS) {
      const group = buildThreeStructuralGroup(assetId, 'day');
      expect(group).toBeInstanceOf(THREE.Group);
      expect(group.userData.assetId).toBe(assetId);
      const parts: string[] = [];
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line) && !(object instanceof THREE.LineSegments)) return;
        expect(object.geometry, assetId).toBeInstanceOf(THREE.BufferGeometry);
        parts.push([
          object.type,
          object.geometry.type,
          object.position.toArray().map((value) => value.toFixed(3)).join(','),
          object.quaternion.toArray().map((value) => value.toFixed(3)).join(','),
          object.scale.toArray().map((value) => value.toFixed(3)).join(','),
        ].join(':'));
      });
      expect(parts.length, assetId).toBeGreaterThan(3);
      signatures.add(parts.join('|'));
    }
    expect(signatures).toHaveLength(40);
  }, 20_000);

  it('keeps every family asset inside a padded 3:2 orthographic frame', () => {
    const direction = new THREE.Vector3(5.4, 4.1, 6.2);
    for (const assetId of THREE_FAMILY_ASSET_IDS) {
      const bounds = new THREE.Box3().setFromObject(buildThreeFamilyGroup(assetId, 'day'));
      const center = bounds.getCenter(new THREE.Vector3());
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      camera.position.copy(center).add(direction.clone().normalize().multiplyScalar(10));
      camera.lookAt(center);
      camera.updateMatrixWorld(true);
      const frame = calculateOrthographicFrame(bounds, 1.5, direction);
      const corners = [
        [bounds.min.x, bounds.min.y, bounds.min.z], [bounds.min.x, bounds.min.y, bounds.max.z],
        [bounds.min.x, bounds.max.y, bounds.min.z], [bounds.min.x, bounds.max.y, bounds.max.z],
        [bounds.max.x, bounds.min.y, bounds.min.z], [bounds.max.x, bounds.min.y, bounds.max.z],
        [bounds.max.x, bounds.max.y, bounds.min.z], [bounds.max.x, bounds.max.y, bounds.max.z],
      ].map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));

      for (const point of corners) {
        expect(point.x, `${assetId} left`).toBeGreaterThan(frame.left);
        expect(point.x, `${assetId} right`).toBeLessThan(frame.right);
        expect(point.y, `${assetId} bottom`).toBeGreaterThan(frame.bottom);
        expect(point.y, `${assetId} top`).toBeLessThan(frame.top);
      }
      expect((frame.right - frame.left) / (frame.top - frame.bottom), assetId).toBeCloseTo(1.5, 5);
    }
  });
});
