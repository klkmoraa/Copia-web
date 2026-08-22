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
 * El carril de pasos. Se consulta acotado a `<nav>` porque los mismos rótulos
 * ("Por dónde", "Mesa") aparecen también en los enlaces de avance del panel:
 * son el mismo destino nombrado igual, que es justo lo que se quiere, y por
 * eso la prueba dice de cuál de los dos habla en vez de exigir que uno cambie
 * de nombre.
 */
const stepRail = (container: HTMLElement) => within(container.querySelector('.welcome-steps') as HTMLElement);

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

describe('WelcomeScreen · los cuatro pasos', () => {
  it('publica exactamente cuatro pasos, en orden', () => {
    const { container } = renderWelcome();
    const steps = [...container.querySelectorAll('.welcome-steps .welcome-step')];
    expect(steps.map((step) => step.textContent?.replace(/^\d/, '').trim()))
      .toEqual(['Bienvenida', 'Cómo trabajas', 'Por dónde', 'Mesa']);
  });

  it('los tres primeros pasos son navegables y marcan el activo para lectores de pantalla', async () => {
    const user = userEvent.setup();
    const { container } = renderWelcome();

    const rail = stepRail(container);
    expect(container.querySelector('.welcome-screen')?.getAttribute('data-welcome-step')).toBe('welcome');
    expect(rail.getByRole('button', { name: 'Bienvenida' }).getAttribute('aria-current')).toBe('step');

    await user.click(rail.getByRole('button', { name: 'Cómo trabajas' }));
    expect(container.querySelector('.welcome-screen')?.getAttribute('data-welcome-step')).toBe('how');
    expect(rail.getByRole('button', { name: 'Cómo trabajas' }).getAttribute('aria-current')).toBe('step');
    expect(rail.getByRole('button', { name: 'Bienvenida' }).getAttribute('aria-current')).toBeNull();

    await user.click(rail.getByRole('button', { name: 'Por dónde' }));
    expect(container.querySelector('.welcome-screen')?.getAttribute('data-welcome-step')).toBe('where');
  });

  it('el cuarto paso ES la Mesa: la abre en vez de cambiar de panel', async () => {
    const user = userEvent.setup();
    const { onOpenWorkspace, container } = renderWelcome();

    await user.click(stepRail(container).getByRole('button', { name: 'Mesa' }));
    expect(onOpenWorkspace).toHaveBeenCalledOnce();
    // La bienvenida no se reordena a sí misma: quien decide de pantalla es el shell.
    expect(container.querySelector('.welcome-screen')?.getAttribute('data-welcome-step')).toBe('welcome');
  });

  it('elegir un modo de trabajo lleva a la etapa 3 y ordena la vitrina', async () => {
    const user = userEvent.setup();
    const { container } = renderWelcome();

    await user.click(stepRail(container).getByRole('button', { name: 'Cómo trabajas' }));
    await user.click(screen.getByRole('button', { name: /Nuevo ejercicio/ }));

    expect(container.querySelector('.welcome-screen')?.getAttribute('data-welcome-step')).toBe('where');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Académicos' }).getAttribute('aria-selected')).toBe('true'));
  });
});

describe('WelcomeScreen · las puertas siguen alcanzables', () => {
  it('mantiene continuar y nuevo proyecto en la primera etapa, con el hub de proyectos', async () => {
    const { container } = renderWelcome();
    expect(container.querySelector('.welcome-resume-card')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Nuevo proyecto/ })).toBeTruthy();
    // El hub real llega en su chunk perezoso y se monta dentro de la etapa 1,
    // no en una pantalla aparte: su encabezado tiene que aparecer aquí.
    expect(await screen.findByRole('heading', { name: /Tus proyectos en este dispositivo/ })).toBeTruthy();
  });

  it('mantiene importación portátil, DXF, ejemplos, Aula y Space 3D en la etapa 3', async () => {
    const user = userEvent.setup();
    const { container } = renderWelcome();
    await user.click(stepRail(container).getByRole('button', { name: 'Por dónde' }));

    expect(screen.getByRole('button', { name: /Importar archivo/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nuevo ejercicio/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Lienzo en blanco/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /space 3d/i })).toBeTruthy();
    expect(container.querySelectorAll('.welcome-template-card').length).toBeGreaterThan(0);
    // El DXF llega en su propio chunk perezoso, igual que antes.
    await waitFor(() => expect(screen.getByRole('button', { name: /DXF/ })).toBeTruthy());
  });

  it('marca Space 3D como experimental, no como una superficie más', async () => {
    const user = userEvent.setup();
    const { container } = renderWelcome();
    await user.click(stepRail(container).getByRole('button', { name: 'Por dónde' }));
    expect(screen.getByRole('button', { name: /space 3d/i }).textContent).toMatch(/experimental/i);
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
