import * as THREE from 'three';
import {
  createMaterialKit,
  roundedMember,
  segmentMember,
  type MaterialKit,
  type StructuralRenderTheme,
} from './threePortalAssets';

export const THREE_FAMILY_ASSET_IDS = [
  'beam:simply-supported', 'beam:two-span', 'beam:three-span', 'beam:overhang',
  'cantilever:wall', 'cantilever:double', 'cantilever:stepped', 'cantilever:balcony',
  'truss:pratt', 'truss:howe', 'truss:warren', 'truss:king-post',
  'slab:one-way', 'slab:two-way', 'slab:waffle', 'slab:flat-slab',
] as const;

export type ThreeFamilyAssetId = typeof THREE_FAMILY_ASSET_IDS[number];

const addFooting = (group: THREE.Group, kit: MaterialKit, x: number, z = 0) => {
  group.add(roundedMember([0.76, 0.12, 0.68], [x, -0.04, z], kit.base, kit.edge, 0.045));
};

const addSupport = (group: THREE.Group, kit: MaterialKit, kind: 'pin' | 'roller', x: number, y = 0.34, z = 0) => {
  addFooting(group, kit, x, z);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.42, 4), kit.steel);
  cone.position.set(x, y, z);
  cone.rotation.y = Math.PI * 0.25;
  cone.castShadow = true;
  cone.add(new THREE.LineSegments(new THREE.EdgesGeometry(cone.geometry), kit.edge));
  group.add(cone);
  if (kind === 'roller') {
    for (const dx of [-0.14, 0.14]) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.34, 16), kit.steel);
      roller.rotation.z = Math.PI * 0.5;
      roller.position.set(x + dx, 0.08, z);
      roller.castShadow = true;
      group.add(roller);
    }
  }
  group.add(roundedMember([0.52, 0.07, 0.46], [x, y + 0.25, z], kit.accent, kit.edge, 0.018));
};

const addBeam = (group: THREE.Group, kit: MaterialKit, fromX: number, toX: number, y = 0.88, material: 'concrete' | 'steel' = 'concrete') => {
  group.add(segmentMember([fromX, y, 0], [toX, y, 0], [0.3, 0.38], kit[material], kit.edge));
};

const buildBeam = (variant: string, kit: MaterialKit) => {
  const group = new THREE.Group();
  const supports = variant === 'simply-supported' ? [{ x: -1.8, kind: 'pin' as const }, { x: 1.8, kind: 'roller' as const }]
    : variant === 'two-span' ? [{ x: -2, kind: 'pin' as const }, { x: 0, kind: 'roller' as const }, { x: 2, kind: 'roller' as const }]
      : variant === 'three-span' ? [{ x: -2.4, kind: 'pin' as const }, { x: -0.8, kind: 'roller' as const }, { x: 0.8, kind: 'roller' as const }, { x: 2.4, kind: 'roller' as const }]
        : [{ x: -1.35, kind: 'pin' as const }, { x: 1.25, kind: 'roller' as const }];
  const extents = variant === 'three-span' ? [-2.65, 2.65] : variant === 'overhang' ? [-2.45, 2.45] : [-2.2, 2.2];
  addBeam(group, kit, extents[0], extents[1], 0.88, variant === 'three-span' || variant === 'overhang' ? 'steel' : 'concrete');
  supports.forEach(({ x, kind }) => addSupport(group, kit, kind, x));
  return group;
};

const addWall = (group: THREE.Group, kit: MaterialKit, height = 2.4, width = 0.38, depth = 1.6) => {
  group.add(roundedMember([width, height, depth], [-1.75, height * 0.5 - 0.05, 0], kit.concrete, kit.edge, 0.045));
  group.add(roundedMember([0.62, 0.12, depth + 0.28], [-1.75, -0.06, 0], kit.base, kit.edge, 0.04));
};

const buildCantilever = (variant: string, kit: MaterialKit) => {
  const group = new THREE.Group();
  if (variant === 'wall') {
    addWall(group, kit);
    group.add(segmentMember([-1.58, 1.45, 0], [2.25, 1.45, 0], [0.32, 0.45], kit.concrete, kit.edge));
    group.add(roundedMember([0.12, 0.64, 0.62], [-1.48, 1.45, 0], kit.accent, kit.edge, 0.02));
  } else if (variant === 'double') {
    addFooting(group, kit, 0);
    group.add(roundedMember([0.38, 1.55, 0.5], [0, 0.71, 0], kit.steel, kit.edge, 0.035));
    group.add(segmentMember([-2.3, 1.45, 0], [2.3, 1.45, 0], [0.26, 0.4], kit.steel, kit.edge));
    group.add(roundedMember([0.68, 0.1, 0.64], [0, 1.45, 0], kit.accent, kit.edge, 0.02));
  } else if (variant === 'stepped') {
    addWall(group, kit, 2.75);
    group.add(segmentMember([-1.58, 1.1, 0], [-0.4, 1.1, 0], [0.3, 0.42], kit.concrete, kit.edge));
    group.add(segmentMember([-0.4, 1.1, 0], [-0.4, 1.55, 0], [0.3, 0.42], kit.concrete, kit.edge));
    group.add(segmentMember([-0.4, 1.55, 0], [0.85, 1.55, 0], [0.3, 0.42], kit.concrete, kit.edge));
    group.add(segmentMember([0.85, 1.55, 0], [0.85, 2, 0], [0.3, 0.42], kit.concrete, kit.edge));
    group.add(segmentMember([0.85, 2, 0], [2.2, 2, 0], [0.3, 0.42], kit.concrete, kit.edge));
    for (const [x, y] of [[-0.4, 1.1], [0.85, 1.55]]) group.add(roundedMember([0.48, 0.08, 0.54], [x, y, 0], kit.accent, kit.edge, 0.02));
  } else {
    addWall(group, kit, 2.7, 0.42, 2.8);
    group.add(roundedMember([3.7, 0.24, 2.45], [0.15, 1.35, 0], kit.concrete, kit.edge, 0.055));
    group.add(roundedMember([0.1, 0.62, 2.2], [-1.42, 1.35, 0], kit.accent, kit.edge, 0.02));
    for (const z of [-0.95, 0.95]) group.add(segmentMember([-1.25, 1.18, z], [1.9, 1.18, z], [0.13, 0.18], kit.steel, kit.edge));
  }
  return group;
};

type TrussNode = readonly [number, number];

const addTrussFrame = (group: THREE.Group, kit: MaterialKit, nodes: readonly TrussNode[], members: readonly (readonly [number, number])[], z: number, material: THREE.Material) => {
  for (const [startIndex, endIndex] of members) {
    const [x1, y1] = nodes[startIndex];
    const [x2, y2] = nodes[endIndex];
    group.add(segmentMember([x1, y1, z], [x2, y2, z], [0.11, 0.12], material, kit.edge));
  }
  for (const [x, y] of nodes) {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), kit.accent);
    joint.position.set(x, y, z);
    joint.castShadow = true;
    group.add(joint);
  }
};

const buildTruss = (variant: string, kit: MaterialKit) => {
  const group = new THREE.Group();
  const nodes: TrussNode[] = variant === 'king-post'
    ? [[-2.4, 0.45], [-1.2, 1.35], [0, 2.2], [1.2, 1.35], [2.4, 0.45], [0, 0.45]]
    : [[-2.4, 0.45], [-1.6, 1.55], [-0.8, 1.55], [0, 1.55], [0.8, 1.55], [1.6, 1.55], [2.4, 0.45], [-1.6, 0.45], [-0.8, 0.45], [0, 0.45], [0.8, 0.45], [1.6, 0.45]];
  let members: Array<readonly [number, number]>;
  if (variant === 'king-post') members = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 4], [2, 5], [1, 5], [3, 5]];
  else {
    const chord: Array<readonly [number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [0, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
    const diagonals = variant === 'pratt' ? [[1, 8], [2, 9], [5, 10], [4, 9]]
      : variant === 'howe' ? [[7, 2], [8, 3], [11, 4], [10, 3]]
        : [[0, 1], [1, 8], [8, 3], [3, 10], [10, 5], [5, 6]];
    members = [...chord, ...diagonals] as Array<readonly [number, number]>;
  }
  for (const z of [-0.32, 0.32]) addTrussFrame(group, kit, nodes, members, z, variant === 'howe' || variant === 'king-post' ? kit.concrete : kit.steel);
  for (const [x, y] of nodes) group.add(segmentMember([x, y, -0.32], [x, y, 0.32], [0.08, 0.09], kit.steel, kit.edge));
  addSupport(group, kit, 'pin', -2.35, 0.02, 0);
  addSupport(group, kit, 'roller', 2.35, 0.02, 0);
  return group;
};

const addColumnWithCapital = (group: THREE.Group, kit: MaterialKit, x: number, z: number, capital: boolean) => {
  group.add(roundedMember([0.3, 1.25, 0.3], [x, 0.52, z], kit.concrete, kit.edge, 0.04));
  addFooting(group, kit, x, z);
  if (capital) group.add(roundedMember([0.82, 0.16, 0.82], [x, 1.12, z], kit.accent, kit.edge, 0.035));
};

const buildSlab = (variant: string, kit: MaterialKit) => {
  const group = new THREE.Group();
  const slabY = 1.35;
  for (const x of [-1.45, 1.45]) for (const z of [-0.86, 0.86]) addColumnWithCapital(group, kit, x, z, variant === 'flat-slab');
  group.add(roundedMember([4.2, 0.22, 2.75], [0, slabY, 0], kit.concrete, kit.edge, 0.065));
  if (variant === 'one-way' || variant === 'waffle') {
    for (const z of [-1, -0.5, 0, 0.5, 1]) group.add(segmentMember([-1.95, 1.08, z], [1.95, 1.08, z], [0.15, 0.22], kit.steel, kit.edge));
  }
  if (variant === 'two-way' || variant === 'waffle') {
    for (const x of [-1.5, -0.75, 0, 0.75, 1.5]) group.add(segmentMember([x, 1.06, -1.25], [x, 1.06, 1.25], [0.14, 0.2], kit.steel, kit.edge));
  }
  if (variant !== 'flat-slab') {
    for (const x of [-1.45, 1.45]) group.add(roundedMember([0.72, 0.1, 0.72], [x, 1.28, -0.86], kit.accent, kit.edge, 0.025));
  }
  return group;
};

export const buildThreeFamilyGroup = (assetId: ThreeFamilyAssetId, theme: StructuralRenderTheme) => {
  const [family, variant] = assetId.split(':');
  const kit = createMaterialKit(theme);
  const group = family === 'beam' ? buildBeam(variant, kit)
    : family === 'cantilever' ? buildCantilever(variant, kit)
      : family === 'truss' ? buildTruss(variant, kit)
        : buildSlab(variant, kit);
  group.name = assetId;
  group.userData.assetId = assetId;
  group.userData.theme = theme;
  return group;
};
