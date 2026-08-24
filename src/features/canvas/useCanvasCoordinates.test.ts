// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NodeModel } from '../../types';
import { useCanvasCoordinates } from './useCanvasCoordinates';

afterEach(cleanup);

const camera = { scale: 85, x: 260, y: 500 };
const nodes: NodeModel[] = [
  { id: 'N1', x: 0, y: 0, support: { type: 'pin' } } as NodeModel,
  { id: 'N2', x: 4, y: 3, support: { type: 'none' } } as NodeModel,
];

const renderCoordinates = (updateCamera = vi.fn()) => renderHook(() => {
  const cameraRef = useRef(camera);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const coordinateReadoutRef = useRef<HTMLOutputElement | null>(null);
  return useCanvasCoordinates({
    camera,
    cameraRef,
    svgRef,
    coordinateReadoutRef,
    size: { width: 1000, height: 640 },
    nodes,
    units: 'kN-m',
    lengthLabel: 'm',
    updateCamera,
  });
});

describe('useCanvasCoordinates', () => {
  it('toScreen y toModel son inversas entre sí', () => {
    const { result } = renderCoordinates();
    const screen = result.current.toScreen(4, 3);
    const model = result.current.toModel(screen.x, screen.y);
    expect(model.x).toBeCloseTo(4);
    expect(model.y).toBeCloseTo(3);
  });

  it('fitModel no llama a updateCamera cuando el modelo no tiene nodos', () => {
    const updateCamera = vi.fn();
    const { result } = renderHook(() => {
      const cameraRef = useRef(camera);
      const svgRef = useRef<SVGSVGElement | null>(null);
      const coordinateReadoutRef = useRef<HTMLOutputElement | null>(null);
      return useCanvasCoordinates({
        camera,
        cameraRef,
        svgRef,
        coordinateReadoutRef,
        size: { width: 1000, height: 640 },
        nodes: [],
        units: 'kN-m',
        lengthLabel: 'm',
        updateCamera,
      });
    });
    result.current.fitModel();
    expect(updateCamera).not.toHaveBeenCalled();
  });

  it('fitModel encuadra el modelo cuando hay nodos y tamaño', () => {
    const updateCamera = vi.fn();
    const { result } = renderCoordinates(updateCamera);
    result.current.fitModel();
    expect(updateCamera).toHaveBeenCalledTimes(1);
  });

  it('navigateMinimapTo centra la cámara sobre el punto dado', () => {
    const updateCamera = vi.fn();
    const { result } = renderCoordinates(updateCamera);
    result.current.navigateMinimapTo({ x: 1, y: 2 });
    expect(updateCamera).toHaveBeenCalledTimes(1);
    const updater = updateCamera.mock.calls[0][0] as (current: typeof camera) => typeof camera;
    const next = updater(camera);
    expect(next.x).toBeCloseTo(1000 / 2 - 1 * camera.scale);
    expect(next.y).toBeCloseTo(640 / 2 + 2 * camera.scale);
  });
});
