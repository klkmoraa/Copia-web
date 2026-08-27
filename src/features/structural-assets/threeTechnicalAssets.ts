import * as THREE from 'three';
import {
  createMaterialKit,
  roundedMember,
  segmentMember,
  type MaterialKit,
  type StructuralRenderTheme,
} from './threePortalAssets';

export const THREE_TECHNICAL_ASSET_IDS = [
  'space-frame:single-module', 'space-frame:multi-bay', 'space-frame:two-story', 'space-frame:industrial-shed',
  'support:pin', 'support:roller', 'support:fixed', 'support:spring',
  'load:point', 'load:distributed', 'load:varying', 'load:applied-moment',
  'section:rectangular', 'section:circular', 'section:i-profile', 'section:box',
  'connection:rigid', 'connection:pinned', 'connection:base-plate', 'connection:splice',
] as const;

export type ThreeTechnicalAssetId = typeof THREE_TECHNICAL_ASSET_IDS[number];

const LOAD_COLORS = {
  point: 0x2f73c8,
  distributed: 0x65a323,
  moment: 0xc65f86,
} as const;

const matteMaterial = (color: number, metalness = 0.02) => new THREE.MeshStandardMaterial({
  color,
  metalness,
  roughness: 0.9,
});

const addCylinder = (
  group: THREE.Group,
  radius: number,
  length: number,
  position: readonly [number, number, number],
  material: THREE.Material,
  axis: 'x' | 'y' | 'z' = 'y',
  radialSegments = 20,
) => {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

const addSphere = (
  group: THREE.Group,
  radius: number,
  position: readonly [number, number, number],
  material: THREE.Material,
) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
};

const addNode = (group: THREE.Group, kit: MaterialKit, x: number, y: number, z: number) => (
  addSphere(group, 0.105, [x, y, z], kit.accent)
);

const addSpaceFooting = (group: THREE.Group, kit: MaterialKit, x: number, z: number) => {
  group.add(roundedMember([0.64, 0.14, 0.64], [x, -0.05, z], kit.base, kit.edge, 0.04));
  group.add(roundedMember([0.34, 0.08, 0.34], [x, 0.06, z], kit.accent, kit.edge, 0.018));
};

const addSpaceGrid = (
  group: THREE.Group,
  kit: MaterialKit,
  xPositions: readonly number[],
  zPositions: readonly number[],
  stories: number,
) => {
  const storyHeight = 1.18;
  for (const x of xPositions) for (const z of zPositions) {
    addSpaceFooting(group, kit, x, z);
    group.add(segmentMember([x, 0.08, z], [x, storyHeight * stories, z], [0.17, 0.17], kit.steel, kit.edge));
    for (let story = 1; story <= stories; story += 1) addNode(group, kit, x, storyHeight * story, z);
  }
  for (let story = 1; story <= stories; story += 1) {
    const y = storyHeight * story;
    for (const z of zPositions) for (let i = 0; i < xPositions.length - 1; i += 1) {
      group.add(segmentMember([xPositions[i], y, z], [xPositions[i + 1], y, z], [0.14, 0.15], kit.steel, kit.edge));
    }
    for (const x of xPositions) for (let i = 0; i < zPositions.length - 1; i += 1) {
      group.add(segmentMember([x, y, zPositions[i]], [x, y, zPositions[i + 1]], [0.14, 0.15], kit.steel, kit.edge));
    }
  }
};

const addRoofBracing = (group: THREE.Group, kit: MaterialKit, x0: number, x1: number, z0: number, z1: number, y: number) => {
  group.add(segmentMember([x0, y + 0.025, z0], [x1, y + 0.025, z1], [0.055, 0.06], kit.rebar, kit.edge));
  group.add(segmentMember([x0, y + 0.025, z1], [x1, y + 0.025, z0], [0.055, 0.06], kit.rebar, kit.edge));
};

const buildSpaceFrame = (variant: string, kit: MaterialKit) => {
  const group = new THREE.Group();
  if (variant === 'single-module') {
    addSpaceGrid(group, kit, [-1.35, 1.35], [-0.85, 0.85], 1);
    addRoofBracing(group, kit, -1.35, 1.35, -0.85, 0.85, 1.18);
  } else if (variant === 'multi-bay') {
    addSpaceGrid(group, kit, [-2.15, 0, 2.15], [-0.82, 0.82], 1);
    addRoofBracing(group, kit, -2.15, 0, -0.82, 0.82, 1.18);
    addRoofBracing(group, kit, 0, 2.15, -0.82, 0.82, 1.18);
  } else if (variant === 'two-story') {
    addSpaceGrid(group, kit, [-1.45, 1.45], [-0.88, 0.88], 2);
    addRoofBracing(group, kit, -1.45, 1.45, -0.88, 0.88, 1.18);
    addRoofBracing(group, kit, -1.45, 1.45, -0.88, 0.88, 2.36);
    group.add(segmentMember([-1.45, 0.12, -0.9], [1.45, 1.12, -0.9], [0.06, 0.065], kit.rebar, kit.edge));
  } else {
    const zPositions = [-1.05, 0, 1.05] as const;
    for (const z of zPositions) {
      for (const x of [-2.1, 2.1]) {
        addSpaceFooting(group, kit, x, z);
        group.add(segmentMember([x, 0.08, z], [x, 1.55, z], [0.18, 0.18], kit.steel, kit.edge));
      }
      group.add(segmentMember([-2.1, 1.55, z], [0, 2.38, z], [0.16, 0.17], kit.steel, kit.edge));
      group.add(segmentMember([0, 2.38, z], [2.1, 1.55, z], [0.16, 0.17], kit.steel, kit.edge));
      addNode(group, kit, 0, 2.38, z);
    }
    for (const x of [-2.1, 0, 2.1]) group.add(segmentMember([x, x === 0 ? 2.38 : 1.55, -1.05], [x, x === 0 ? 2.38 : 1.55, 1.05], [0.105, 0.11], kit.steel, kit.edge));
    group.add(segmentMember([-2.05, 0.12, -1.08], [2.05, 1.45, -1.08], [0.06, 0.065], kit.rebar, kit.edge));
    group.add(segmentMember([2.05, 0.12, 1.08], [-2.05, 1.45, 1.08], [0.06, 0.065], kit.rebar, kit.edge));
  }
  return group;
};

const addSupportBeam = (group: THREE.Group, kit: MaterialKit, fromX = -0.15, toX = 1.95, y = 1.2) => {
  group.add(segmentMember([fromX, y, 0], [toX, y, 0], [0.24, 0.32], kit.steel, kit.edge));
};

const addTriangleSupport = (group: THREE.Group, kit: MaterialKit, y = 0.58) => {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.43, 0.62, 4), kit.steel);
  cone.position.set(0, y, 0);
  cone.rotation.y = Math.PI / 4;
  cone.castShadow = true;
  cone.add(new THREE.LineSegments(new THREE.EdgesGeometry(cone.geometry), kit.edge));
  group.add(cone);
  addSphere(group, 0.13, [0, y + 0.35, 0], kit.accent);
};

const buildSupport = (variant: string, kit: MaterialKit) => {
  const group = new THREE.Group();
  if (variant === 'fixed') {
    group.add(roundedMember([0.46, 2.55, 1.45], [-0.35, 1.05, 0], kit.concrete, kit.edge, 0.04));
    addSupportBeam(group, kit, -0.18, 2.15, 1.25);
    group.add(roundedMember([0.12, 0.68, 0.72], [-0.08, 1.25, 0], kit.accent, kit.edge, 0.018));
    for (const y of [0.22, 0.58, 0.94, 1.66, 2.02]) group.add(segmentMember([-0.62, y, 0.74], [-0.14, y + 0.28, 0.74], [0.035, 0.04], kit.steel, kit.edge));
  } else if (variant === 'spring') {
    addSupportBeam(group, kit, -1.05, 1.05, 1.85);
    addSphere(group, 0.13, [0, 1.65, 0], kit.accent);
    const points: THREE.Vector3[] = [];
    const turns = 6;
    for (let i = 0; i <= 64; i += 1) {
      const t = i / 64;
      points.push(new THREE.Vector3(Math.sin(t * Math.PI * 2 * turns) * 0.28, 1.55 - t * 1.18, Math.cos(t * Math.PI * 2 * turns) * 0.08));
    }
    const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, 0.055, 10, false), kit.steel);
    spring.castShadow = true;
    group.add(spring);
    group.add(roundedMember([1.25, 0.16, 0.95], [0, 0.18, 0], kit.base, kit.edge, 0.04));
    for (const x of [-0.45, 0, 0.45]) addCylinder(group, 0.06, 0.22, [x, 0.3, 0], kit.accent);
  } else {
    addSupportBeam(group, kit, -1.25, 1.25, 1.34);
    addTriangleSupport(group, kit, variant === 'roller' ? 0.7 : 0.62);
    if (variant === 'roller') {
      for (const x of [-0.27, 0, 0.27]) addCylinder(group, 0.09, 0.72, [x, 0.25, 0], kit.steel, 'z');
      group.add(roundedMember([1.22, 0.13, 0.94], [0, 0.06, 0], kit.base, kit.edge, 0.035));
    } else {
      group.add(roundedMember([1.18, 0.18, 0.94], [0, 0.18, 0], kit.base, kit.edge, 0.04));
      for (const x of [-0.36, 0.36]) addCylinder(group, 0.055, 0.24, [x, 0.31, 0], kit.accent);
    }
  }
  return group;
};

const addArrow = (
  group: THREE.Group,
  position: readonly [number, number, number],
  length: number,
  material: THREE.MeshStandardMaterial,
) => {
  const [x, y, z] = position;
  addCylinder(group, 0.055, Math.max(0.2, length - 0.28), [x, y + length * 0.5 + 0.14, z], material);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 18), material);
  head.position.set(x, y + 0.17, z);
  head.rotation.z = Math.PI;
  head.castShadow = true;
  group.add(head);
};

const addLoadReference = (group: THREE.Group, kit: MaterialKit) => {
  group.add(segmentMember([-2.25, 0.72, 0], [2.25, 0.72, 0], [0.25, 0.34], kit.steel, kit.edge));
  addSphere(group, 0.12, [-2.15, 0.72, 0], kit.accent);
  addSphere(group, 0.12, [2.15, 0.72, 0], kit.accent);
  group.add(roundedMember([0.55, 0.12, 0.62], [-2.15, 0.08, 0], kit.base, kit.edge, 0.035));
  group.add(roundedMember([0.55, 0.12, 0.62], [2.15, 0.08, 0], kit.base, kit.edge, 0.035));
};

const buildLoad = (variant: string, kit: MaterialKit) => {
  const group = new THREE.Group();
  addLoadReference(group, kit);
  if (variant === 'point') {
    const material = matteMaterial(LOAD_COLORS.point);
    addArrow(group, [0, 0.93, 0], 1.7, material);
    addCylinder(group, 0.12, 0.16, [0, 0.83, 0], material, 'z');
  } else if (variant === 'distributed' || variant === 'varying') {
    const material = matteMaterial(LOAD_COLORS.distributed);
    const positions = [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8];
    positions.forEach((x, index) => addArrow(group, [x, 0.93, 0], variant === 'varying' ? 0.55 + index * 0.2 : 1.25, material));
    group.add(segmentMember([-1.8, variant === 'varying' ? 1.62 : 2.32, 0], [1.8, variant === 'varying' ? 2.82 : 2.32, 0], [0.06, 0.07], material, kit.edge));
  } else {
    const material = matteMaterial(LOAD_COLORS.moment);
    const points: THREE.Vector3[] = [];
    for (let index = 0; index <= 36; index += 1) {
      const angle = Math.PI * 0.25 + (index / 36) * Math.PI * 1.55;
      points.push(new THREE.Vector3(Math.cos(angle) * 0.88, 1.65 + Math.sin(angle) * 0.88, 0));
    }
    const arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.055, 10, false), material);
    arc.castShadow = true;
    group.add(arc);
    const last = points.at(-1)!;
    const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.38, 18), material);
    arrowHead.position.copy(last);
    arrowHead.rotation.z = -0.55;
    arrowHead.castShadow = true;
    group.add(arrowHead);
    addSphere(group, 0.13, [0, 0.93, 0], material);
  }
  return group;
};

const addRebarArray = (group: THREE.Group, kit: MaterialKit, points: readonly (readonly [number, number])[]) => {
  for (const [x, y] of points) addCylinder(group, 0.055, 0.7, [x, y, 0], kit.rebar, 'z', 14);
};

const buildSection = (variant: string, kit: MaterialKit) => {
  const group = new THREE.Group();
  if (variant === 'rectangular') {
    group.add(roundedMember([2.25, 1.55, 0.68], [0, 0.9, 0], kit.concrete, kit.edge, 0.08));
    addRebarArray(group, kit, [[-0.82, 0.42], [0.82, 0.42], [-0.82, 1.38], [0.82, 1.38]]);
  } else if (variant === 'circular') {
    addCylinder(group, 1.02, 0.72, [0, 1.05, 0], kit.concrete, 'z', 48);
    const reinforcement = Array.from({ length: 8 }, (_, index) => {
      const angle = index * Math.PI / 4;
      return [Math.cos(angle) * 0.67, 1.05 + Math.sin(angle) * 0.67] as const;
    });
    addRebarArray(group, kit, reinforcement);
  } else if (variant === 'i-profile') {
    group.add(roundedMember([2.45, 0.34, 0.74], [0, 1.82, 0], kit.steel, kit.edge, 0.045));
    group.add(roundedMember([0.38, 1.65, 0.74], [0, 1.02, 0], kit.steel, kit.edge, 0.035));
    group.add(roundedMember([2.45, 0.34, 0.74], [0, 0.22, 0], kit.steel, kit.edge, 0.045));
    for (const y of [0.38, 1.66]) group.add(roundedMember([0.68, 0.12, 0.82], [0, y, 0], kit.accent, kit.edge, 0.018));
  } else {
    const outerWidth = 2.35;
    const outerHeight = 1.8;
    const wall = 0.28;
    group.add(roundedMember([outerWidth, wall, 0.76], [0, wall * 0.5, 0], kit.steel, kit.edge, 0.04));
    group.add(roundedMember([outerWidth, wall, 0.76], [0, outerHeight - wall * 0.5, 0], kit.steel, kit.edge, 0.04));
    group.add(roundedMember([wall, outerHeight - wall * 2, 0.76], [-outerWidth * 0.5 + wall * 0.5, outerHeight * 0.5, 0], kit.steel, kit.edge, 0.04));
    group.add(roundedMember([wall, outerHeight - wall * 2, 0.76], [outerWidth * 0.5 - wall * 0.5, outerHeight * 0.5, 0], kit.steel, kit.edge, 0.04));
    for (const x of [-0.86, 0.86]) group.add(roundedMember([0.12, 0.42, 0.84], [x, 0.9, 0], kit.accent, kit.edge, 0.018));
  }
  return group;
};

const addBolt = (group: THREE.Group, kit: MaterialKit, x: number, y: number, z: number) => {
  addCylinder(group, 0.075, 0.32, [x, y, z], kit.accent, 'z', 14);
  addCylinder(group, 0.12, 0.045, [x, y, z + 0.18], kit.accent, 'z', 6);
};

const addConnectionColumn = (group: THREE.Group, kit: MaterialKit, x = -1.1) => {
  group.add(roundedMember([0.42, 2.65, 0.72], [x, 1.22, 0], kit.steel, kit.edge, 0.04));
};

const buildConnection = (variant: string, kit: MaterialKit) => {
  const group = new THREE.Group();
  if (variant === 'base-plate') {
    group.add(roundedMember([3.1, 0.42, 2.05], [0, 0.05, 0], kit.concrete, kit.edge, 0.07));
    group.add(roundedMember([1.8, 0.16, 1.45], [0, 0.34, 0], kit.accent, kit.edge, 0.025));
    group.add(roundedMember([0.5, 2.2, 0.72], [0, 1.48, 0], kit.steel, kit.edge, 0.04));
    for (const x of [-0.64, 0.64]) for (const z of [-0.48, 0.48]) {
      addCylinder(group, 0.07, 0.72, [x, 0.61, z], kit.rebar);
      addCylinder(group, 0.13, 0.07, [x, 0.72, z], kit.accent, 'y', 6);
    }
    for (const z of [-0.32, 0.32]) group.add(segmentMember([-0.38, 0.43, z], [0, 0.95, z], [0.09, 0.1], kit.steel, kit.edge));
  } else if (variant === 'splice') {
    group.add(segmentMember([-2.25, 1.08, 0], [-0.18, 1.08, 0], [0.4, 0.64], kit.steel, kit.edge));
    group.add(segmentMember([0.18, 1.08, 0], [2.25, 1.08, 0], [0.4, 0.64], kit.steel, kit.edge));
    for (const z of [-0.39, 0.39]) group.add(roundedMember([1.35, 0.84, 0.1], [0, 1.08, z], kit.accent, kit.edge, 0.025));
    for (const x of [-0.43, 0.43]) for (const y of [0.82, 1.34]) addBolt(group, kit, x, y, 0.39);
    group.add(roundedMember([0.24, 0.96, 0.86], [0, 1.08, 0], kit.base, kit.edge, 0.02));
  } else {
    addConnectionColumn(group, kit);
    group.add(segmentMember([-0.86, 1.48, 0], [2.15, 1.48, 0], [0.38, 0.58], kit.steel, kit.edge));
    if (variant === 'rigid') {
      group.add(roundedMember([0.18, 1.08, 0.92], [-0.72, 1.48, 0], kit.accent, kit.edge, 0.025));
      group.add(segmentMember([-0.7, 1.12, 0], [0.12, 1.43, 0], [0.18, 0.48], kit.steel, kit.edge));
      for (const y of [1.18, 1.48, 1.78]) for (const z of [-0.35, 0.35]) addBolt(group, kit, -0.68, y, z);
    } else {
      group.add(roundedMember([0.82, 0.9, 0.12], [-0.58, 1.48, 0], kit.accent, kit.edge, 0.025));
      addCylinder(group, 0.2, 1.1, [-0.58, 1.48, 0], kit.accent, 'z', 24);
      for (const y of [1.18, 1.78]) addBolt(group, kit, -0.58, y, 0.16);
      addSphere(group, 0.13, [-0.58, 1.48, 0.62], kit.rebar);
    }
  }
  return group;
};

export const buildThreeTechnicalGroup = (assetId: ThreeTechnicalAssetId, theme: StructuralRenderTheme) => {
  const [family, variant] = assetId.split(':');
  const kit = createMaterialKit(theme);
  const group = family === 'space-frame' ? buildSpaceFrame(variant, kit)
    : family === 'support' ? buildSupport(variant, kit)
      : family === 'load' ? buildLoad(variant, kit)
        : family === 'section' ? buildSection(variant, kit)
          : buildConnection(variant, kit);
  group.name = assetId;
  group.userData.assetId = assetId;
  group.userData.theme = theme;
  return group;
};

export const THREE_TECHNICAL_LOAD_COLORS = Object.freeze({
  point: '#2f73c8',
  distributed: '#65a323',
  varying: '#65a323',
  appliedMoment: '#c65f86',
});
