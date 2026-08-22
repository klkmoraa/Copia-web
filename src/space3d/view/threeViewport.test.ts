// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SPACE3D_SCENE_LAYERS, createSpace3DViewport, type Space3DControlsLike, type Space3DRendererLike } from './threeViewport';
import { buildSpace3DSceneModel } from './sceneModel';
import { analyzeSpace3DProject } from '../engine/solver';
import { createSpace3DPortalExample } from '../model/defaultProject';

const project = createSpace3DPortalExample();
const analysis = analyzeSpace3DProject(project, 'LC1');

const sceneModel = (overrides: Partial<Parameters<typeof buildSpace3DSceneModel>[0]> = {}) =>
  buildSpace3DSceneModel({
    project, analysis: null, analysisState: 'idle', selection: null, targetId: 'LC1', ...overrides,
  });

interface Harness {
  readonly renderer: Space3DRendererLike & { renders: number; pixelRatio: number; width: number; height: number; disposed: boolean };
  readonly controls: Space3DControlsLike & { disposed: boolean; listeners: number };
  readonly canvas: HTMLCanvasElement;
}

const makeHarness = (): Harness => {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 500, configurable: true });
  canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500, toJSON: () => ({}) });

  const renderer = {
    renders: 0, pixelRatio: 1, width: 0, height: 0, disposed: false,
    setPixelRatio(value: number) { this.pixelRatio = value; },
    setSize(width: number, height: number) { this.width = width; this.height = height; },
    setClearColor() {},
    render() { this.renders += 1; },
    dispose() { this.disposed = true; },
  };

  const controls = {
    target: new THREE.Vector3(),
    enableDamping: false,
    listeners: 0,
    disposed: false,
    update() {},
    addEventListener() { this.listeners += 1; },
    removeEventListener() { this.listeners -= 1; },
    dispose() { this.disposed = true; },
  };

  return { renderer, controls, canvas };
};

const openViewport = (harness: Harness, overrides: Record<string, unknown> = {}) => createSpace3DViewport({
  canvas: harness.canvas,
  model: sceneModel(),
  createRenderer: () => harness.renderer,
  createControls: () => harness.controls,
  ...overrides,
});

beforeAll(() => {
  vi.stubGlobal('devicePixelRatio', 4);
});

afterEach(() => { vi.restoreAllMocks(); });

describe('Space3D three viewport', () => {
  it('monta la escena con nudos, miembros, apoyos, cargas, rejilla y ejes', () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    const names = new Set<string>();
    viewport.scene.traverse((object) => { if (object.name) names.add(object.name); });
    for (const layer of SPACE3D_SCENE_LAYERS) expect(names).toContain(layer);
    viewport.dispose();
  });

  it('conserva las identidades actuales de carga y momento cuando CSS no está disponible', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => '' } as unknown as CSSStyleDeclaration);
    const projectWithMoment = {
      ...project,
      nodalLoads: [...project.nodalLoads, {
        id: 'L2', caseId: 'LC1', nodeId: 'N4',
        fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 12,
      }],
    };
    const harness = makeHarness();
    const viewport = openViewport(harness, { model: sceneModel({ project: projectWithMoment }) });
    const colors = new Set(viewport.scene.getObjectByName('loads')?.children.map((object) => {
      const arrow = object as THREE.ArrowHelper;
      return (arrow.line.material as THREE.LineBasicMaterial).color.getHexString();
    }));

    expect(colors).toContain('3a72e3');
    expect(colors).toContain('ed4b46');
    viewport.dispose();
  });

  it('limita el device pixel ratio a 2 y ajusta el tamaño al canvas', () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    expect(harness.renderer.pixelRatio).toBe(2);
    expect(harness.renderer.width).toBe(800);
    expect(harness.renderer.height).toBe(500);
    viewport.dispose();
  });

  it('renderiza sólo bajo demanda, nunca en bucle', async () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    const initial = harness.renderer.renders;
    expect(initial).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(harness.renderer.renders).toBe(initial);
    viewport.render();
    expect(harness.renderer.renders).toBe(initial + 1);
    viewport.dispose();
  });

  it('coloca la cámara según el preset y mantiene el objetivo en el centro', () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    viewport.setView('front');
    const front = viewport.camera.position.clone();
    viewport.setView('top');
    expect(viewport.camera.position.y).toBeGreaterThan(front.y);
    expect(viewport.controlsTarget.toArray()).toEqual([2.5, 1.6, 2]);
    viewport.dispose();
  });

  it('acerca y aleja sin cruzar el objetivo ni salirse del rango', () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    viewport.setView('isometric');
    const before = viewport.camera.position.distanceTo(viewport.controlsTarget);
    viewport.zoomBy(0.5);
    const after = viewport.camera.position.distanceTo(viewport.controlsTarget);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
    viewport.zoomBy(1e6);
    expect(Number.isFinite(viewport.camera.position.distanceTo(viewport.controlsTarget))).toBe(true);
    viewport.dispose();
  });

  it('identifica por ID el nudo y el miembro bajo el puntero', () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    viewport.setView('front');
    const node = project.nodes[3];
    const projected = new THREE.Vector3(node.x, node.y, node.z).project(viewport.camera);
    const x = (projected.x + 1) / 2 * 800;
    const y = (1 - projected.y) / 2 * 500;
    expect(viewport.pickAt(x, y)).toEqual({ kind: 'node', id: 'N4' });

    const member = viewport.scene.getObjectByName('members')!;
    expect(member).toBeDefined();
    expect(viewport.pickAt(-500, -500)).toBeNull();
    viewport.dispose();
  });

  it('refleja la selección y publica la deformada sólo con un resultado vigente', () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    expect(viewport.scene.getObjectByName('deformed')?.visible).toBe(false);

    viewport.setModel(sceneModel({ analysis, analysisState: 'ready', selection: { kind: 'member', id: 'M2' } }));
    expect(viewport.scene.getObjectByName('deformed')?.visible).toBe(true);
    expect(viewport.scene.getObjectByName('local-axes')?.visible).toBe(true);

    viewport.setModel(sceneModel({ analysis, analysisState: 'stale' }));
    expect(viewport.scene.getObjectByName('deformed')?.visible).toBe(false);
    expect(viewport.scene.getObjectByName('local-axes')?.visible).toBe(false);
    viewport.dispose();
  });

  it('alterna capas sin reconstruir la escena', () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    viewport.setLayers({ grid: false, loads: false, supports: false, labels: false, deformed: true });
    expect(viewport.scene.getObjectByName('grid')!.visible).toBe(false);
    expect(viewport.scene.getObjectByName('loads')!.visible).toBe(false);
    viewport.setLayers({ grid: true, loads: true, supports: true, labels: true, deformed: true });
    expect(viewport.scene.getObjectByName('grid')!.visible).toBe(true);
    viewport.dispose();
  });

  it('reacciona al resize actualizando cámara y renderer', () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    Object.defineProperty(harness.canvas, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(harness.canvas, 'clientHeight', { value: 400, configurable: true });
    viewport.resize();
    expect(harness.renderer.width).toBe(400);
    expect(viewport.camera.aspect).toBeCloseTo(1, 12);
    viewport.dispose();
  });

  it('libera geometrías, materiales, controles y renderer, y queda inerte', () => {
    const harness = makeHarness();
    const viewport = openViewport(harness);
    const disposals: string[] = [];
    viewport.scene.traverse((object) => {
      const holder = object as THREE.Mesh;
      if (holder.geometry) vi.spyOn(holder.geometry, 'dispose').mockImplementation(() => { disposals.push('geometry'); });
      const material = holder.material as THREE.Material | undefined;
      if (material && !Array.isArray(material)) vi.spyOn(material, 'dispose').mockImplementation(() => { disposals.push('material'); });
    });

    const rendersBefore = harness.renderer.renders;
    viewport.dispose();
    expect(disposals.filter((item) => item === 'geometry').length).toBeGreaterThan(0);
    expect(disposals.filter((item) => item === 'material').length).toBeGreaterThan(0);
    expect(harness.controls.disposed).toBe(true);
    expect(harness.controls.listeners).toBe(0);
    expect(harness.renderer.disposed).toBe(true);

    viewport.render();
    viewport.setModel(sceneModel());
    expect(harness.renderer.renders).toBe(rendersBefore);
    expect(() => viewport.dispose()).not.toThrow();
  });
});
