// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject, createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { InMemoryProjectRepository } from '../../storage/projectRepository';
import { readWelcomeEntry, shouldResumeDirectly } from './welcomeEntry';
import { WelcomeScreen } from './WelcomeScreen';

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

/**
 * POR QUÉ ESTE ARCHIVO CAMBIÓ DE CONTRATO
 *
 * Hasta aquí las cinco primeras pruebas describían un asistente de cuatro
 * pasos: contaban los nodos del carril, comprobaban que los tres primeros
 * cambiaban de panel y que el cuarto abría la Mesa. Ese recorrido se retiró —
 * ninguna aplicación del sistema abre con un asistente— y con él se fue lo que
 * esas pruebas vigilaban. Un gate no se afloja para dejar pasar un cambio; se
 * reescribe cuando el contrato que defendía deja de existir, diciendo cuál es
 * el nuevo. El nuevo es el de un LANZADOR:
 *
 *   1. UNA superficie por destino. El defecto que el asistente tenía y que
 *      ninguna prueba veía era la duplicación: las mismas cinco puertas
 *      aparecían en el carril de la etapa 1 y otra vez en la etapa 3, más
 *      "Nuevo proyecto" en el centro. Ahora se cuenta.
 *   2. Ninguna capacidad se pierde por el camino: proyecto nuevo, Aula,
 *      plantillas, importación portátil, DXF, Space 3D y continuar siguen
 *      todas alcanzables, y desde la primera pantalla.
 *   3. Space 3D sigue siendo la ÚNICA superficie 3D de la bienvenida y sigue
 *      marcada como experimental (contrato de CRI-104, que no cambió).
 */
const actionList = (container: HTMLElement) => within(container.querySelector('.welcome-action-list') as HTMLElement);
const actionRows = (container: HTMLElement) => [
  ...container.querySelectorAll('.welcome-action-list > .welcome-launcher-card, .welcome-action-list > .welcome-import-card'),
];

const renderWelcome = (language: 'es' | 'en' = 'es') => {
  const project = createBlankProject();
  project.settings = { ...project.settings, language };
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  const onOpenWorkspace = vi.fn();
  const onOpenSpace3D = vi.fn();
  const result = render(
    <ProjectProvider>
      <WelcomeScreen onOpenWorkspace={onOpenWorkspace} onOpenSpace3D={onOpenSpace3D} />
    </ProjectProvider>,
  );
  return { ...result, onOpenWorkspace, onOpenSpace3D };
};

describe('WelcomeScreen · el lanzador', () => {
  it('reúne las siete puertas en una sola lista, sin etapas que recorrer', async () => {
    const { container } = renderWelcome();
    // El DXF llega en su propio chunk perezoso y se une a la misma lista.
    await waitFor(() => expect(actionRows(container)).toHaveLength(7));

    expect(actionList(container).getByRole('button', { name: /Nuevo proyecto/ })).toBeTruthy();
    expect(actionList(container).getByRole('button', { name: /Nuevo ejercicio/ })).toBeTruthy();
    expect(actionList(container).getByRole('button', { name: /Desde plantilla/ })).toBeTruthy();
    expect(actionList(container).getByRole('button', { name: /Biblioteca personal/ })).toBeTruthy();
    expect(actionList(container).getByRole('button', { name: /Importar archivo/ })).toBeTruthy();
    expect(actionList(container).getByRole('button', { name: /DXF/ })).toBeTruthy();
    expect(actionList(container).getByRole('button', { name: /space 3d/i })).toBeTruthy();
  });

  /**
   * La prueba que el asistente no tenía. Cada destino se nombra una vez en toda
   * la pantalla: si alguien vuelve a añadir un atajo "extra" a un sitio que ya
   * tiene su fila, esto lo dice. Se mide sobre la pantalla entera, no sobre la
   * lista, porque la duplicación anterior estaba precisamente FUERA de ella.
   */
  it('no ofrece dos caminos al mismo destino', async () => {
    renderWelcome();
    await waitFor(() => expect(screen.getByRole('button', { name: /DXF/ })).toBeTruthy());

    for (const name of [/Nuevo proyecto/, /Nuevo ejercicio/, /Desde plantilla/, /Biblioteca personal/, /Importar archivo/, /space 3d/i]) {
      expect(screen.getAllByRole('button', { name }), String(name)).toHaveLength(1);
    }
  });

  it('no deja rastro del recorrido por etapas', () => {
    const { container } = renderWelcome();
    expect(container.querySelector('.welcome-steps')).toBeNull();
    expect(container.querySelector('.welcome-gate-rail')).toBeNull();
    expect(container.querySelector('.welcome-panel-nav')).toBeNull();
    expect(container.querySelector('.welcome-screen')?.hasAttribute('data-welcome-step')).toBe(false);
  });

  it('crea un proyecto en blanco y abre la Mesa desde la primera fila', async () => {
    const user = userEvent.setup();
    const { container, onOpenWorkspace } = renderWelcome();

    await user.click(actionList(container).getByRole('button', { name: /Nuevo proyecto/ }));
    expect(onOpenWorkspace).toHaveBeenCalledOnce();
  });

  it('abre la vitrina de plantillas como diálogo, y carga desde ahí', async () => {
    const user = userEvent.setup();
    const { container, onOpenWorkspace } = renderWelcome();

    expect(document.querySelectorAll('.welcome-template-card')).toHaveLength(0);
    await user.click(actionList(container).getByRole('button', { name: /Desde plantilla/ }));

    const dialog = await screen.findByRole('dialog', { name: /Plantillas/ });
    const cards = [...dialog.querySelectorAll('.welcome-template-card')];
    expect(cards.length).toBeGreaterThan(0);

    await user.click(cards[0] as HTMLElement);
    expect(onOpenWorkspace).toHaveBeenCalledOnce();
    // Elegir cierra: la vitrina es una decisión, no un lugar donde se está.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Plantillas/ })).toBeNull());
  });

  it('abre la biblioteca personal en un drawer, sin sustituir al lanzador', async () => {
    const user = userEvent.setup();
    const { container } = renderWelcome();

    expect(screen.queryByRole('button', { name: 'Crear favorito' })).toBeNull();
    await user.click(actionList(container).getByRole('button', { name: /Biblioteca personal/ }));

    const drawer = await screen.findByRole('dialog', { name: 'Biblioteca personal' });
    expect(await within(drawer).findByRole('button', { name: 'Crear favorito' })).toBeTruthy();
  });

  it('marca Space 3D como experimental, no como una superficie más', () => {
    const { container } = renderWelcome();
    expect(actionList(container).getByRole('button', { name: /space 3d/i }).textContent).toMatch(/experimental/i);
  });

  it('abre Space 3D sin tocar el proyecto 2D', async () => {
    const user = userEvent.setup();
    const { container, onOpenSpace3D, onOpenWorkspace } = renderWelcome();

    await user.click(actionList(container).getByRole('button', { name: /space 3d/i }));
    expect(onOpenSpace3D).toHaveBeenCalledOnce();
    expect(onOpenWorkspace).not.toHaveBeenCalled();
  });

  it('pone continuar y la biblioteca en la columna de recientes', async () => {
    const { container } = renderWelcome();
    const recents = container.querySelector('.welcome-column--recents') as HTMLElement;

    expect(recents.querySelector('.welcome-resume-card')).not.toBeNull();
    // El hub real llega en su chunk perezoso y se monta DENTRO de esa columna,
    // no en una banda aparte bajo toda la pantalla.
    expect(await within(recents).findByRole('heading', { name: /Tus proyectos en este dispositivo/ })).toBeTruthy();
  });

  it('continuar abre la Mesa con el proyecto actual, sin sustituirlo', async () => {
    const user = userEvent.setup();
    const { onOpenWorkspace, container } = renderWelcome();
    const name = container.querySelector('.welcome-resume-name')?.textContent;

    await user.click(container.querySelector('.welcome-resume-card') as HTMLElement);
    expect(onOpenWorkspace).toHaveBeenCalledOnce();
    expect(container.querySelector('.welcome-resume-name')?.textContent).toBe(name);
  });
});

describe('welcomeEntry · quién está entrando', () => {
  it('un repositorio vacío es un usuario nuevo, y no salta la bienvenida', async () => {
    const entry = await readWelcomeEntry(new InMemoryProjectRepository());
    expect(entry).toEqual({ status: 'new', projects: 0, recoveries: 0 });
    expect(shouldResumeDirectly(entry)).toBe(false);
  });

  it('un repositorio con proyectos guardados es un usuario recurrente, y entra directo', async () => {
    const repository = new InMemoryProjectRepository();
    await repository.saveProject({ ...createDefaultProject(), name: 'Trabajo de ayer' });

    const entry = await readWelcomeEntry(repository);
    expect(entry.status).toBe('returning');
    expect(entry.projects).toBe(1);
    expect(shouldResumeDirectly(entry)).toBe(true);
  });

  it('con una copia de recuperación pendiente NO salta: la recuperación tiene que verse', async () => {
    const repository = new InMemoryProjectRepository();
    const project = { ...createDefaultProject(), name: 'Trabajo protegido' };
    await repository.saveProject(project);
    await repository.createRecovery(project, 'conflict');

    const entry = await readWelcomeEntry(repository);
    expect(entry.status).toBe('returning');
    expect(entry.recoveries).toBe(1);
    expect(shouldResumeDirectly(entry)).toBe(false);
  });

  it('un repositorio que falla se lee como usuario nuevo, nunca como salto', async () => {
    const broken = {
      listProjects: () => Promise.reject(new Error('IndexedDB bloqueada')),
      listRecoveries: () => Promise.resolve([]),
    } as unknown as InMemoryProjectRepository;

    const entry = await readWelcomeEntry(broken);
    expect(entry.status).toBe('new');
    expect(shouldResumeDirectly(entry)).toBe(false);
  });
});

describe('WelcomeScreen · salto directo a la Mesa', () => {
  it('no salta cuando el shell no lo permite, aunque haya proyectos', async () => {
    const onOpenWorkspace = vi.fn();
    render(
      <ProjectProvider>
        <WelcomeScreen onOpenWorkspace={onOpenWorkspace} allowDirectResume={false} />
      </ProjectProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('welcome-screen')).toBeTruthy());
    expect(onOpenWorkspace).not.toHaveBeenCalled();
  });

  it('sin IndexedDB (jsdom) el usuario es nuevo y la bienvenida se queda', async () => {
    const onOpenWorkspace = vi.fn();
    render(
      <ProjectProvider>
        <WelcomeScreen onOpenWorkspace={onOpenWorkspace} allowDirectResume />
      </ProjectProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('welcome-screen')).toBeTruthy());
    expect(onOpenWorkspace).not.toHaveBeenCalled();
  });
});
