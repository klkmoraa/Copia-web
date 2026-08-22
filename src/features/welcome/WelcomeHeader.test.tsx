// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { WelcomeScreen } from './WelcomeScreen';

// `WelcomeScreen` usa `useReducedMotion` de `motion/react` (vía `StructuralPortalHero`
// y las tarjetas animadas), que consulta `matchMedia` al montar. jsdom no lo implementa
// por defecto, así que sin este mock el montaje falla antes de llegar a la cabecera —
// el mismo motivo por el que `WelcomeScreen.test.tsx` lo trae en su `beforeAll`.
beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const renderWelcome = () =>
  render(<ProjectProvider><WelcomeScreen onOpenWorkspace={() => {}} /></ProjectProvider>);

describe('WelcomeScreen header', () => {
  it('toggles the theme from the welcome screen', async () => {
    const user = userEvent.setup();
    renderWelcome();
    const before = document.documentElement.getAttribute('data-theme');
    await user.click(screen.getByRole('button', { name: /tema|theme/i }));
    expect(document.documentElement.getAttribute('data-theme')).not.toBe(before);
  });

  it('changes the language from the welcome screen', async () => {
    const user = userEvent.setup();
    renderWelcome();
    await user.selectOptions(screen.getByLabelText(/idioma|language/i), 'en');
    // No basta con que exista *un* h1: eso pasaría igual si `updateProjectView`
    // fuera un no-op. Se afirma el contenido real tras el cambio de idioma
    // (mismo idiom que `App.test.tsx`: `.textContent).toContain(...)`).
    //
    // CRI-104: el h1 es el wordmark —"structureCo", que no se traduce— y la
    // marca la completa UNA línea debajo. Es esa línea la que tiene que
    // cambiar de idioma, así que es la que se afirma.
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.textContent).toContain('structureCo');
    expect((await screen.findByText(/2D structural analysis/i)).textContent)
      .toContain('Classroom Mode');
  });

  it('keeps the brand to a wordmark and a single line — no editorial headline', () => {
    const { container } = renderWelcome();
    expect(container.querySelectorAll('.welcome-brand-line')).toHaveLength(1);
    expect(container.querySelector('.welcome-brand-line')?.textContent?.trim())
      .toBe('Análisis estructural 2D y Modo Aula, local en este dispositivo.');
    // El titular editorial a dos líneas de la versión anterior desapareció.
    expect(container.querySelector('.welcome-title-accent')).toBeNull();
    expect(container.querySelector('.welcome-hero-subtitle')).toBeNull();
  });

  it('keeps every header action reachable, and returns focus when the drawer closes', async () => {
    const user = userEvent.setup();
    renderWelcome();
    const trigger = screen.getByRole('button', { name: /menú|menu/i });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    // El foco vuelve de forma asíncrona (ver `useModalFocus` en `overlays.tsx`,
    // que además de la llamada síncrona en el cleanup del efecto agenda un
    // segundo `focus()` en el siguiente frame) — igual que ya hace la prueba
    // homóloga en `modalFocus.test.tsx`, se envuelve en `waitFor`.
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  // Red para la ronda de corrección 1/5: `themeControl`/`languageControl` se
  // montan dos veces (cabecera de escritorio + drawer). En un navegador real
  // sólo una copia queda en el árbol de accesibilidad porque la otra tiene
  // `display:none` — pero jsdom no evalúa `@media` de una hoja de estilos
  // real, así que ese contrato responsive no es observable aquí (para eso
  // está `npm run qa`, el recorrido Playwright). Lo que SÍ es observable en
  // jsdom es `aria-hidden`/`inert`: con el drawer abierto, `.welcome-base`
  // (que envuelve la copia de escritorio) debe quedar marcado inaccesible,
  // igual que ya ocurre con `exerciseDialogOpen`/`importCenterOpen`, dejando
  // sólo la copia del drawer alcanzable por rol.
  it('exposes exactly one theme control and one language control while the drawer is open', async () => {
    const user = userEvent.setup();
    renderWelcome();
    await user.click(screen.getByRole('button', { name: /menú|menu/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    // `getByLabelText` no filtra por accesibilidad (ignora `aria-hidden`/`inert`
    // en el ancestro), así que con el `<select>` se consulta por rol —
    // `combobox` es su rol implícito— igual que el botón de tema.
    expect(screen.getAllByRole('button', { name: /tema|theme/i })).toHaveLength(1);
    expect(screen.getAllByRole('combobox', { name: /idioma|language/i })).toHaveLength(1);
  });
});
