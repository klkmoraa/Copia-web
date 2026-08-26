// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider, type ResultTab } from '../../store/ProjectContext';
import { CanvasEvidenceBar } from './CanvasEvidenceBar';
import { createEditorLayerState, editorLayerReducer } from './editorLayers';
import { STACK_QUANTITIES, toggleStackQuantity, type StackQuantity } from './diagramStack';

const Harness = ({ onStackToggle = vi.fn(), stackAvailable = true }: { onStackToggle?: () => void; stackAvailable?: boolean }) => {
  const [layers, dispatch] = useReducer(editorLayerReducer, undefined, createEditorLayerState);
  const [resultTab, setResultTab] = useState<ResultTab>('moment');
  const [stackActive, setStackActive] = useState(false);
  const [quantities, setQuantities] = useState<readonly StackQuantity[]>(STACK_QUANTITIES);
  return <CanvasEvidenceBar
    layers={layers}
    dispatchLayers={dispatch}
    resultTab={resultTab}
    setResultTab={setResultTab}
    stackActive={stackActive}
    stackAvailable={stackAvailable}
    stackQuantities={quantities}
    onStackToggle={() => { setStackActive((active) => !active); onStackToggle(); }}
    onStackQuantityToggle={(quantity) => setQuantities((current) => toggleStackQuantity(current, quantity))}
  />;
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('CanvasEvidenceBar', () => {
  it('reaches the four canvas evidence layers in one click, without opening any panel', async () => {
    const user = userEvent.setup();
    const { container } = render(<ProjectProvider><Harness /></ProjectProvider>);
    const buttons = Array.from(container.querySelectorAll('[data-evidence-layer]'))
      .map((node) => node.getAttribute('data-evidence-layer'));
    expect(buttons).toEqual(['axial', 'shear', 'moment', 'deformed', 'acm', 'acm-chooser']);

    const shear = screen.getByRole('button', { name: 'Cortante' });
    expect(shear.getAttribute('aria-pressed')).toBe('false');
    await user.click(shear);
    expect(shear.getAttribute('aria-pressed')).toBe('true');
    // La evidencia es una capa, no una pestaña: volver a pulsarla la apaga.
    await user.click(shear);
    expect(shear.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles the ACM stack and lets the user choose which lanes it deploys', async () => {
    const user = userEvent.setup();
    const onStackToggle = vi.fn();
    render(<ProjectProvider><Harness onStackToggle={onStackToggle} /></ProjectProvider>);

    const acm = screen.getByRole('button', { name: 'ACM' });
    await user.click(acm);
    expect(onStackToggle).toHaveBeenCalledOnce();
    expect(acm.getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByRole('button', { name: /elegir los diagramas/i }));
    const axial = screen.getByRole('checkbox', { name: /axial/i });
    expect((axial as HTMLInputElement).checked).toBe(true);
    await user.click(axial);
    expect((axial as HTMLInputElement).checked).toBe(false);
  });

  it('says the ACM has nothing to deploy instead of drawing an empty canvas', () => {
    render(<ProjectProvider><Harness stackAvailable={false} /></ProjectProvider>);
    const acm = screen.getByRole('button', { name: 'ACM' }) as HTMLButtonElement;
    expect(acm.disabled).toBe(true);
    expect(acm.title).toMatch(/analiza la estructura/i);
  });

  it('is a toolbar: one tab stop, and the arrows walk the controls', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);
    expect(screen.getByRole('toolbar', { name: /vistas rápidas/i })).toBeTruthy();

    screen.getByRole('button', { name: 'Axial' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cortante' }));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /elegir los diagramas/i }));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Axial' }));
  });

  it('takes focus into the ACM chooser and hands it back when it closes', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);
    const chooser = screen.getByRole('button', { name: /elegir los diagramas/i });
    await user.click(chooser);
    expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: /axial/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('checkbox', { name: /axial/i })).toBeNull();
    expect(document.activeElement).toBe(chooser);
  });

  it('never lets the stack be emptied: the last lane cannot be switched off', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><Harness /></ProjectProvider>);
    await user.click(screen.getByRole('button', { name: /elegir los diagramas/i }));
    await user.click(screen.getByRole('checkbox', { name: /axial/i }));
    await user.click(screen.getByRole('checkbox', { name: /cortante/i }));
    const moment = screen.getByRole('checkbox', { name: /momento/i }) as HTMLInputElement;
    expect(moment.checked).toBe(true);
    expect(moment.disabled).toBe(true);
  });
});
