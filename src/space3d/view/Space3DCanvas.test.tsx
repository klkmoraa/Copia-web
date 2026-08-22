// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Space3DCanvas } from './Space3DCanvas';
import { SPACE3D_DEFAULT_LAYERS, type Space3DViewport } from './threeViewport';
import { buildSpace3DSceneModel } from './sceneModel';
import { createBlankSpace3DProject, createSpace3DPortalExample } from '../model/defaultProject';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

beforeAll(() => vi.stubGlobal('ResizeObserver', ResizeObserverMock));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const model = buildSpace3DSceneModel({
  project: createSpace3DPortalExample(), analysis: null, analysisState: 'idle', selection: null, targetId: 'LC1',
});

const copy = {
  label: 'Vista tridimensional del marco espacial',
  fallbackTitle: 'El visor 3D no está disponible',
  fallbackBody: 'El navegador no pudo iniciar WebGL. El modelo permanece intacto.',
  retry: 'Reintentar visor',
  summaryTitle: 'Modelo visible',
  nodes: 'Nudos',
  members: 'Barras',
  supports: 'Apoyos',
  loads: 'Cargas',
};

const stubViewport = (): Space3DViewport & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    scene: {} as Space3DViewport['scene'],
    camera: {} as Space3DViewport['camera'],
    controlsTarget: {} as Space3DViewport['controlsTarget'],
    setModel: () => calls.push('setModel'),
    setLayers: () => calls.push('setLayers'),
    setView: (preset) => calls.push(`setView:${preset}`),
    zoomBy: (factor) => calls.push(`zoomBy:${factor}`),
    resize: () => calls.push('resize'),
    render: () => calls.push('render'),
    requestRender: () => calls.push('requestRender'),
    pickAt: () => null,
    dispose: () => calls.push('dispose'),
  };
};

describe('Space3DCanvas', () => {
  it('crea el viewport una vez y le entrega el modelo al cambiar', () => {
    const viewport = stubViewport();
    const create = vi.fn(() => viewport);
    const view = render(<Space3DCanvas model={model} layers={SPACE3D_DEFAULT_LAYERS} copy={copy} createViewport={create} />);
    expect(create).toHaveBeenCalledTimes(1);

    const other = buildSpace3DSceneModel({
      project: createBlankSpace3DProject(), analysis: null, analysisState: 'idle', selection: null, targetId: 'LC1',
    });
    view.rerender(<Space3DCanvas model={other} layers={SPACE3D_DEFAULT_LAYERS} copy={copy} createViewport={create} />);
    expect(create).toHaveBeenCalledTimes(1);
    expect(viewport.calls).toContain('setModel');
  });

  it('expone el lienzo con nombre accesible y controles de cámara operables por teclado', async () => {
    const user = userEvent.setup();
    const viewport = stubViewport();
    let activeView: 'front' | 'top' | 'side' | 'isometric' = 'isometric';
    const view = render(<Space3DCanvas
      model={model}
      layers={SPACE3D_DEFAULT_LAYERS}
      copy={copy}
      createViewport={() => viewport}
      activeView={activeView}
      onViewChange={(preset) => { activeView = preset; }}
    />);

    expect(screen.getByRole('img', { name: copy.label })).toBeDefined();
    const viewSelect = screen.getByRole('combobox');
    viewSelect.focus();
    expect(document.activeElement).toBe(viewSelect);
    await user.selectOptions(viewSelect, 'front');
    view.rerender(<Space3DCanvas
      model={model}
      layers={SPACE3D_DEFAULT_LAYERS}
      copy={copy}
      createViewport={() => viewport}
      activeView={activeView}
      onViewChange={(preset) => { activeView = preset; }}
    />);
    expect(viewport.calls).toContain('setView:front');

    await user.click(screen.getByRole('button', { name: /acercar/i }));
    expect(viewport.calls.some((call) => call.startsWith('zoomBy:'))).toBe(true);
  });

  it('conserva un resumen semántico del modelo junto al lienzo', () => {
    const viewport = stubViewport();
    render(<Space3DCanvas model={model} layers={SPACE3D_DEFAULT_LAYERS} copy={copy} createViewport={() => viewport} />);
    const summary = screen.getByRole('group', { name: copy.summaryTitle });
    expect(summary.textContent).toContain('4');
    expect(summary.textContent).toContain('3');
  });

  it('muestra el fallback cuando el viewport no arranca y permite reintentar', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const create = vi.fn(() => {
      attempts += 1;
      if (attempts === 1) throw new Error('WebGL no disponible');
      return stubViewport();
    });
    render(<Space3DCanvas model={model} layers={SPACE3D_DEFAULT_LAYERS} copy={copy} createViewport={create} />);

    expect(screen.getByRole('alert').textContent).toContain(copy.fallbackTitle);
    // El árbol semántico sobrevive a la caída del visor.
    expect(screen.getByRole('group', { name: copy.summaryTitle })).toBeDefined();

    await user.click(screen.getByRole('button', { name: copy.retry }));
    expect(create).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('img', { name: copy.label })).toBeDefined();
  });

  it('cae al fallback si el contexto WebGL se pierde en caliente', () => {
    const viewport = stubViewport();
    render(<Space3DCanvas model={model} layers={SPACE3D_DEFAULT_LAYERS} copy={copy} createViewport={() => viewport} />);
    fireEvent(screen.getByRole('img', { name: copy.label }), new Event('webglcontextlost', { cancelable: true }));
    expect(screen.getByRole('alert').textContent).toContain(copy.fallbackTitle);
    expect(viewport.calls).toContain('dispose');
  });

  it('libera el viewport al desmontar', () => {
    const viewport = stubViewport();
    const view = render(<Space3DCanvas model={model} layers={SPACE3D_DEFAULT_LAYERS} copy={copy} createViewport={() => viewport} />);
    view.unmount();
    expect(viewport.calls).toContain('dispose');
  });

  it('propaga la selección obtenida por picking', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const viewport = { ...stubViewport(), pickAt: () => ({ kind: 'node' as const, id: 'N2' }) };
    render(<Space3DCanvas
      model={model}
      layers={SPACE3D_DEFAULT_LAYERS}
      copy={copy}
      createViewport={() => viewport}
      onSelect={onSelect}
    />);
    await user.click(screen.getByRole('img', { name: copy.label }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'node', id: 'N2' });
  });
});
