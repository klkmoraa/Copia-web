// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHELL_STABLE_COMMIT_MS, ShellCompositionProvider } from './ShellCompositionProvider';
import { useShellComposition } from './useShellComposition';

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
};

/** Redimensiona y deja pasar la ventana de quietud que exige T-INV-5. */
const resizeTo = (width: number, height: number) => {
  act(() => {
    setViewport(width, height);
    window.dispatchEvent(new Event('resize'));
  });
  act(() => { vi.advanceTimersByTime(SHELL_STABLE_COMMIT_MS); });
};

let renders = 0;

const Probe = () => {
  const { shellClass, phone } = useShellComposition();
  renders += 1;
  return <output data-testid="probe">{`${shellClass}:${phone}:${renders}`}</output>;
};

const readProbe = () => screen.getByTestId('probe').textContent ?? '';
const readClass = () => readProbe().split(':')[0];

beforeEach(() => {
  renders = 0;
  vi.useFakeTimers();
  setViewport(1440, 900);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ShellCompositionProvider', () => {
  it('publica la clase resuelta del viewport de layout desde el primer render', () => {
    setViewport(390, 844);
    render(<ShellCompositionProvider><Probe /></ShellCompositionProvider>);
    expect(readProbe()).toBe('K0:true:1');
  });

  it('sólo emite cuando la composición cambia, no en cada resize', () => {
    render(<ShellCompositionProvider><Probe /></ShellCompositionProvider>);
    expect(readClass()).toBe('X2');
    const initialRenders = renders;

    // Ocho tamaños distintos dentro de Expanded: nada que publicar.
    for (const width of [1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200]) resizeTo(width, 900);
    expect(renders).toBe(initialRenders);
    expect(readClass()).toBe('X2');

    // Cruzar a Compact sí es una emisión, y exactamente una.
    resizeTo(390, 844);
    expect(renders).toBe(initialRenders + 1);
    expect(readProbe().startsWith('K0:true')).toBe(true);
  });

  it('no commitea hasta que el tamaño se queda quieto (T-INV-5)', () => {
    render(<ShellCompositionProvider><Probe /></ShellCompositionProvider>);
    const initialRenders = renders;

    // Arrastre continuo: 12 pasos seguidos sin pausa, cruzando la frontera.
    act(() => {
      for (let width = 1440; width >= 900; width -= 45) {
        setViewport(width, 900);
        window.dispatchEvent(new Event('resize'));
        vi.advanceTimersByTime(16);
      }
    });
    // Nada se ha commiteado todavía: el tamaño no ha estado quieto.
    expect(renders).toBe(initialRenders);

    act(() => { vi.advanceTimersByTime(SHELL_STABLE_COMMIT_MS); });
    expect(renders).toBe(initialRenders + 1);
    expect(readClass()).toBe('K0');
  });

  it('no oscila al arrastrar sobre la frontera dentro de la banda', () => {
    setViewport(1129, 768);
    render(<ShellCompositionProvider><Probe /></ShellCompositionProvider>);
    expect(readClass()).toBe('X2');
    const initialRenders = renders;

    // Ida y vuelta veinte veces dentro de la banda de 24 px: cero emisiones.
    for (let round = 0; round < 10; round += 1) {
      resizeTo(1110, 768);
      resizeTo(1126, 768);
    }
    expect(renders).toBe(initialRenders);
    expect(readClass()).toBe('X2');
  });

  it('cruza el techo de Compact exacto, también a través de la máquina de estados', () => {
    setViewport(1024, 768);
    render(<ShellCompositionProvider><Probe /></ShellCompositionProvider>);
    expect(readClass()).toBe('M1');

    // 1024 → 1023 → 1024: el CSS conmuta en ese píxel y la clase también. Con
    // banda, la vuelta a M1 no habría llegado hasta 1036.
    resizeTo(1023, 768);
    expect(readClass()).toBe('K0');
    resizeTo(1024, 768);
    expect(readClass()).toBe('M1');
    resizeTo(1023, 768);
    expect(readClass()).toBe('K0');
  });

  it('T-INV-4 · el teclado virtual no recompone', () => {
    setViewport(390, 844);
    render(<ShellCompositionProvider><Probe /></ShellCompositionProvider>);
    const initialRenders = renders;

    // `visualViewport` es lo único que el teclado encoge de verdad, y el
    // resolutor no lo escucha. Aun así se emite el evento para probarlo.
    act(() => {
      window.visualViewport?.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(SHELL_STABLE_COMMIT_MS * 4);
    });
    expect(renders).toBe(initialRenders);
    expect(readClass()).toBe('K0');

    // Y si un navegador además encogiera la altura de layout, la clase de
    // Compact tampoco se mueve: se decide por ancho.
    resizeTo(390, 420);
    expect(readClass()).toBe('K0');
    expect(renders).toBe(initialRenders);
  });

  it('recompone al rotar, sin pasar por una clase intermedia', () => {
    setViewport(390, 844);
    render(<ShellCompositionProvider><Probe /></ShellCompositionProvider>);
    expect(readProbe().startsWith('K0:true')).toBe(true);
    const initialRenders = renders;

    act(() => {
      setViewport(844, 390);
      window.dispatchEvent(new Event('orientationchange'));
    });
    act(() => { vi.advanceTimersByTime(SHELL_STABLE_COMMIT_MS); });

    expect(readProbe().startsWith('K0:false')).toBe(true);
    expect(renders).toBe(initialRenders + 1);
  });
});

describe('useShellComposition sin proveedor', () => {
  it('resuelve del viewport con la misma función pura, sin estado propio', () => {
    setViewport(1280, 800);
    render(<Probe />);
    expect(readClass()).toBe('X2');
  });
});
