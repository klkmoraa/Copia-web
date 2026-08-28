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

// PDF.js no pinta en jsdom y no es lo que estas pruebas comprueban: aquí interesa que el
// PDF se enseñe antes de bajar y que sea el pie del diálogo quien lo entregue.
vi.mock('../import-export/pdfPageRenderer', () => ({
  openPreviewDocument: vi.fn().mockResolvedValue({
    pageCount: 3,
    renderPage: vi.fn().mockResolvedValue(undefined),
    aspectRatio: vi.fn().mockResolvedValue(1.414),
    destroy: vi.fn(),
  }),
}));

/** Abre el menú de exportación, pide el PDF y devuelve el botón de descarga del diálogo. */
const openPdfPreview = async (user: ReturnType<typeof userEvent.setup>, labels: { menu: string; pdf: string; download: string }) => {
  await user.click(screen.getByRole('button', { name: labels.menu }));
  await user.click(screen.getByRole('button', { name: labels.pdf }));
  return screen.findByRole('button', { name: new RegExp(labels.download, 'i') });
};

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
  it('opens Space 3D from the workspace top bar', async () => {
    const user = userEvent.setup();
    const onOpenSpace3D = vi.fn();
    render(<TopBarHarness><TopBar onOpenSpace3D={onOpenSpace3D} /></TopBarHarness>);

    await user.click(screen.getByRole('button', { name: /abrir space 3d/i }));

    expect(onOpenSpace3D).toHaveBeenCalledOnce();
  });

  it('renders document identity, global action, and status as the only three top bar zones (CRI-95)', () => {
    render(<TopBarHarness><TopBar onOpenSpace3D={() => {}} /></TopBarHarness>);
    const bar = document.querySelector('.topbar')!;
    const zones = [...bar.querySelectorAll('[data-topbar-zone]')].map((zone) => zone.getAttribute('data-topbar-zone'));
    expect(zones).toEqual(['document', 'actions', 'status']);
    const statusStyles = getComputedStyle(bar.querySelector('[data-topbar-zone="status"]')!);
    expect(statusStyles.minWidth).not.toBe('0px');
    expect(bar.querySelector('[data-topbar-cluster="document"]')).not.toBeNull();
    // El contexto de análisis (D-09) viaja dentro de `actions`, no como zona propia.
    expect(bar.querySelector('[data-topbar-zone="actions"] [data-topbar-cluster="context"]')).not.toBeNull();
    expect(bar.querySelector('[data-topbar-zone="actions"] [data-topbar-cluster="actions"]')).not.toBeNull();
    expect(bar.querySelector('[data-topbar-zone="status"]')).not.toBeNull();
    // Las cuatro decisiones ya no son cuatro campos rotulados en la barra: son
    // UN ítem que las abre. La barra unificada del sistema no apila etiqueta
    // sobre control, y apilarlas cuatro veces es lo que recortaba «Caso o
    // com…» a 1280px. Lo que se cuenta aquí es que la barra publica un solo
    // ítem de contexto; que detrás siguen estando las cuatro lo comprueba la
    // prueba de abajo.
    expect(bar.querySelectorAll('[data-context-control]')).toHaveLength(0);
    expect(bar.querySelectorAll('.topbar-context-button')).toHaveLength(1);
  });

  /**
   * La red que impide que la consolidación pierda una decisión por el camino:
   * el ítem de la barra tiene que abrir las CUATRO, con sus nombres accesibles
   * intactos, y el rótulo del propio ítem tiene que ser el caso activo — no la
   * palabra «Análisis», que no dice en qué estado está el modelo.
   */
  it('opens the four analysis decisions from a single unified-toolbar item', async () => {
    const user = userEvent.setup();
    render(<TopBarHarness><TopBar /></TopBarHarness>);
    const bar = document.querySelector('.topbar')!;

    const trigger = within(bar as HTMLElement).getByRole('button', { name: 'Análisis' });
    expect(trigger.textContent).toContain('Casos activos');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await user.click(trigger);
    const popover = await screen.findByRole('dialog', { name: 'Análisis' });
    // El proyecto por defecto es un pórtico, y ahí aplican tanto el método matricial como el
    // del Portal: el selector aparece, con cinco controles en total. La prueba de abajo cubre
    // la viga, donde en cambio es la doble integración la que se ofrece junto al matricial.
    expect(popover.querySelectorAll('[data-context-control]')).toHaveLength(5);
    expect(within(popover).getByRole('combobox', { name: 'Método' })).toBeTruthy();
    expect(within(popover).getByRole('combobox', { name: 'Caso o combinación' })).toBeTruthy();
    expect(within(popover).getByRole('combobox', { name: 'Modo de cálculo' })).toBeTruthy();
    expect(within(popover).getByRole('combobox', { name: 'Orden del análisis' })).toBeTruthy();
    expect(within(popover).getByRole('combobox', { name: 'Unidades' })).toBeTruthy();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Análisis' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('ofrece el método de resolución sólo donde aplica, y lo guarda en el proyecto', async () => {
    const user = userEvent.setup();
    const beam = createDefaultProject();
    // Una viga recta: aquí la doble integración sí significa algo, y el selector aparece.
    beam.nodes = [
      { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    beam.members = [{ id: 'AB', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
    beam.memberLoads = [];
    beam.nodalLoads = [];
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(beam));
    render(<TopBarHarness><TopBar /></TopBarHarness>);

    const bar = document.querySelector('.topbar')!;
    await user.click(within(bar as HTMLElement).getByRole('button', { name: 'Análisis' }));
    const popover = await screen.findByRole('dialog', { name: 'Análisis' });
    expect(popover.querySelectorAll('[data-context-control]')).toHaveLength(5);

    const select = within(popover).getByRole('combobox', { name: 'Método' }) as HTMLSelectElement;
    expect([...select.options].map((option) => option.value))
      .toEqual(['matrix-stiffness', 'double-integration', 'conjugate-beam']);

    await user.selectOptions(select, 'double-integration');
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(PROJECT_STORAGE_KEY) ?? '{}');
      expect(stored.settings?.solutionMethod).toBe('double-integration');
    });
  });

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
    const download = await openPdfPreview(user, { menu: 'More actions', pdf: 'Complete reimportable PDF', download: 'Download' });
    expect(screen.getByText('Calculation report preview')).toBeTruthy();
    // Enseñar no es entregar: hasta que alguien pulsa Descargar no sale ningún archivo.
    expect(portableMocks.shareOrDownloadPortableBytes).not.toHaveBeenCalled();
    await user.click(download);
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

    // El fallo ocurre al componer, así que lo reporta el diálogo — y en el idioma del
    // proyecto, nunca con el texto de primera parte que venga en el Error.
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

    const download = await openPdfPreview(user, { menu: 'Más acciones', pdf: 'PDF completo reimportable', download: 'Descargar' });

    await waitFor(() => expect(portableMocks.createCalculationReport).toHaveBeenCalledOnce());
    const [, generatedAnalysis] = portableMocks.createCalculationReport.mock.calls[0];
    expect(generatedAnalysis.success).toBe(true);
    await user.click(download);
    await waitFor(() => expect(portableMocks.shareOrDownloadPortableBytes).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      'memoria-structureco.pdf',
      'application/pdf',
      expect.stringContaining('memoria de cálculo'),
    ));
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
  it('places Model Doctor and Estado in the protected status zone and opens the Doctor directly', async () => {
    const user = userEvent.setup();
    const openDoctor = vi.fn();
    const unsubscribe = onWorkspaceCommand('open-data', (request) => { if (request?.tab === 'review') openDoctor(); });
    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);

    const status = container.querySelector<HTMLElement>('[data-topbar-zone="status"]')!;
    const doctor = within(status).getByRole('button', { name: 'Model Doctor' });
    expect(doctor.classList.contains('topbar-command-button')).toBe(true);
    expect(within(status).queryByRole('button', { name: /paleta de comandos/i })).toBeNull();
    // Estado (AnalysisStatus) vive en la misma zona protegida que Doctor: los
    // dos son la afirmación más crítica del producto y nunca degradan (CRI-95).
    expect(within(status).getByText('Listo para analizar')).toBeTruthy();
    await user.click(doctor);

    expect(openDoctor).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('announces local-first and offline states through a single accessible live region', async () => {
    const user = userEvent.setup();
    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);
    const chip = container.querySelector<HTMLElement>('.topbar-status-zone .autosave-state')!;

    expect(chip.dataset.storageState).toBe('local');
    expect(chip.textContent).toContain('Local');
    expect(chip.querySelector('svg')).not.toBeNull();
    expect(chip.getAttribute('aria-live')).toBe('polite');
    // La descripción completa ("Guardado localmente...") sobrevive al
    // icono-only de Compact porque no depende de un `title` ni desaparece con
    // la etiqueta corta (GAP-1 · D-14 · CRI-95).
    expect(chip.querySelector('.sr-only')?.textContent).toContain('Guardado localmente');

    // El duplicado del menú de desbordamiento no repite el `aria-live`: una
    // sola región lo anuncia (evita la doble locución del riesgo declarado).
    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    const overflowMirror = container.querySelector<HTMLElement>('.mobile-storage-state');
    expect(overflowMirror?.getAttribute('aria-live')).toBeNull();
    expect(overflowMirror?.textContent).toContain('Local');
    await user.keyboard('{Escape}');

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));

    await waitFor(() => expect(chip.dataset.storageState).toBe('offline'));
    expect(chip.textContent).toContain('Sin conexión');
    expect(chip.getAttribute('aria-live')).toBe('polite');
    expect(chip.querySelector('.sr-only')?.textContent).toContain('Puedes seguir trabajando');
  });

  it('distinguishes a load failure from a save failure', async () => {
    localStorage.setItem(PROJECT_STORAGE_KEY, '{invalid');
    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);
    const chip = container.querySelector<HTMLElement>('.topbar-status-zone .autosave-state')!;

    expect(chip.dataset.storageState).toBe('load-error');
    expect(chip.textContent).toContain('Error al cargar');
    expect(chip.querySelector('.sr-only')?.textContent).toContain('No se pudo abrir la copia local');
  });

  it('prioritizes the actionable offline state over a recovered backup notice', async () => {
    localStorage.setItem(PROJECT_BACKUP_KEY, JSON.stringify(createDefaultProject()));
    localStorage.setItem(PROJECT_STORAGE_KEY, '{invalid');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });

    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);
    const chip = container.querySelector<HTMLElement>('.topbar-status-zone .autosave-state')!;

    expect(chip.dataset.storageState).toBe('offline');
    expect(chip.textContent).toMatch(/Sin conexi/);
  });

  it('keeps a local-load error visible when the browser is also offline', async () => {
    localStorage.setItem(PROJECT_STORAGE_KEY, '{invalid');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });

    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);
    const chip = container.querySelector<HTMLElement>('.topbar-status-zone .autosave-state')!;

    expect(chip.dataset.storageState).toBe('load-error');
    expect(chip.textContent).toContain('Error al cargar');
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

  it('groups document, action, and status without losing secondary controls', async () => {
    const user = userEvent.setup();
    const { container } = render(<TopBarHarness><TopBar /></TopBarHarness>);

    expect(container.querySelector('[data-topbar-zone="document"]')).not.toBeNull();
    expect(container.querySelector('[data-topbar-zone="actions"]')).not.toBeNull();
    expect(container.querySelector('[data-topbar-zone="status"]')).not.toBeNull();

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
    render(<TopBarHarness><TopBar layoutActions={{
      inspectorCollapsed: false,
      fullCanvas: false,
      onToggleInspector,
      onToggleFullCanvas,
    }} /></TopBarHarness>);

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    await user.click(screen.getByRole('button', { name: 'Ocultar inspector' }));
    expect(onToggleInspector).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    await user.click(screen.getByRole('button', { name: 'Mesa de trabajo completa' }));
    expect(onToggleFullCanvas).toHaveBeenCalledOnce();

    // La compacidad del riel dejó de ser una intención del usuario (CRI-89): la
    // decide la clase de composición, así que su conmutador ya no existe.
    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(screen.queryByRole('button', { name: 'Contraer herramientas' })).toBeNull();
  });
});
