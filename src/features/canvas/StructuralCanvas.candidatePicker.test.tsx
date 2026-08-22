// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { createEditorLayerState } from './editorLayers';
import { StructuralCanvas } from './StructuralCanvas';
import { SurfacePresentationProvider } from '../workspace/SurfacePresentationProvider';
import type { ShellClass } from '../workspace/shellComposition';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeAll(() => vi.stubGlobal('ResizeObserver', ResizeObserverMock));

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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const Harness = () => {
  const { selection, setSelection } = useProject();
  return <>
    <output aria-label="selection-model">{JSON.stringify(selection)}</output>
    <button type="button" onClick={() => setSelection({ kind: 'node', id: 'N3' })}>previous-N3</button>
    <StructuralCanvas layers={createEditorLayerState()} dispatchLayers={() => undefined} />
  </>;
};

const renderCanvas = () => render(<ProjectProvider><Harness /></ProjectProvider>);

const BrokeredHarness = () => {
  const [shellClass, setShellClass] = useState<ShellClass>('X2');
  const backgroundRef = useRef<HTMLDivElement>(null);
  const { selection, setSelection } = useProject();
  return <SurfacePresentationProvider shellClass={shellClass} backgroundRef={backgroundRef}>
    <div ref={backgroundRef}>
      <button type="button" onClick={() => setShellClass('K0')}>compact composition</button>
      <output aria-label="selection-model">{JSON.stringify(selection)}</output>
      <button type="button" onClick={() => setSelection({ kind: 'node', id: 'N3' })}>previous-N3</button>
      <StructuralCanvas layers={createEditorLayerState()} dispatchLayers={() => undefined} />
    </div>
  </SurfacePresentationProvider>;
};

const renderBrokeredCanvas = () => render(<ProjectProvider><BrokeredHarness /></ProjectProvider>);
const target = (kind: string, id: string) => document.querySelector<SVGGElement>(`[data-structure-kind="${kind}"][data-structure-id="${id}"]`)!;
const selectionModel = () => screen.getByLabelText('selection-model').textContent;
const canvas = () => screen.getByRole('application');
const pickerListbox = () => document.querySelector('[data-candidate-picker] [role="listbox"]');

// Closing the picker hands the keyboard route back to the canvas on the next
// animation frame. A real second gesture always arrives long after that frame;
// a test that reopens the picker in the same tick does not, and the pending
// restoration then lands on top of the *new* picker and steals its focus, so
// its keys reach the canvas instead. Waiting for the restoration by condition
// reproduces the real sequencing without depending on wall-clock timing.
const settleFocusAfterClose = async () => {
  await waitFor(() => expect(document.activeElement).toBe(canvas()));
};

const setCandidatesAtPoint = (...elements: Element[]) => {
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: vi.fn(() => elements),
  });
};

const openByPointer = (pointerType: 'mouse' | 'pen' | 'touch', pointerId = 1, element = target('node', 'N1')) => {
  fireEvent.pointerDown(element, {
    pointerId,
    pointerType,
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 260,
    clientY: 500,
  });
};

describe('StructuralCanvas candidate picker', () => {
  it('keeps the existing immediate path for one candidate', () => {
    renderCanvas();
    setCandidatesAtPoint(target('nodalLoad', 'NL1'));

    openByPointer('mouse', 1, target('nodalLoad', 'NL1'));

    expect(document.querySelector('[data-candidate-picker]')).toBeNull();
    expect(selectionModel()).toContain('NL1');
  });

  it('opens three candidates from mouse and previews without replacing the prior selection', async () => {
    const user = userEvent.setup();
    renderCanvas();
    await user.click(screen.getByRole('button', { name: 'previous-N3' }));
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'), target('nodalLoad', 'NL1'));

    openByPointer('mouse');

    expect(document.querySelector('[data-candidate-picker]')).not.toBeNull();
    expect(selectionModel()).toContain('N3');
    expect(target('node', 'N1').getAttribute('data-candidate-preview')).toBe('true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('opens the same explicit candidates from a keyboard target', async () => {
    const user = userEvent.setup();
    renderCanvas();
    await user.click(screen.getByRole('button', { name: 'previous-N3' }));
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'), target('nodalLoad', 'NL1'));

    target('node', 'N1').focus();
    fireEvent.keyDown(target('node', 'N1'), { key: 'Enter' });

    expect(document.querySelector('[data-candidate-picker]')).not.toBeNull();
    expect(selectionModel()).toContain('N3');
    expect(target('node', 'N1').getAttribute('data-candidate-preview')).toBe('true');
  });

  it('uses the same ambiguous-picker contract for pen and touch long press at 480 ms', () => {
    vi.useFakeTimers();
    renderCanvas();
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'), target('nodalLoad', 'NL1'));

    openByPointer('pen', 2);
    expect(document.querySelector('[data-candidate-picker]')).not.toBeNull();
    cleanup();

    renderCanvas();
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'), target('nodalLoad', 'NL1'));
    openByPointer('touch', 3);
    act(() => vi.advanceTimersByTime(479));
    expect(document.querySelector('[data-candidate-picker]')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(document.querySelector('[data-candidate-picker]')).not.toBeNull();
  });

  it('cycles preview through the keyboard, confirms only the active candidate, and Escape preserves selection', async () => {
    const user = userEvent.setup();
    renderCanvas();
    await user.click(screen.getByRole('button', { name: 'previous-N3' }));
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'), target('nodalLoad', 'NL1'));
    openByPointer('mouse');

    await user.keyboard('{ArrowDown}');
    expect(target('member', 'M1').getAttribute('data-candidate-preview')).toBe('true');
    expect(selectionModel()).toContain('N3');
    await user.keyboard('{Escape}');
    expect(document.querySelector('[data-candidate-picker]')).toBeNull();
    expect(selectionModel()).toContain('N3');
    await settleFocusAfterClose();

    openByPointer('mouse', 4);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(selectionModel()).toContain('M1');
  });

  it('hands the keyboard route to the picker on open and back to the canvas on Escape', async () => {
    const user = userEvent.setup();
    renderCanvas();
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'), target('nodalLoad', 'NL1'));

    openByPointer('mouse', 10);
    expect(document.activeElement).toBe(pickerListbox());

    await user.keyboard('{Escape}');
    expect(document.querySelector('[data-candidate-picker]')).toBeNull();
    await settleFocusAfterClose();
  });

  it('keeps an additive pointer selection when an explicit candidate is confirmed', async () => {
    const user = userEvent.setup();
    renderCanvas();
    await user.click(screen.getByRole('button', { name: 'previous-N3' }));
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'));

    fireEvent.pointerDown(target('node', 'N1'), {
      pointerId: 9,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: 1,
      shiftKey: true,
      clientX: 260,
      clientY: 500,
    });
    await user.keyboard('{Enter}');

    expect(selectionModel()).toContain('N3');
    expect(selectionModel()).toContain('N1');
  });

  it('keeps the picker transactional when an outside canvas pointer arrives', async () => {
    const user = userEvent.setup();
    renderCanvas();
    await user.click(screen.getByRole('button', { name: 'previous-N3' }));
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'), target('nodalLoad', 'NL1'));
    openByPointer('mouse');

    fireEvent.pointerDown(screen.getByRole('application'), {
      pointerId: 8,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: 540,
      clientY: 360,
    });

    expect(document.querySelector('[data-candidate-picker]')).not.toBeNull();
    expect(selectionModel()).toContain('N3');
  });

  it('does not arm marquee or a picker after slow touch movement', () => {
    vi.useFakeTimers();
    renderCanvas();
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'), target('nodalLoad', 'NL1'));

    openByPointer('touch', 5);
    fireEvent.pointerMove(screen.getByRole('application'), {
      pointerId: 5,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 264,
      clientY: 500,
    });
    act(() => vi.advanceTimersByTime(480));

    expect(document.querySelector('[data-candidate-picker]')).toBeNull();
    expect(screen.getByRole('application').getAttribute('data-interaction')).not.toBe('selection-box');
  });

  it('uses the same 480 ms long-press mechanism to arm a background marquee', () => {
    vi.useFakeTimers();
    renderCanvas();
    const canvas = screen.getByRole('application');

    fireEvent.pointerDown(canvas, {
      pointerId: 6,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: 320,
      clientY: 480,
    });
    act(() => vi.advanceTimersByTime(479));
    expect(canvas.getAttribute('data-interaction')).not.toBe('selection-box');
    act(() => vi.advanceTimersByTime(1));

    expect(canvas.getAttribute('data-interaction')).toBe('selection-box');
    expect(document.querySelector('[data-candidate-picker]')).toBeNull();
  });

  it('migrates an open picker to Compact without auto-confirming its candidate', async () => {
    const user = userEvent.setup();
    renderBrokeredCanvas();
    await user.click(screen.getByRole('button', { name: 'previous-N3' }));
    setCandidatesAtPoint(target('node', 'N1'), target('member', 'M1'), target('nodalLoad', 'NL1'));
    openByPointer('mouse', 7);

    expect(selectionModel()).toContain('N3');
    await user.click(screen.getByRole('button', { name: 'compact composition' }));

    expect(document.querySelector('[data-candidate-picker]')?.getAttribute('data-surface-presentation')).toBe('sheet');
    expect(selectionModel()).toContain('N3');
    expect(target('node', 'N1').getAttribute('data-candidate-preview')).toBe('true');
  });
});
