// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import type { Selection } from '../../types';
import { readCanvasViewSettings } from '../view/canvasViewSettings';
import { CANVAS_REFERENCE_SCALE } from './canvasChromeGeometry';
import { useCanvasDerivedGeometry } from './useCanvasDerivedGeometry';

afterEach(cleanup);

const t = (key: string) => key;
const selection: Selection = null;
const size = { width: 1000, height: 640 };
const camera = { scale: CANVAS_REFERENCE_SCALE, x: 260, y: 500 };

describe('useCanvasDerivedGeometry', () => {
  it('indexa nodos y barras por id', () => {
    const project = createDefaultProject();
    const view = readCanvasViewSettings(project);
    const { result } = renderHook(() => useCanvasDerivedGeometry({
      project,
      analysis: null,
      view,
      camera,
      canvasMeasured: true,
      size,
      selection,
      memberStart: null,
      activeTool: 'select',
      selectedCombinationId: project.combinations[0]?.id ?? '',
      loadsLayerFromEditor: false,
      heatmapLayerFromEditor: false,
      cut: null,
      t,
    }));
    for (const node of project.nodes) {
      expect(result.current.nodeMap.get(node.id)).toBe(node);
    }
    for (const member of project.members) {
      expect(result.current.memberMap.get(member.id)).toBe(member);
    }
  });

  it('no calcula el mapa de demanda cuando la capa de calor está apagada', () => {
    const project = createDefaultProject();
    const view = readCanvasViewSettings(project);
    const { result } = renderHook(() => useCanvasDerivedGeometry({
      project,
      analysis: null,
      view,
      camera,
      canvasMeasured: true,
      size,
      selection,
      memberStart: null,
      activeTool: 'select',
      selectedCombinationId: project.combinations[0]?.id ?? '',
      loadsLayerFromEditor: false,
      heatmapLayerFromEditor: false,
      cut: null,
      t,
    }));
    expect(result.current.demandMapActive).toBe(false);
    expect(result.current.demandView).toBeNull();
    expect(result.current.demandLegend).toBeNull();
  });

  it('deriva el rectángulo visible del minimapa a partir de la cámara y el tamaño', () => {
    const project = createDefaultProject();
    const view = readCanvasViewSettings(project);
    const { result } = renderHook(() => useCanvasDerivedGeometry({
      project,
      analysis: null,
      view,
      camera,
      canvasMeasured: true,
      size,
      selection,
      memberStart: null,
      activeTool: 'select',
      selectedCombinationId: project.combinations[0]?.id ?? '',
      loadsLayerFromEditor: false,
      heatmapLayerFromEditor: false,
      cut: null,
      t,
    }));
    expect(result.current.minimapViewport).not.toBeNull();
    expect(result.current.minimapViewport!.maxX).toBeGreaterThan(result.current.minimapViewport!.minX);
  });

  it('sin corte activo, cutDemand y cutEquilibrium son nulos', () => {
    const project = createDefaultProject();
    const view = readCanvasViewSettings(project);
    const { result } = renderHook(() => useCanvasDerivedGeometry({
      project,
      analysis: null,
      view,
      camera,
      canvasMeasured: true,
      size,
      selection,
      memberStart: null,
      activeTool: 'select',
      selectedCombinationId: project.combinations[0]?.id ?? '',
      loadsLayerFromEditor: false,
      heatmapLayerFromEditor: false,
      cut: null,
      t,
    }));
    expect(result.current.cutDemand).toBeNull();
    expect(result.current.cutEquilibrium).toBeNull();
  });
});
