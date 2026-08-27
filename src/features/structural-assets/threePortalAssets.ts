import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type StructuralRenderTheme = 'day' | 'night';
export type PortalAssetId = 'portal:single-bay' | 'portal:two-bay' | 'portal:two-story' | 'portal:industrial-pitched';

const PORTAL_IDS: readonly PortalAssetId[] = ['portal:single-bay', 'portal:two-bay', 'portal:two-story', 'portal:industrial-pitched'];
export const THREE_PORTAL_ASSET_IDS = PORTAL_IDS;

export type MaterialKit = {
  concrete: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  base: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  rebar: THREE.MeshStandardMaterial;
  edge: THREE.LineBasicMaterial;
};

export const createMaterialKit = (theme: StructuralRenderTheme): MaterialKit => ({
  concrete: new THREE.MeshStandardMaterial({ color: theme === 'day' ? 0xbab3a9 : 0xb9bdb8, roughness: 0.96, metalness: 0 }),
  steel: new THREE.MeshStandardMaterial({ color: theme === 'day' ? 0x667173 : 0x9ba3a2, roughness: 0.86, metalness: 0.16 }),
  base: new THREE.MeshStandardMaterial({ color: theme === 'day' ? 0xd7d0c5 : 0x9ca5a2, roughness: 0.98, metalness: 0 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x007d61, roughness: 0.92, metalness: 0.02 }),
  rebar: new THREE.MeshStandardMaterial({ color: 0x168a6c, roughness: 0.78, metalness: 0.22 }),
  edge: new THREE.LineBasicMaterial({ color: theme === 'day' ? 0x17383b : 0xf0ece4, transparent: true, opacity: theme === 'day' ? 0.48 : 0.64 }),
});

export const roundedMember = (
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: THREE.Material,
  edge: THREE.LineBasicMaterial,
  radius = 0.035,
) => {
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 4, Math.min(radius, Math.min(...size) * 0.22));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 32), edge);
  edges.renderOrder = 2;
  mesh.add(edges);
  return mesh;
};

export const segmentMember = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  section: readonly [number, number],
  material: THREE.Material,
  edge: THREE.LineBasicMaterial,
) => {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const member = roundedMember([length, section[0], section[1]], [0, 0, 0], material, edge, 0.025);
  member.position.copy(start.add(end).multiplyScalar(0.5));
  member.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
  return member;
};

export const addBase = (group: THREE.Group, kit: MaterialKit, width: number, depth: number) => {
  group.add(roundedMember([width, 0.2, depth], [0, -0.16, 0], kit.base, kit.edge, 0.06));
  const footingPositions = [[-width * 0.31, -0.01, -depth * 0.27], [width * 0.31, -0.01, -depth * 0.27], [-width * 0.31, -0.01, depth * 0.27], [width * 0.31, -0.01, depth * 0.27]] as const;
  for (const position of footingPositions) group.add(roundedMember([0.78, 0.15, 0.72], position, kit.base, kit.edge, 0.045));
};

const addColumn = (group: THREE.Group, kit: MaterialKit, x: number, z: number, height: number, material: 'concrete' | 'steel') => {
  const width = material === 'steel' ? 0.22 : 0.3;
  group.add(roundedMember([width, height, width], [x, height * 0.5 + 0.05, z], kit[material], kit.edge, material === 'steel' ? 0.025 : 0.045));
  group.add(roundedMember([width + 0.16, 0.075, width + 0.16], [x, 0.1, z], kit.accent, kit.edge, 0.018));
  group.add(roundedMember([width + 0.12, 0.07, width + 0.12], [x, height + 0.02, z], kit.accent, kit.edge, 0.018));
  if (material === 'concrete') {
    for (const offsetX of [-0.075, 0.075]) for (const offsetZ of [-0.075, 0.075]) {
      const rebar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 10), kit.rebar);
      rebar.position.set(x + offsetX, height + 0.2, z + offsetZ);
      rebar.castShadow = true;
      group.add(rebar);
    }
  }
};

const addConnectionPlate = (group: THREE.Group, kit: MaterialKit, position: readonly [number, number, number], rotationZ = 0) => {
  const plate = roundedMember([0.42, 0.33, 0.06], position, kit.accent, kit.edge, 0.025);
  plate.rotation.z = rotationZ;
  group.add(plate);
};

const addSingleOrMultiBay = (group: THREE.Group, kit: MaterialKit, xPositions: readonly number[], stories = 1) => {
  const depthPositions = [-0.68, 0.68] as const;
  const storyHeight = 1.35;
  const height = storyHeight * stories;
  addBase(group, kit, Math.max(...xPositions) - Math.min(...xPositions) + 1.25, 2.35);
  for (const z of depthPositions) {
    for (const x of xPositions) addColumn(group, kit, x, z, height, 'concrete');
    for (let story = 1; story <= stories; story += 1) {
      const y = story * storyHeight;
      for (let index = 0; index < xPositions.length - 1; index += 1) {
        group.add(segmentMember([xPositions[index], y, z], [xPositions[index + 1], y, z], [0.27, 0.3], kit.concrete, kit.edge));
      }
    }
  }
  for (const x of xPositions) {
    for (let story = 1; story <= stories; story += 1) {
      const y = story * storyHeight;
      group.add(segmentMember([x, y, depthPositions[0]], [x, y, depthPositions[1]], [0.25, 0.26], kit.concrete, kit.edge));
      addConnectionPlate(group, kit, [x, y, depthPositions[0] - 0.18]);
    }
  }
};

const addIndustrialPitched = (group: THREE.Group, kit: MaterialKit) => {
  const depthPositions = [-0.85, 0, 0.85] as const;
  addBase(group, kit, 5.3, 2.8);
  for (const z of depthPositions) {
    addColumn(group, kit, -2, z, 1.75, 'steel');
    addColumn(group, kit, 2, z, 1.75, 'steel');
    group.add(segmentMember([-2, 1.78, z], [0, 2.7, z], [0.2, 0.24], kit.steel, kit.edge));
    group.add(segmentMember([0, 2.7, z], [2, 1.78, z], [0.2, 0.24], kit.steel, kit.edge));
    addConnectionPlate(group, kit, [-1.96, 1.76, z - 0.15], 0.2);
    addConnectionPlate(group, kit, [1.96, 1.76, z - 0.15], -0.2);
    addConnectionPlate(group, kit, [0, 2.67, z - 0.15]);
  }
  for (const x of [-2, -1, 0, 1, 2]) {
    const y = 1.78 + (1 - Math.abs(x) / 2) * 0.92;
    group.add(segmentMember([x, y, depthPositions[0]], [x, y, depthPositions[2]], [0.11, 0.12], kit.steel, kit.edge));
  }
  group.add(segmentMember([-2, 0.22, -0.87], [2, 1.6, -0.87], [0.065, 0.07], kit.rebar, kit.edge));
  group.add(segmentMember([2, 0.22, 0.87], [-2, 1.6, 0.87], [0.065, 0.07], kit.rebar, kit.edge));
};

export const buildPortalGroup = (assetId: PortalAssetId, theme: StructuralRenderTheme) => {
  const group = new THREE.Group();
  group.name = assetId;
  group.userData.assetId = assetId;
  group.userData.theme = theme;
  const kit = createMaterialKit(theme);
  if (assetId === 'portal:single-bay') addSingleOrMultiBay(group, kit, [-1.55, 1.55]);
  if (assetId === 'portal:two-bay') addSingleOrMultiBay(group, kit, [-2, 0, 2]);
  if (assetId === 'portal:two-story') addSingleOrMultiBay(group, kit, [-1.55, 1.55], 2);
  if (assetId === 'portal:industrial-pitched') addIndustrialPitched(group, kit);
  return group;
};

export const disposeThreeObject = (root: THREE.Object3D) => root.traverse((object) => {
  if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  }
});

export const renderPortalAssetDataUrl = async (assetId: PortalAssetId, theme: StructuralRenderTheme, width = 900, height = 600) => {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme === 'day' ? 1.18 : 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const group = buildPortalGroup(assetId, theme);
  scene.add(group);
  scene.add(new THREE.HemisphereLight(theme === 'day' ? 0xfffbef : 0xe9f5f3, theme === 'day' ? 0x687577 : 0x061216, theme === 'day' ? 2.6 : 2.25));
  const key = new THREE.DirectionalLight(theme === 'day' ? 0xfff4dc : 0xdcefee, theme === 'day' ? 4.4 : 3.6);
  key.position.set(-4.5, 7, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(theme === 'day' ? 0xb8d9d1 : 0x78b8aa, 1.7);
  rim.position.set(5, 3, -5);
  scene.add(rim);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 4.8),
    new THREE.ShadowMaterial({ color: theme === 'day' ? 0x263330 : 0x000000, opacity: theme === 'day' ? 0.11 : 0.2 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.275;
  shadow.receiveShadow = true;
  scene.add(shadow);

  const aspect = width / height;
  const viewHalfHeight = assetId === 'portal:two-story' ? 2.75 : assetId === 'portal:industrial-pitched' ? 2.55 : assetId === 'portal:two-bay' ? 2.45 : 2.35;
  const camera = new THREE.OrthographicCamera(-viewHalfHeight * aspect, viewHalfHeight * aspect, viewHalfHeight, -viewHalfHeight, 0.1, 100);
  camera.position.set(5.4, assetId === 'portal:two-story' ? 4.3 : 3.65, 6.2);
  camera.lookAt(0, assetId === 'portal:two-story' ? 1.35 : 1.05, 0);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  await new Promise<void>((resolve) => requestAnimationFrame(() => { renderer.render(scene, camera); resolve(); }));
  const dataUrl = renderer.domElement.toDataURL('image/png');
  disposeThreeObject(scene);
  renderer.dispose();
  renderer.forceContextLoss();
  return dataUrl;
};
