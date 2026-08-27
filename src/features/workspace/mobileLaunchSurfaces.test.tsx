// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';

/**
 * Con qué se encuentra un teléfono al abrir la Mesa.
 *
 * En K0 el detalle no es un dock lateral: es una hoja de 58dvh anclada al borde
 * inferior, encima del lienzo Y de la bandeja de herramientas. Nacía abierta
 * porque `initialOpen` leía `inspectorCollapsed`, que es una preferencia de la
 * mesa ancha —viaja con `inspectorWidth`— y que por defecto vale `false`. El
 * resultado, medido a 390×844: la sesión empezaba con la hoja tapando las seis
 * teclas de la bandeja y media pantalla de lienzo, sin nada con lo que dibujar.
 *
 * Es la misma regla que ya rige «Datos» y «Resultados» (CRI-100/CRI-101): una
 * superficie invocada se pide, no se hereda abierta. Lo que cambia aquí es sólo
 * el arranque; abrirla y cerrarla sigue igual, y en la mesa ancha —donde el
 * detalle SÍ es un dock que convive con el lienzo— la preferencia manda como
 * siempre.
 *
 * Que este gate PUEDE ponerse rojo se comprobó devolviendo `initialOpen` a leer
 * `inspectorCollapsed` en K0: cae por la primera aserción, nombrando la hoja
 * que tapa la bandeja.
 */

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!globalThis.crypto.randomUUID) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: () => '00000000-0000-4000-8000-000000000000' });
  }
});

/** Igual que en `App.test.tsx`: la clase del shell sale del viewport, no de `matchMedia`. */
const setViewport = (viewport: 'desktop' | 'phone') => {
  const [width, height] = viewport === 'phone' ? [390, 844] : [1440, 900];
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.dataset.theme = 'light';
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const openWorkspace = async (user: ReturnType<typeof userEvent.setup>) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  render(<App />);
  await user.click(screen.getByRole('button', { name: /continuar proyecto/i }));
  await screen.findByRole('button', { name: /^analizar$/i }, { timeout: 5000 });
};

describe('lo que ve un teléfono al abrir la Mesa', () => {
  it('no nace con la hoja de detalle encima de la bandeja', async () => {
    setViewport('phone');
    const user = userEvent.setup();
    await openWorkspace(user);

    // La hoja ni siquiera está montada: el broker no la retiene hasta que se
    // pide, así que no hay panel, ni segmentos, ni foco que devolver.
    expect(screen.queryByRole('tab', { name: 'Inspector' })).toBeNull();
    const launcher = screen.getByRole('button', { name: 'Abrir inspector' });
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
  });

  it('deja las seis teclas de la bandeja disponibles desde el primer momento', async () => {
    setViewport('phone');
    const user = userEvent.setup();
    await openWorkspace(user);

    const dock = document.querySelector('.mobile-tool-dock');
    expect(dock).not.toBeNull();
    const keys = [...dock!.querySelectorAll('button')];
    expect(keys).toHaveLength(6);
    for (const key of keys) expect(key.getAttribute('aria-label')).toBeTruthy();
  });

  it('sigue abriéndose a petición, con sus tres segmentos', async () => {
    setViewport('phone');
    const user = userEvent.setup();
    await openWorkspace(user);

    await user.click(screen.getByRole('button', { name: 'Abrir inspector' }));

    expect(screen.getByRole('tab', { name: 'Inspector' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Cargas' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Vista' })).toBeTruthy();
  });

  it('en la mesa ancha el detalle sigue naciendo abierto: allí es un dock, no una hoja', async () => {
    setViewport('desktop');
    const user = userEvent.setup();
    await openWorkspace(user);

    expect(screen.getByRole('tab', { name: 'Inspector' })).toBeTruthy();
  });
});
