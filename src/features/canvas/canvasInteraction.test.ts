import { describe, expect, it } from 'vitest';
import {
  cameraForPinch,
  cameraForViewportResize,
  cameraFromAnchor,
  canvasPointerProfile,
  dragThreshold,
  midpoint,
  movedPastThreshold,
  panCameraFrom,
  pendingDragIntent,
  pointDistance,
  screenToModelPoint,
  shouldArmLongPress,
  shouldTriggerLongPress,
  zoomCameraAt,
} from './canvasInteraction';

describe('canvas interaction geometry', () => {
  it('keeps the cursor model coordinate fixed while zooming', () => {
    const camera = { scale: 80, x: 240, y: 500 };
    const cursor = { x: 610, y: 220 };
    const before = screenToModelPoint(cursor, camera);
    const afterCamera = zoomCameraAt(camera, cursor, 1.7);
    const after = screenToModelPoint(cursor, afterCamera);

    expect(after.x).toBeCloseTo(before.x, 12);
    expect(after.y).toBeCloseTo(before.y, 12);
  });

  it('pans by the exact screen-space pointer delta', () => {
    expect(panCameraFrom(
      { scale: 90, x: 200, y: 400 },
      { x: 100, y: 120 },
      { x: 148, y: 93 },
    )).toEqual({ scale: 90, x: 248, y: 373 });
  });

  it('supports simultaneous pan and zoom during a pinch', () => {
    const startCamera = { scale: 100, x: 300, y: 450 };
    const startMidpoint = midpoint({ x: 300, y: 300 }, { x: 500, y: 300 });
    const modelAnchor = screenToModelPoint(startMidpoint, startCamera);
    const currentMidpoint = midpoint({ x: 330, y: 260 }, { x: 630, y: 260 });
    const next = cameraForPinch(startCamera, modelAnchor, 200, 300, currentMidpoint);

    expect(next.scale).toBe(150);
    expect(screenToModelPoint(currentMidpoint, next).x).toBeCloseTo(modelAnchor.x, 12);
    expect(screenToModelPoint(currentMidpoint, next).y).toBeCloseTo(modelAnchor.y, 12);
  });

  it('clamps extreme zoom while preserving the requested anchor', () => {
    const camera = cameraFromAnchor({ x: 2, y: -3 }, { x: 120, y: 80 }, 50_000);
    expect(camera.scale).toBe(260);
    expect(screenToModelPoint({ x: 120, y: 80 }, camera)).toEqual({ x: 2, y: -3 });
  });

  it('keeps the same model point centered when the viewport resizes', () => {
    const camera = { scale: 80, x: 210, y: 460 };
    const previous = { width: 800, height: 600 };
    const current = { width: 1_040, height: 480 };
    const previousCenter = { x: previous.width / 2, y: previous.height / 2 };
    const currentCenter = { x: current.width / 2, y: current.height / 2 };

    const resized = cameraForViewportResize(camera, previous, current);

    expect(resized).toEqual({ scale: 80, x: 330, y: 400 });
    expect(screenToModelPoint(currentCenter, resized)).toEqual(
      screenToModelPoint(previousCenter, camera),
    );
  });

  it('reserves touch drags for panning and only drags nodes with a desktop selection pointer', () => {
    expect(pendingDragIntent('touch', 'select', 'node')).toBe('pan');
    expect(pendingDragIntent('mouse', 'select', 'node')).toBe('node-drag');
    expect(pendingDragIntent('pen', 'select', 'node')).toBe('node-drag');
    expect(pendingDragIntent('mouse', 'select', 'member')).toBe('pan');
    expect(pendingDragIntent('mouse', 'node', 'node')).toBe('pan');
  });

  it('defines explicit mouse, touch, and stylus parity without claiming hardware validation', () => {
    expect(canvasPointerProfile('mouse')).toEqual({ kind: 'mouse', dragThreshold: 3, canDragNode: true, usesLongPress: false, showsCoordinates: true, minimumHitTarget: 24 });
    expect(canvasPointerProfile('touch')).toEqual({ kind: 'touch', dragThreshold: 9, canDragNode: false, usesLongPress: true, showsCoordinates: false, minimumHitTarget: 44 });
    expect(canvasPointerProfile('pen')).toEqual({ kind: 'pen', dragThreshold: 5, canDragNode: true, usesLongPress: false, showsCoordinates: true, minimumHitTarget: 32 });
    expect(canvasPointerProfile('')).toMatchObject({ kind: 'mouse', canDragNode: true });
  });

  it('reserves long-press for touch selection, including the background marquee, instead of intercepting creation tools', () => {
    expect(shouldArmLongPress('touch', 'select', 'node')).toBe(true);
    expect(shouldArmLongPress('touch', 'select', 'background')).toBe(true);
    expect(shouldArmLongPress('touch', 'pointLoad', 'node')).toBe(false);
    expect(shouldArmLongPress('touch', 'member', 'node')).toBe(false);
    expect(shouldArmLongPress('mouse', 'select', 'node')).toBe(false);
  });

  it('requires exactly 480 ms and a stationary touch so a slow pan cannot arm marquee or a picker', () => {
    expect(shouldTriggerLongPress('touch', 'select', 'node', 479, 0)).toBe(false);
    expect(shouldTriggerLongPress('touch', 'select', 'node', 480, 0)).toBe(true);
    expect(shouldTriggerLongPress('touch', 'select', 'background', 480, 0)).toBe(true);
    expect(shouldTriggerLongPress('touch', 'select', 'node', 480, 4)).toBe(false);
    expect(shouldTriggerLongPress('pen', 'select', 'node', 480, 0)).toBe(false);
  });

  it('uses input-specific movement thresholds', () => {
    expect(dragThreshold('touch')).toBeGreaterThan(dragThreshold('mouse'));
    expect(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(movedPastThreshold({ x: 0, y: 0 }, { x: 7, y: 0 }, 'touch')).toBe(false);
    expect(movedPastThreshold({ x: 0, y: 0 }, { x: 10, y: 0 }, 'touch')).toBe(true);
  });
});
