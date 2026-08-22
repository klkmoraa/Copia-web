// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import type { Selection } from '../../types';
import { createEditorLayerState } from './editorLayers';
import { StructuralCanvas } from './StructuralCanvas';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  if (!document.elementsFromPoint) Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [] });
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const Harness = () => {
  const { project, selection, setSelection, canUndo, canRedo, undo, redo } = useProject();
  const select = (next: Selection) => setSelection(next);
  return <>
    <output aria-label="project-model">{JSON.stringify(project)}</output>
    <output aria-label="selection-model">{JSON.stringify(selection)}</output>
    <output aria-label="history-state">{String(canUndo)}:{String(canRedo)}</output>
    <button onClick={() => select({ kind: 'node', id: 'N1' })}>select-N1</button>
    <button onClick={() => select({ kind: 'node', id: 'N3' })}>select-N3</button>
    <button onClick={() => select({ kind: 'member', id: 'M1' })}>select-M1</button>
    <button onClick={() => select({ kind: 'multi', nodeIds: ['N1', 'N2', 'N3'], memberIds: [] })}>select-three-nodes</button>
    <button onClick={undo}>test-undo</button>
    <button onClick={redo}>test-redo</button>
    <StructuralCanvas layers={createEditorLayerState()} />
  </>;
};

const renderCanvas = () => render(<ProjectProvider><Harness /></ProjectProvider>);
const model = () => JSON.parse(screen.getByLabelText('project-model').textContent ?? '{}') as ReturnType<typeof createDefaultProject>;
const openStructuralEdit = async (user: ReturnType<typeof userEvent.setup>, selectionButton: string) => {
  await user.click(screen.getByText(selectionButton));
  await user.click(screen.getByRole('button', { name: /abrir editor estructural/i }));
  return screen.getByRole('region', { name: /edición estructural/i });
};
const chooseOperation = async (user: ReturnType<typeof userEvent.setup>, surface: HTMLElement, name: RegExp) => {
  await user.click(within(surface).getByRole('radio', { name }));
};

describe('StructuralCanvas advanced editing integration', () => {
  // The first Canvas mount loads the complete workspace provider graph. Keep
  // the behavioral assertion deterministic on shared/slow CI runners.
  it('previews and applies a numeric Move to ProjectModel with one exact undo/redo', async () => {
    const user = userEvent.setup();
    renderCanvas();
    const surface = await openStructuralEdit(user, 'select-N1');
    const dx = within(surface).getByLabelText('ΔX');
    const dy = within(surface).getByLabelText('ΔY');
    await user.clear(dx);
    await user.type(dx, '2');
    await user.clear(dy);
    await user.type(dy, '-1');

    expect(model().nodes.find((node) => node.id === 'N1')).toMatchObject({ x: 0, y: 0 });
    expect(document.querySelector('[data-structural-edit-preview="move"]')).toBeTruthy();
    await user.click(within(surface).getByRole('button', { name: /^aplicar$/i }));
    await waitFor(() => expect(model().nodes.find((node) => node.id === 'N1')).toMatchObject({ x: 2, y: -1 }));
    expect(screen.getByLabelText('history-state').textContent).toBe('true:false');

    await user.click(screen.getByText('test-undo'));
    expect(model().nodes.find((node) => node.id === 'N1')).toMatchObject({ x: 0, y: 0 });
    expect(screen.getByLabelText('history-state').textContent).toBe('false:true');
    await user.click(screen.getByText('test-redo'));
    expect(model().nodes.find((node) => node.id === 'N1')).toMatchObject({ x: 2, y: -1 });
  }, 20_000);

  it('focuses the first parameter after the structural edit surface mounts', async () => {
    const user = userEvent.setup();
    renderCanvas();
    const surface = await openStructuralEdit(user, 'select-N1');
    const deltaX = within(surface).getByLabelText(/\u0394X/u);
    await waitFor(() => expect(document.activeElement).toBe(deltaX));
  });

  it('uses pointer Move with grid snap while keeping ProjectModel unchanged until Apply', async () => {
    const user = userEvent.setup();
    renderCanvas();
    const surface = await openStructuralEdit(user, 'select-N1');
    await user.click(within(surface).getByRole('button', { name: /usar puntero/i }));
    const canvas = screen.getByRole('application', { name: /área de trabajo estructural/i });
    fireEvent.pointerDown(canvas, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 260, clientY: 500 });
    fireEvent.pointerMove(canvas, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 345, clientY: 415 });
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await waitFor(() => expect(document.querySelector('[data-structural-edit-preview-mode="gesture"]')).toBeTruthy());
    fireEvent.pointerUp(canvas, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 345, clientY: 415 });

    expect(model().nodes.find((node) => node.id === 'N1')).toMatchObject({ x: 0, y: 0 });
    expect((within(surface).getByLabelText('ΔX') as HTMLInputElement).value).toBe('1');
    expect((within(surface).getByLabelText('ΔY') as HTMLInputElement).value).toBe('1');
    expect(document.querySelector('[data-structural-edit-preview-mode="prepared"]')).toBeTruthy();
    await user.click(within(surface).getByRole('button', { name: /^aplicar$/i }));
    await waitFor(() => expect(model().nodes.find((node) => node.id === 'N1')).toMatchObject({ x: 1, y: 1 }));
  });

  it('keeps ordinary touch as pan and captures touch editing only after explicit Move activation', async () => {
    const user = userEvent.setup();
    renderCanvas();
    await openStructuralEdit(user, 'select-N1');
    const canvas = screen.getByRole('application', { name: /área de trabajo estructural/i });

    fireEvent.pointerDown(canvas, { pointerId: 71, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: 260, clientY: 500 });
    // SEL-02 reserves a stationary 480 ms press for marquee; a real pan moves
    // beyond the 3 px long-press jitter before that deadline.
    fireEvent.pointerMove(canvas, { pointerId: 71, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: 274, clientY: 500 });
    await waitFor(() => expect(canvas.getAttribute('data-interaction')).toBe('pan'));

    // A separate touch sequence starts with fresh browser pointer bookkeeping.
    // This mirrors the canvas contract and avoids relying on jsdom's incomplete
    // SVG pointer-capture implementation between unrelated gestures.
    cleanup();
    renderCanvas();
    const surface = await openStructuralEdit(user, 'select-N1');
    const editCanvas = screen.getByRole('application', { name: /área de trabajo estructural/i });

    await user.click(within(surface).getByRole('button', { name: /usar puntero/i }));
    fireEvent.pointerDown(editCanvas, { pointerId: 72, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: 260, clientY: 500 });
    await waitFor(() => expect(editCanvas.getAttribute('data-interaction')).toBe('structural-edit'));
    fireEvent.pointerMove(editCanvas, { pointerId: 72, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: 345, clientY: 415 });
    fireEvent.pointerUp(editCanvas, { pointerId: 72, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0, clientX: 345, clientY: 415 });

    await waitFor(() => expect((within(surface).getByLabelText('ΔX') as HTMLInputElement).value).toBe('1'));
    expect(model().nodes.find((node) => node.id === 'N1')).toMatchObject({ x: 0, y: 0 });
  });

  it('cancels from Escape inside numeric input with zero model/history effects and keeps selection', async () => {
    const user = userEvent.setup();
    renderCanvas();
    const before = screen.getByLabelText('project-model').textContent;
    const surface = await openStructuralEdit(user, 'select-N1');
    const dx = within(surface).getByLabelText('ΔX');
    await user.clear(dx);
    await user.type(dx, '5');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('region', { name: /edición estructural/i })).toBeNull();
    expect(screen.getByLabelText('project-model').textContent).toBe(before);
    expect(screen.getByLabelText('history-state').textContent).toBe('false:false');
    expect(screen.getByLabelText('selection-model').textContent).toContain('N1');
  });

  it('cancels an in-flight pointer preview without changing numeric draft, ProjectModel or history', async () => {
    const user = userEvent.setup();
    renderCanvas();
    const before = screen.getByLabelText('project-model').textContent;
    const surface = await openStructuralEdit(user, 'select-N1');
    await user.click(within(surface).getByRole('button', { name: /usar puntero/i }));
    const canvas = screen.getByRole('application', { name: /área de trabajo estructural/i });
    fireEvent.pointerDown(canvas, { pointerId: 73, pointerType: 'mouse', button: 0, buttons: 1, clientX: 260, clientY: 500 });
    fireEvent.pointerMove(canvas, { pointerId: 73, pointerType: 'mouse', button: 0, buttons: 1, clientX: 345, clientY: 415 });
    fireEvent.pointerCancel(canvas, { pointerId: 73, pointerType: 'mouse', button: 0, buttons: 0, clientX: 345, clientY: 415 });

    await waitFor(() => expect((within(surface).getByLabelText('ΔX') as HTMLInputElement).value).toBe('0'));
    expect(screen.getByLabelText('project-model').textContent).toBe(before);
    expect(screen.getByLabelText('history-state').textContent).toBe('false:false');
  });

  it('does not leave the Edit launcher tabbable underneath an active duplicate preview', async () => {
    const user = userEvent.setup();
    renderCanvas();
    await user.click(screen.getByText('select-N1'));
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    await waitFor(() => expect(document.querySelector('.duplicate-preview-panel')).toBeTruthy());
    expect(document.querySelector('[data-structural-edit-launcher]')).toBeNull();
  });

  it('applies Rotate and Mirror-transform numerically to real node coordinates', async () => {
    const user = userEvent.setup();
    renderCanvas();
    let surface = await openStructuralEdit(user, 'select-N3');
    await chooseOperation(user, surface, /rotar/i);
    await user.clear(within(surface).getByLabelText(/centro x/i));
    await user.type(within(surface).getByLabelText(/centro x/i), '0');
    await user.clear(within(surface).getByLabelText(/centro y/i));
    await user.type(within(surface).getByLabelText(/centro y/i), '0');
    await user.clear(within(surface).getByLabelText(/ángulo/i));
    await user.type(within(surface).getByLabelText(/ángulo/i), '90');
    await user.click(within(surface).getByRole('button', { name: /^aplicar$/i }));
    await waitFor(() => expect(model().nodes.find((node) => node.id === 'N3')).toMatchObject({ x: -4, y: 0 }));

    surface = await openStructuralEdit(user, 'select-N3');
    await chooseOperation(user, surface, /reflejar/i);
    const axisModes = within(surface).getByRole('radiogroup', { name: /^eje$/i });
    await user.click(within(axisModes).getByRole('radio', { name: /vertical/i }));
    await user.clear(within(surface).getByLabelText(/coordenada del eje/i));
    await user.type(within(surface).getByLabelText(/coordenada del eje/i), '0');
    await user.click(within(surface).getByRole('button', { name: /^aplicar$/i }));
    await waitFor(() => expect(model().nodes.find((node) => node.id === 'N3')).toMatchObject({ x: 4, y: 0 }));
  });

  it('keeps Mirror copy separate and commits remapped new entities', async () => {
    const user = userEvent.setup();
    renderCanvas();
    const before = model();
    const surface = await openStructuralEdit(user, 'select-M1');
    await chooseOperation(user, surface, /reflejar/i);
    const semantics = within(surface).getByRole('radiogroup', { name: /resultado del reflejo/i });
    await user.click(within(semantics).getByRole('radio', { name: /crear copia/i }));
    await user.click(within(surface).getByRole('button', { name: /^aplicar$/i }));

    await waitFor(() => expect(model().members).toHaveLength(before.members.length + 1));
    expect(model().nodes).toHaveLength(before.nodes.length + 2);
    expect(model().nodalLoads).toHaveLength(before.nodalLoads.length + 1);
    const copy = model().members.at(-1)!;
    expect(copy.id).not.toBe('M1');
    expect(model().nodes.some((node) => node.id === copy.i)).toBe(true);
    expect(model().nodes.some((node) => node.id === copy.j)).toBe(true);
  });

  it('commits a complete Linear Array as one history intent', async () => {
    const user = userEvent.setup();
    renderCanvas();
    const before = model();
    const surface = await openStructuralEdit(user, 'select-M1');
    await chooseOperation(user, surface, /matriz lineal/i);
    const count = within(surface).getByLabelText(/instancias totales/i);
    await user.clear(count);
    await user.type(count, '3');
    await user.click(within(surface).getByRole('button', { name: /^aplicar$/i }));

    await waitFor(() => expect(model().members).toHaveLength(before.members.length + 2));
    expect(model().nodes).toHaveLength(before.nodes.length + 4);
    expect(screen.getByLabelText('history-state').textContent).toBe('true:false');
    await user.click(screen.getByText('test-undo'));
    expect(model().members).toHaveLength(before.members.length);
    expect(model().nodes).toHaveLength(before.nodes.length);
    expect(screen.getByLabelText('history-state').textContent).toBe('false:true');
  });

  it('applies node-only Align and Distribute from model coordinates', async () => {
    const user = userEvent.setup();
    renderCanvas();
    let surface = await openStructuralEdit(user, 'select-three-nodes');
    await chooseOperation(user, surface, /alinear/i);
    await user.click(within(surface).getByRole('button', { name: /^aplicar$/i }));
    await waitFor(() => expect(model().nodes.filter((node) => ['N1', 'N2', 'N3'].includes(node.id)).map((node) => node.x)).toEqual([0, 0, 0]));

    await user.click(screen.getByText('test-undo'));
    surface = await openStructuralEdit(user, 'select-three-nodes');
    await chooseOperation(user, surface, /distribuir/i);
    await user.click(within(surface).getByRole('button', { name: /^aplicar$/i }));
    await waitFor(() => expect(model().nodes.filter((node) => ['N1', 'N2', 'N3'].includes(node.id)).map((node) => node.x).sort((a, b) => a - b)).toEqual([0, 3, 6]));
  });
});
