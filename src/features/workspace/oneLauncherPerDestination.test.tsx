// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';

/**
 * Un destino, un lanzador.
 *
 * Es el defecto que nadie veia. La Mesa llego a tener TRES sitios distintos
 * desde los que pedir las mismas superficies —el pie del riel de herramientas
 * en X2/M1, el lanzador flotante en K0 y los iconos de la barra superior—, con
 * copias que no compartian ni definicion ni comando: `Resultados` se abria
 * desde dos botones y desde ningun comando registrado. Ninguna prueba lo
 * miraba, porque cada copia funcionaba.
 *
 * La bienvenida ya tiene su equivalente desde `welcomeFlow.test.tsx` («una sola
 * superficie por destino»). Esto es lo mismo para el area de trabajo.
 *
 * Que este gate PUEDE ponerse rojo se comprobo devolviendo el boton
 * «Resultados» al lanzador flotante: la prueba cae nombrando el destino
 * duplicado.
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

/**
 * Destinos de superficie, no herramientas de dibujo. Una herramienta puede
 * repetirse a proposito (el riel ancho y el dock tactil son la misma
 * herramienta en dos composiciones); una superficie no: pedirla dos veces desde
 * dos marcados distintos es como se llega a dos definiciones que divergen.
 */
const SURFACE_DESTINATIONS = ['Resultados', 'Hoja de datos estructural', 'Model Doctor'] as const;

describe('un destino, un lanzador', () => {
  for (const viewport of ['desktop', 'phone'] as const) {
    it(`no duplica el lanzador de ninguna superficie en ${viewport}`, async () => {
      setViewport(viewport);
      const user = userEvent.setup();
      await openWorkspace(user);

      const duplicated = SURFACE_DESTINATIONS
        .map((name) => ({ name, count: screen.queryAllByRole('button', { name }).length }))
        .filter((entry) => entry.count > 1);

      expect(duplicated).toEqual([]);
    });
  }

  it('no deja ningun destino sin lanzador', async () => {
    setViewport('desktop');
    const user = userEvent.setup();
    await openWorkspace(user);

    // Lo contrario del defecto anterior y el riesgo de arreglarlo: retirar una
    // copia de mas y quedarse con cero.
    const missing = SURFACE_DESTINATIONS.filter((name) => screen.queryAllByRole('button', { name }).length === 0);
    expect(missing).toEqual([]);
  });

  it('abre el panel derecho desde un solo boton y con sus tres segmentos dentro', async () => {
    setViewport('phone');
    const user = userEvent.setup();
    await openWorkspace(user);

    expect(screen.getAllByRole('button', { name: 'Abrir inspector' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Abrir inspector' }));

    // Cargas y Vista llegan como segmentos del panel, no como dos botones mas
    // en el lanzador flotante ni como dos superficies del broker.
    expect(screen.getByRole('tab', { name: 'Inspector' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Cargas' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Vista' })).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: 'Cargas' })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: 'Vista' })).toHaveLength(0);
  });
});
