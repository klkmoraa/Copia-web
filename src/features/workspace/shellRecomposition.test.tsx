// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { SHELL_STABLE_COMMIT_MS, ShellCompositionProvider } from './ShellCompositionProvider';
import { useShellComposition } from './useShellComposition';

/**
 * CRI-89 · T-INV-1/2/3 sobre una recomposición real.
 *
 * Resolver una clase nueva es un evento de PRESENTACIÓN. Esta prueba monta el
 * proveedor con estado de dominio vivo —selección, un borrador sin aplicar en
 * un campo, foco y una superficie abierta— y cruza la frontera calculada para
 * comprobar que la recomposición ocurre y que no toca nada de eso.
 */

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
};

const resizeTo = (width: number, height: number) => {
  act(() => {
    setViewport(width, height);
    window.dispatchEvent(new Event('resize'));
  });
  act(() => { vi.advanceTimersByTime(SHELL_STABLE_COMMIT_MS); });
};

/** Superficie de prueba: dominio real de `ProjectProvider`, clase real del shell. */
const Surface = () => {
  const { selection, setSelection, resultTab, setResultTab } = useProject();
  const { shellClass } = useShellComposition();
  return <>
    <output data-testid="shell-class">{shellClass}</output>
    <output data-testid="selection">{selection?.kind === 'node' || selection?.kind === 'member' ? `${selection.kind}:${selection.id}` : 'none'}</output>
    <output data-testid="evidence">{resultTab}</output>
    <button onClick={() => setSelection({ kind: 'node', id: 'N1' })}>seleccionar</button>
    <button onClick={() => setResultTab('shear')}>evidence shear</button>
    <input aria-label="borrador" defaultValue="" />
    {/* La superficie no se desmonta al recomponer: migra de presentación. */}
    <div role="dialog" aria-label="hoja">hoja</div>
  </>;
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  setViewport(1440, 900);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('recomposición del shell', () => {
  it('no pierde selección, borrador, foco ni superficies abiertas al cambiar de clase', () => {
    render(<ProjectProvider><ShellCompositionProvider><Surface /></ShellCompositionProvider></ProjectProvider>);
    expect(screen.getByTestId('shell-class').textContent).toBe('X2');

    // Estado vivo antes de recomponer.
    act(() => { screen.getByRole('button', { name: 'seleccionar' }).click(); });
    act(() => { screen.getByRole('button', { name: 'evidence shear' }).click(); });
    const draft = screen.getByLabelText('borrador') as HTMLInputElement;
    draft.value = 'sin aplicar';
    draft.focus();
    expect(screen.getByTestId('selection').textContent).toBe('node:N1');
    expect(screen.getByTestId('evidence').textContent).toBe('shear');
    expect(document.activeElement).toBe(draft);
    expect(screen.getByRole('dialog', { name: 'hoja' })).toBeTruthy();

    // Recomposición real: X2 → M1 → K0 → M1 → X2, cruzando ambas fronteras.
    //
    // El ancho testigo de Medium baja de 1100 a 1040: al retirar el pie de la
    // Mesa el escenario gana 22 px de alto, X2 cabe antes y la frontera a 768
    // de alto pasa de 1117 a 1073 px, así que 1100 ya es X2. Lo que este gate
    // fija no es el número, es que la recomposición cruce las dos fronteras sin
    // perder selección, borrador ni foco.
    for (const [width, height, expected] of [
      [1024, 768, 'M1'],
      [390, 844, 'K0'],
      [1040, 768, 'M1'],
      [1440, 900, 'X2'],
    ] as const) {
      resizeTo(width, height);
      expect(`${width}:${screen.getByTestId('shell-class').textContent}`).toBe(`${width}:${expected}`);
      // T-INV-1 · la selección no cambia.
      expect(screen.getByTestId('selection').textContent).toBe('node:N1');
      // T-INV-1 · la capa/evidencia activa tampoco cambia.
      expect(screen.getByTestId('evidence').textContent).toBe('shear');
      // T-INV-1 · el borrador sin aplicar sigue sin aplicarse y sin perderse.
      expect((screen.getByLabelText('borrador') as HTMLInputElement).value).toBe('sin aplicar');
      // T-INV-3 · el foco sigue en el mismo elemento, no en el `body`.
      expect(document.activeElement).toBe(draft);
      // T-INV-2 · la superficie abierta migra, no se cierra.
      expect(screen.getByRole('dialog', { name: 'hoja' })).toBeTruthy();
    }
  });

  it('el teclado virtual no recompone ni toca el estado (T-INV-4)', () => {
    setViewport(390, 844);
    render(<ProjectProvider><ShellCompositionProvider><Surface /></ShellCompositionProvider></ProjectProvider>);
    act(() => { screen.getByRole('button', { name: 'seleccionar' }).click(); });
    expect(screen.getByTestId('shell-class').textContent).toBe('K0');

    // El teclado sólo encoge el viewport visual; aun encogiendo también el de
    // layout, en Compact la clase se decide por ancho y no se mueve.
    act(() => { window.visualViewport?.dispatchEvent(new Event('resize')); });
    resizeTo(390, 420);

    expect(screen.getByTestId('shell-class').textContent).toBe('K0');
    expect(screen.getByTestId('selection').textContent).toBe('node:N1');
  });
});
