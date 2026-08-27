import * as THREE from 'three';
import { STRUCTURAL_ASSET_REGISTRY } from './registry';
import { buildThreeFamilyGroup, THREE_FAMILY_ASSET_IDS, type ThreeFamilyAssetId } from './threeFamilyAssets';
import {
  buildPortalGroup,
  disposeThreeObject,
  THREE_PORTAL_ASSET_IDS,
  type PortalAssetId,
  type StructuralRenderTheme,
} from './threePortalAssets';
import {
  buildThreeTechnicalGroup,
  THREE_TECHNICAL_ASSET_IDS,
  type ThreeTechnicalAssetId,
} from './threeTechnicalAssets';

export type ThreeStructuralAssetId = PortalAssetId | ThreeFamilyAssetId | ThreeTechnicalAssetId;
const implementedAssetIds: readonly ThreeStructuralAssetId[] = [
  ...THREE_PORTAL_ASSET_IDS,
  ...THREE_FAMILY_ASSET_IDS,
  ...THREE_TECHNICAL_ASSET_IDS,
];
const implementedAssetIdSet = new Set<string>(implementedAssetIds);

export const isThreeStructuralAssetId = (assetId: string): assetId is ThreeStructuralAssetId => implementedAssetIdSet.has(assetId);

const registryAssetIds = STRUCTURAL_ASSET_REGISTRY.map((asset) => asset.id);
if (implementedAssetIdSet.size !== registryAssetIds.length || registryAssetIds.some((assetId) => !isThreeStructuralAssetId(assetId))) {
  throw new Error('Three.js structural manifest does not cover the canonical registry exactly');
}
export const THREE_STRUCTURAL_ASSET_IDS: readonly ThreeStructuralAssetId[] = Object.freeze(registryAssetIds.map((assetId) => {
  if (!isThreeStructuralAssetId(assetId)) throw new Error(`Missing Three.js structural scene: ${assetId}`);
  return assetId;
}));

const textureSlots = [
  'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap', 'envMap',
  'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap',
] as const;

export const validateThreeStructuralGroup = (group: THREE.Group, assetId: string) => {
  if (!(group instanceof THREE.Group)) throw new Error(`${assetId} must be an editable THREE.Group`);
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line) && !(object instanceof THREE.LineSegments)) return;
    if (!(object.geometry instanceof THREE.BufferGeometry)) throw new Error(`${assetId} contains non-editable geometry`);
    if (!(object instanceof THREE.Mesh)) return;
    if (object.geometry.type === 'PlaneGeometry') throw new Error(`${assetId} contains a decorative background plane`);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || material.constructor !== THREE.MeshStandardMaterial) {
        throw new Error(`${assetId} mesh material must be exactly MeshStandardMaterial`);
      }
      for (const slot of textureSlots) if (material[slot] !== null) throw new Error(`${assetId} mesh material uses ${slot}`);
      if (material.roughness < 0.78) throw new Error(`${assetId} mesh material is not matte`);
      if (material.transparent || material.opacity !== 1 || !material.depthWrite) throw new Error(`${assetId} mesh material is glass-like`);
      if (material.emissive.getHex() !== 0x000000) throw new Error(`${assetId} mesh material is emissive`);
    }
  });
  return group;
};

export type OrthographicFrame = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const calculateOrthographicFrame = (
  bounds: THREE.Box3,
  aspect: number,
  cameraDirection = new THREE.Vector3(5.4, 4.1, 6.2),
  padding = 1.16,
): OrthographicFrame => {
  const center = bounds.getCenter(new THREE.Vector3());
  const probe = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  probe.position.copy(center).add(cameraDirection.clone().normalize().multiplyScalar(10));
  probe.lookAt(center);
  probe.updateMatrixWorld(true);

  const projected = [
    [bounds.min.x, bounds.min.y, bounds.min.z], [bounds.min.x, bounds.min.y, bounds.max.z],
    [bounds.min.x, bounds.max.y, bounds.min.z], [bounds.min.x, bounds.max.y, bounds.max.z],
    [bounds.max.x, bounds.min.y, bounds.min.z], [bounds.max.x, bounds.min.y, bounds.max.z],
    [bounds.max.x, bounds.max.y, bounds.min.z], [bounds.max.x, bounds.max.y, bounds.max.z],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(probe.matrixWorldInverse));

  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));
  const frameCenterX = (minX + maxX) * 0.5;
  const frameCenterY = (minY + maxY) * 0.5;
  const contentHalfWidth = Math.max(1.2, (maxX - minX) * 0.5 * padding);
  const contentHalfHeight = Math.max(1.05, (maxY - minY) * 0.5 * padding);
  const halfHeight = Math.max(contentHalfHeight, contentHalfWidth / aspect);
  const halfWidth = halfHeight * aspect;
  return {
    left: frameCenterX - halfWidth,
    right: frameCenterX + halfWidth,
    top: frameCenterY + halfHeight,
    bottom: frameCenterY - halfHeight,
  };
};

const includesAssetId = <T extends string>(ids: readonly T[], assetId: string): assetId is T => ids.some((candidate) => candidate === assetId);

export const buildThreeStructuralGroup = (assetId: ThreeStructuralAssetId, theme: StructuralRenderTheme) => {
  const group = includesAssetId(THREE_PORTAL_ASSET_IDS, assetId)
    ? buildPortalGroup(assetId, theme)
    : includesAssetId(THREE_FAMILY_ASSET_IDS, assetId)
      ? buildThreeFamilyGroup(assetId, theme)
      : buildThreeTechnicalGroup(assetId, theme);
  return validateThreeStructuralGroup(group, assetId);
};

export const renderThreeStructuralAssetDataUrl = async (
  assetId: ThreeStructuralAssetId,
  theme: StructuralRenderTheme,
  width = 900,
  height = 600,
) => {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme === 'day' ? 1.16 : 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const group = buildThreeStructuralGroup(assetId, theme);
  scene.add(group);
  scene.add(new THREE.HemisphereLight(theme === 'day' ? 0xfffbef : 0xe9f5f3, theme === 'day' ? 0x687577 : 0x061216, theme === 'day' ? 2.6 : 2.25));
  const key = new THREE.DirectionalLight(theme === 'day' ? 0xfff4dc : 0xdcefee, theme === 'day' ? 4.2 : 3.5);
  key.position.set(-4.5, 7, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  scene.add(key);
  const rim = new THREE.DirectionalLight(theme === 'day' ? 0xb8d9d1 : 0x78b8aa, 1.55);
  rim.position.set(5, 3, -5);
  scene.add(rim);

  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(4, size.x + 1.15), Math.max(3.4, size.z + 1.15)),
    new THREE.ShadowMaterial({ color: theme === 'day' ? 0x263330 : 0x000000, opacity: theme === 'day' ? 0.1 : 0.18 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(center.x, bounds.min.y - 0.055, center.z);
  shadow.receiveShadow = true;
  scene.add(shadow);

  const aspect = width / height;
  const cameraDirection = new THREE.Vector3(5.4, 4.1, 6.2);
  const frame = calculateOrthographicFrame(bounds, aspect, cameraDirection);
  const camera = new THREE.OrthographicCamera(frame.left, frame.right, frame.top, frame.bottom, 0.1, 100);
  const lookAt = center;
  camera.position.copy(lookAt).add(cameraDirection.normalize().multiplyScalar(10));
  camera.lookAt(lookAt);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  await new Promise<void>((resolve) => requestAnimationFrame(() => { renderer.render(scene, camera); resolve(); }));
  const dataUrl = renderer.domElement.toDataURL('image/png');
  disposeThreeObject(scene);
  renderer.dispose();
  renderer.forceContextLoss();
  return dataUrl;
};
