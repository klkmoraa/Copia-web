import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  THREE_TECHNICAL_ASSET_IDS,
  buildThreeTechnicalGroup,
} from './threeTechnicalAssets';
import {
  buildThreeStructuralGroup,
  THREE_STRUCTURAL_ASSET_IDS,
  validateThreeStructuralGroup,
} from './threeStructuralRender';

const EXPECTED_IDS = [
  'space-frame:single-module', 'space-frame:multi-bay', 'space-frame:two-story', 'space-frame:industrial-shed',
  'support:pin', 'support:roller', 'support:fixed', 'support:spring',
  'load:point', 'load:distributed', 'load:varying', 'load:applied-moment',
  'section:rectangular', 'section:circular', 'section:i-profile', 'section:box',
  'connection:rigid', 'connection:pinned', 'connection:base-plate', 'connection:splice',
] as const;

const meshSignature = (group: THREE.Group) => {
  const parts: string[] = [];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments) && !(object instanceof THREE.Line)) return;
    parts.push([
      object.type,
      object.geometry.type,
      object.position.toArray().map((value) => value.toFixed(3)).join(','),
      object.quaternion.toArray().map((value) => value.toFixed(3)).join(','),
      object.scale.toArray().map((value) => value.toFixed(3)).join(','),
    ].join(':'));
  });
  return parts.join('|');
};

const standardMaterialColors = (group: THREE.Group) => {
  const colors = new Set<string>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) colors.add(`#${material.color.getHexString()}`);
    }
  });
  return colors;
};

describe('Three.js technical structural scenes', () => {
  it('provides exactly the twenty approved technical asset IDs', () => {
    expect(THREE_TECHNICAL_ASSET_IDS).toEqual(EXPECTED_IDS);
  });

  it('builds twenty distinct editable structural scenes', () => {
    const signatures = THREE_TECHNICAL_ASSET_IDS.map((assetId) => {
      const group = buildThreeTechnicalGroup(assetId, 'day');
      let editableObjects = 0;
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
          editableObjects += 1;
          expect(object.geometry, assetId).toBeInstanceOf(THREE.BufferGeometry);
        }
      });
      expect(group.userData.assetId).toBe(assetId);
      expect(editableObjects, assetId).toBeGreaterThan(3);
      return meshSignature(group);
    });
    expect(new Set(signatures)).toHaveLength(20);
  });

  it('rejects unsupported mesh material classes', () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    expect(() => validateThreeStructuralGroup(group, 'invalid:test')).toThrow(/MeshStandardMaterial/);
  });

  it('rejects glass-like physical material subclasses with physical texture slots', () => {
    const group = new THREE.Group();
    const physicalTexture = new THREE.Texture();
    const physicalMaterial = new THREE.MeshPhysicalMaterial({ roughness: 1, transmission: 1 });
    physicalMaterial.transmissionMap = physicalTexture;
    physicalMaterial.thicknessMap = physicalTexture;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), physicalMaterial));

    expect(() => validateThreeStructuralGroup(group, 'invalid:physical')).toThrow(/MeshStandardMaterial/);

    physicalTexture.dispose();
    physicalMaterial.dispose();
  });

  it('uses only opaque matte texture-free standard materials across all forty scenes', () => {
    const textureSlots = [
      'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap', 'envMap',
      'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap',
    ] as const;
    for (const theme of ['day', 'night'] as const) {
      for (const assetId of THREE_STRUCTURAL_ASSET_IDS) {
        const group = buildThreeStructuralGroup(assetId, theme);
        expect(() => validateThreeStructuralGroup(group, assetId)).not.toThrow();
        group.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          expect(object.geometry.type, `${assetId} background plane`).not.toBe('PlaneGeometry');
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            expect(material, `${assetId} material class`).toBeInstanceOf(THREE.MeshStandardMaterial);
            if (!(material instanceof THREE.MeshStandardMaterial)) throw new Error(`${assetId} uses unsupported mesh material`);
            for (const slot of textureSlots) expect(material[slot], `${assetId} ${slot}`).toBeNull();
            expect(material.roughness, assetId).toBeGreaterThanOrEqual(0.78);
            expect(material.transparent, assetId).toBe(false);
            expect(material.opacity, assetId).toBe(1);
            expect(material.depthWrite, assetId).toBe(true);
            expect(material.emissive.getHex(), assetId).toBe(0x000000);
          }
        });
      }
    }
  }, 15_000);

  it('keeps exact load colors identical in Day and Night', () => {
    const expected = new Map([
      ['load:point', '#2f73c8'],
      ['load:distributed', '#65a323'],
      ['load:varying', '#65a323'],
      ['load:applied-moment', '#c65f86'],
    ] as const);
    for (const theme of ['day', 'night'] as const) {
      for (const [assetId, color] of expected) {
        expect(standardMaterialColors(buildThreeTechnicalGroup(assetId, theme))).toContain(color);
      }
    }
  });
});
