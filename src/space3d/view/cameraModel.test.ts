import { describe, expect, it } from 'vitest';
import { SPACE3D_VIEW_PRESETS, computeSpace3DCameraPlacement } from './cameraModel';
import { buildSpace3DSceneModel } from './sceneModel';
import { createBlankSpace3DProject, createSpace3DPortalExample } from '../model/defaultProject';

const sceneOf = (project = createSpace3DPortalExample()) => buildSpace3DSceneModel({
  project, analysis: null, analysisState: 'idle', selection: null, targetId: 'LC1',
});

const bounds = sceneOf().bounds;

describe('Space3D camera model', () => {
  it('declara los cuatro presets', () => {
    expect([...SPACE3D_VIEW_PRESETS]).toEqual(['front', 'top', 'side', 'isometric']);
  });

  it.each([...SPACE3D_VIEW_PRESETS])('produce una colocación finita y válida en %s', (preset) => {
    const placement = computeSpace3DCameraPlacement(bounds, preset);
    expect(placement.position.every(Number.isFinite)).toBe(true);
    expect(placement.target).toEqual(bounds.center);
    expect(placement.near).toBeGreaterThan(0);
    expect(placement.far).toBeGreaterThan(placement.near);
    expect(placement.up.every(Number.isFinite)).toBe(true);
    const distance = Math.hypot(
      placement.position[0] - bounds.center[0],
      placement.position[1] - bounds.center[1],
      placement.position[2] - bounds.center[2],
    );
    expect(distance).toBeGreaterThan(bounds.span * 0.5);
    expect(distance).toBeLessThan(placement.far);
  });

  it('orienta cada preset por el eje que le corresponde', () => {
    const front = computeSpace3DCameraPlacement(bounds, 'front');
    expect(front.position[2]).toBeGreaterThan(bounds.center[2]);
    expect(front.position[0]).toBeCloseTo(bounds.center[0], 12);
    expect(front.position[1]).toBeCloseTo(bounds.center[1], 12);

    const top = computeSpace3DCameraPlacement(bounds, 'top');
    expect(top.position[1]).toBeGreaterThan(bounds.center[1]);
    // Mirando desde arriba, «arriba» en pantalla no puede seguir siendo +Y.
    expect(top.up[1]).toBeCloseTo(0, 12);
    expect(Math.abs(top.up[2])).toBeCloseTo(1, 12);

    const side = computeSpace3DCameraPlacement(bounds, 'side');
    expect(side.position[0]).toBeGreaterThan(bounds.center[0]);
    expect(side.position[2]).toBeCloseTo(bounds.center[2], 12);

    const iso = computeSpace3DCameraPlacement(bounds, 'isometric');
    expect(iso.position[0]).toBeGreaterThan(bounds.center[0]);
    expect(iso.position[1]).toBeGreaterThan(bounds.center[1]);
    expect(iso.position[2]).toBeGreaterThan(bounds.center[2]);
    expect(iso.up).toEqual([0, 1, 0]);
  });

  it('encuadra un proyecto vacío sin producir NaN ni distancia cero', () => {
    const empty = sceneOf(createBlankSpace3DProject()).bounds;
    const placement = computeSpace3DCameraPlacement(empty, 'isometric');
    expect(placement.position.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...placement.position)).toBeGreaterThan(0);
    expect(placement.near).toBeGreaterThan(0);
  });

  it('encuadra un modelo de un solo punto', () => {
    const single = sceneOf({
      ...createBlankSpace3DProject(),
      nodes: [{ id: 'N1', x: 12, y: -4, z: 7, restraints: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true } }],
    }).bounds;
    const placement = computeSpace3DCameraPlacement(single, 'front');
    expect(placement.target).toEqual([12, -4, 7]);
    expect(placement.position.every(Number.isFinite)).toBe(true);
    expect(placement.position[2]).toBeGreaterThan(7);
  });

  it('aleja la cámara cuando el modelo crece en Z', () => {
    const flat = sceneOf({
      ...createBlankSpace3DProject(),
      nodes: [
        { id: 'A', x: 0, y: 0, z: 0, restraints: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true } },
        { id: 'B', x: 4, y: 3, z: 0, restraints: { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false } },
      ],
    }).bounds;
    const deep = sceneOf({
      ...createBlankSpace3DProject(),
      nodes: [
        { id: 'A', x: 0, y: 0, z: 0, restraints: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true } },
        { id: 'B', x: 4, y: 3, z: 40, restraints: { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false } },
      ],
    }).bounds;
    const near = computeSpace3DCameraPlacement(flat, 'isometric');
    const far = computeSpace3DCameraPlacement(deep, 'isometric');
    const distanceOf = (placement: typeof near, box: typeof flat) => Math.hypot(
      placement.position[0] - box.center[0],
      placement.position[1] - box.center[1],
      placement.position[2] - box.center[2],
    );
    expect(distanceOf(far, deep)).toBeGreaterThan(distanceOf(near, flat));
  });
});
