// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_BACKUP_KEY, PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ClassroomSessionProvider } from '../../store/ClassroomSessionContext';
import { ProjectProvider } from '../../store/ProjectContext';
import { TopBar } from './TopBar';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';

const TopBarHarness = ({ children }: { children: React.ReactNode }) => <ProjectProvider><ClassroomSessionProvider projectId="topbar-test">{children}</ClassroomSessionProvider></ProjectProvider>;

const portableMocks = vi.hoisted(() => ({
  createCalculationReport: vi.fn(),
  createPortableBundle: vi.fn(),
  shareOrDownloadPortableBytes: vi.fn(),
}));

vi.mock('../../utils/portable', () => ({
  ...portableMocks,
  STRUCTURECO_BUNDLE_MIME: 'application/vnd.structureco.bundle+zip',
}));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
  portableMocks.createCalculationReport.mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    filename: 'memoria-structureco.pdf',
    payload: {},
  });
  portableMocks.shareOrDownloadPortableBytes.mockResolvedValue('downloaded');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TopBar portable export', () => {
  it('localizes portable export, navigation, and built-in example presentation in English', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.settings = { ...project.settings, language: 'en' };
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    render(<TopBarHarness><TopBar onOpenHome={vi.fn()} /></TopBarHarness>);

    expect(screen.getByRole('button', { name: 'Go to start' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open projects and examples' }));
    expect(screen.getByRole('menuitem', { name: /Example frame.*6 × 4 m frame/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Simply supported beam.*8 m beam/ })).toBeTruthy();
    expect(screen.queryByText('Pórtico de ejemplo')).toBeNull();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Complete reimportable PDF' }));
    await waitFor(() => expect(portableMocks.shareOrDownloadPortableBytes).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'memoria-structureco.pdf',
      'application/pdf',
      expect.stringContaining('calculation report'),
    ));
  });

  it('uses localized fallback feedback when a first-party export error is not presentation-safe', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.settings = { ...project.settings, language: 'en' };
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    portableMocks.createCalculationReport.mockRejectedValue(new Error('No se pudo generar el expediente.'));
    render(<TopBarHarness><TopBar /></TopBarHarness>);

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Complete reimportable PDF' }));

    expect((await screen.findByRole('alert')).textContent).toContain('The package could not be generated.');
    expect(screen.queryByText('No se pudo generar el expediente.')).toBeNull();
  });

  it('keeps the PDF option enabled before the user runs Analysis', async () => {
    const user = userEvent.setup();
    render(<TopBarHarness><TopBar /></TopBarHarness>);

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    const pdfButton = screen.getByRole('button', { name: 'PDF completo reimportable' }) as HTMLButtonElement;

    expect(pdfButton.disabled).toBe(false);
  });

  it('analyzes the current project and generates the PDF from one click', async () => {
    const user = userEvent.setup();
    render(<TopBarHarness><TopBar /></TopBarHarness>);

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    await user.click(screen.getByRole('button', { name: 'PDF completo reimportable' }));

    await waitFor(() => expect(portableMocks.createCalculationReport).toHaveBeenCalledOnce());
    const [, generatedAnalysis] = portableMocks.createCalculationReport.mock.calls[0];
    expect(generatedAnalysis.success).toBe(true);
    expect(portableMocks.shareOrDownloadPortableBytes).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      'memoria-structureco.pdf',
      'application/pdf',
      expect.stringContaining('memoria de cálculo'),
    );
  });
});

describe('TopBar copy project JSON', () => {
  it('copies the normalized project JSON to the clipboard when available', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText } });
    const toasts: unknown[] = [];
    const unsubscribe = onWorkspaceCommand('show-toast', (payload) => toasts.push(payload));
    render(<TopBarHarness><TopBar /></TopBarHarness>);

    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    await user.click(screen.getByRole('menuitem', { name: /Copiar datos/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const [payload] = writeText.mock.calls[0];
    expect(() => JSON.parse(payload)).not.toThrow();
    await waitFor(() => expect(toasts).toEqual([expect.objectContaining({ message: '¡Copiado!', tone: 'success' })]));
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Exportar' })).toBeNull());

    unsubscribe();
    // @ts-expect-error test-only cleanup of a jsdom property defined above
    delete window.navigator.clipboard;
  });

  it('falls back to downloading the file when the clipboard is unavailable', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    const createObjectURL = vi.fn().mockReturnValue('blob:mock');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const toasts: unknown[] = [];
    const unsubscribe = onWorkspaceCommand('show-toast', (payload) => toasts.push(payload));
    render(<TopBarHarness><TopBar /></TopBarHarness>);

    await user.click(screen.getByRole('button', { name: 'Exportar' }));
    await user.click(screen.getByRole('menuitem', { name: /Copiar datos/ }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce());
    await waitFor(() => expect(toasts).toEqual([expect.objectContaining({
      message: 'Portapapeles no disponible: se descargó el archivo',
      tone: 'info',
    })]));

    unsubscribe();
  });
});

describe('TopBar information architecture', () => {
  it('announces local-first and offline states without relying on color', async () => {
    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);
    const status = container.querySelector<HTMLElement>('.autosave-state');

    expect(status?.dataset.storageState).toBe('local');
    expect(status?.textContent).toContain('Local');
    expect(status?.querySelector('svg')).not.toBeNull();
    expect(status?.tabIndex).toBe(0);
    const description = document.getElementById(status?.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toContain('Guardado localmente');

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));

    await waitFor(() => expect(status?.dataset.storageState).toBe('offline'));
    expect(status?.textContent).toContain('Sin conexión');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.title).toContain('Puedes seguir trabajando');
    expect(description?.textContent).toContain('Puedes seguir trabajando');
  });

  it('distinguishes a load failure from a save failure', () => {
    localStorage.setItem(PROJECT_STORAGE_KEY, '{invalid');
    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);
    const status = container.querySelector<HTMLElement>('.autosave-state');

    expect(status?.dataset.storageState).toBe('load-error');
    expect(status?.textContent).toContain('Error al cargar');
    expect(status?.title).toContain('No se pudo abrir la copia local');
  });

  it('prioritizes the actionable offline state over a recovered backup notice', () => {
    localStorage.setItem(PROJECT_BACKUP_KEY, JSON.stringify(createDefaultProject()));
    localStorage.setItem(PROJECT_STORAGE_KEY, '{invalid');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });

    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);
    const status = container.querySelector<HTMLElement>('.autosave-state');

    expect(status?.dataset.storageState).toBe('offline');
    expect(status?.textContent).toMatch(/Sin conexi/);
  });

  it('keeps a local-load error visible when the browser is also offline', () => {
    localStorage.setItem(PROJECT_STORAGE_KEY, '{invalid');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });

    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);
    const status = container.querySelector<HTMLElement>('.autosave-state');

    expect(status?.dataset.storageState).toBe('load-error');
    expect(status?.textContent).toContain('Error al cargar');
  });

  it('returns focus to the project menu trigger after closing Import Center', async () => {
    const user = userEvent.setup();
    render(<TopBarHarness><TopBar /></TopBarHarness>);

    const projectMenuTrigger = screen.getByRole('button', { name: 'Abrir proyectos y ejemplos' });
    await user.click(projectMenuTrigger);
    await user.click(screen.getByRole('menuitem', { name: 'Importar JSON' }));
    await screen.findByRole('dialog', { name: /Trae un proyecto con contexto/i }, { timeout: 5000 });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Trae un proyecto con contexto/i })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(projectMenuTrigger));
  });

  it('groups document, context, and actions without losing secondary controls', async () => {
    const user = userEvent.setup();
    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);

    expect(container.querySelector('[data-topbar-zone="document"]')).not.toBeNull();
    expect(container.querySelector('[data-topbar-zone="context"]')).not.toBeNull();
    expect(container.querySelector('[data-topbar-zone="actions"]')).not.toBeNull();

    const projectName = screen.getByRole('textbox', { name: 'Nombre del proyecto' });
    expect(projectName.getAttribute('title')).toBe(projectName.getAttribute('value'));

    const moreButton = screen.getByRole('button', { name: 'Más acciones' });
    await user.click(moreButton);

    const dialog = screen.getByRole('dialog', { name: 'Más acciones' });
    expect(within(dialog).getByRole('combobox', { name: 'Unidades' })).toBeTruthy();
    expect(within(dialog).getByRole('combobox', { name: 'Idioma' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Tema oscuro' })).toBeTruthy();
    expect(within(dialog).getByText('Guardado localmente en este navegador.')).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(moreButton));
    expect(moreButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps visual layout commands inside the grouped secondary menu', async () => {
    const user = userEvent.setup();
    const onToggleInspector = vi.fn();
    const onToggleFullCanvas = vi.fn();
    const onToggleToolRail = vi.fn();
    render(<TopBarHarness><TopBar layoutActions={{
      inspectorCollapsed: false,
      fullCanvas: false,
      toolRailCompact: false,
      onToggleInspector,
      onToggleFullCanvas,
      onToggleToolRail,
    }} /></TopBarHarness>);

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    await user.click(screen.getByRole('button', { name: 'Ocultar inspector' }));
    expect(onToggleInspector).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    await user.click(screen.getByRole('button', { name: 'Mesa de trabajo completa' }));
    expect(onToggleFullCanvas).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    await user.click(screen.getByRole('button', { name: 'Contraer herramientas' }));
    expect(onToggleToolRail).toHaveBeenCalledOnce();
  });
});
