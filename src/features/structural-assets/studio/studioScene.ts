import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { buildThreeStructuralGroup, calculateOrthographicFrame } from '../threeStructuralRender';
import { disposeThreeObject } from '../threePortalAssets';
import type { StudioParameters } from './presetRepository';
import { normalizeStudioParameters } from './presetRepository';

export type StudioExportScale = 1 | 2 | 4;
export const STUDIO_PROJECTION_ASPECT = 1.5;

const cameraDirections = {
  isometric: new THREE.Vector3(5.4, 4.1, 6.2),
  front: new THREE.Vector3(0, .18, 8),
  side: new THREE.Vector3(8, .18, 0),
  top: new THREE.Vector3(0, 8, .001),
} as const;

const materialPalettes = {
  concrete: { light: 0xbab3a9, dark: 0xb9bdb8, metalness: 0 },
  steel: { light: 0x667173, dark: 0x9ba3a2, metalness: .16 },
  timber: { light: 0x9a6d43, dark: 0xb68b62, metalness: 0 },
  technical: { light: 0x007d61, dark: 0x007d61, metalness: .02 },
} as const;

const persistentTechnicalColors = new Set([0x007d61, 0x168a6c, 0x2f73c8, 0x65a323, 0xc65f86]);

const applyMaterialPresentation = (group: THREE.Group, parameters: StudioParameters) => {
  if (parameters.material === 'factory') return;
  const palette = materialPalettes[parameters.material];
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const originals = Array.isArray(object.material) ? object.material : [object.material];
    const replacements = originals.map((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      if (persistentTechnicalColors.has(material.color.getHex())) return material;
      const replacement = material.clone();
      replacement.color.setHex(palette[parameters.previewTheme]);
      replacement.metalness = palette.metalness;
      replacement.roughness = Math.max(.82, replacement.roughness);
      return replacement;
    });
    object.material = Array.isArray(object.material) ? replacements : replacements[0];
  });
};

export interface StudioSceneBundle {
  parameters: StudioParameters;
  scene: THREE.Scene;
  group: THREE.Group;
  camera: THREE.OrthographicCamera;
}

export const buildStudioScene = (input: StudioParameters): StudioSceneBundle => {
  const parameters = normalizeStudioParameters(input);
  const theme = parameters.previewTheme === 'dark' ? 'night' : 'day';
  const scene = new THREE.Scene();
  const group = buildThreeStructuralGroup(parameters.assetId, theme);
  group.scale.set(parameters.widthScale, parameters.heightScale, parameters.depthScale);
  group.updateMatrixWorld(true);
  applyMaterialPresentation(group, parameters);
  group.userData.studioParameters = { ...parameters };
  scene.add(group);

  scene.add(new THREE.HemisphereLight(theme === 'day' ? 0xfffbef : 0xe9f5f3, theme === 'day' ? 0x687577 : 0x061216, theme === 'day' ? 2.6 : 2.25));
  const key = new THREE.DirectionalLight(theme === 'day' ? 0xfff4dc : 0xdcefee, theme === 'day' ? 4.2 : 3.5);
  key.position.set(-4.5, 7, 5.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(theme === 'day' ? 0xb8d9d1 : 0x78b8aa, 1.55);
  rim.position.set(5, 3, -5);
  scene.add(rim);

  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  const direction = cameraDirections[parameters.camera].clone();
  const padding = parameters.detail === 'hero' ? 1.08 : parameters.detail === 'card' ? 1.16 : 1.28;
  const frame = calculateOrthographicFrame(bounds, STUDIO_PROJECTION_ASPECT, direction, padding);
  const camera = new THREE.OrthographicCamera(frame.left, frame.right, frame.top, frame.bottom, .1, 100);
  if (parameters.camera === 'top') camera.up.set(0, 0, -1);
  camera.position.copy(center).add(direction.normalize().multiplyScalar(10));
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  scene.userData.studioParameters = { ...parameters };
  return { parameters, scene, group, camera };
};

export const disposeStudioScene = (bundle: StudioSceneBundle) => disposeThreeObject(bundle.scene);

export const withStudioScene = <T>(parameters: StudioParameters, operation: (bundle: StudioSceneBundle) => T): T => {
  const bundle = buildStudioScene(parameters);
  try {
    return operation(bundle);
  } finally {
    disposeStudioScene(bundle);
  }
};

export const getStudioExportDimensions = (scale: StudioExportScale) => ({ width: 900 * scale, height: 600 * scale, alpha: true as const });

export const serializeStudioSvg = (parameters: StudioParameters) => {
  const renderer = new SVGRenderer();
  return withStudioScene(parameters, (bundle) => {
    renderer.autoClear = false;
    renderer.setQuality('high');
    renderer.setSize(900, 600);
    renderer.render(bundle.scene, bundle.camera);
    const svg = renderer.domElement;
    svg.removeAttribute('style');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('data-structural-asset-id', bundle.parameters.assetId);
    svg.setAttribute('data-studio-composition', '3:2');
    svg.setAttribute('data-studio-camera', bundle.parameters.camera);
    svg.setAttribute('data-studio-scales', `${bundle.parameters.widthScale},${bundle.parameters.heightScale},${bundle.parameters.depthScale}`);
    return new XMLSerializer().serializeToString(svg);
  });
};

export const renderStudioPng = async (parameters: StudioParameters, scale: StudioExportScale) => {
  const dimensions = getStudioExportDimensions(scale);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  let renderer: THREE.WebGLRenderer | undefined;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(dimensions.width, dimensions.height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    return withStudioScene(parameters, (bundle) => {
      renderer!.render(bundle.scene, bundle.camera);
      return canvas.toDataURL('image/png');
    });
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
};
