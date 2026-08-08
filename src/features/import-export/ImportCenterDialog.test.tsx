// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { ImportCenterDialog, type ImportCenterAdapter, type ImportInspection, type ImportOutcome } from './ImportCenterDialog';

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const project = { ...createBlankProject(), name: 'Proyecto importado' };

const inspection: ImportInspection = {
  kind: 'json',
  sourceLabel: 'Proyecto structureCo JSON',
  version: String(project.schemaVersion),
  confidence: 100,
  supported: true,
  summary: 'Proyecto validado.',
  statistics: [{ label: 'Nodos', value: 0 }],
  warnings: [],
  contents: [
    { key: 'geometry', label: 'Geometría y propiedades', detail: '0 nodos', available: true, selectedByDefault: true },
    { key: 'loads', label: 'Cargas y combinaciones', detail: '0 cargas', available: true, selectedByDefault: true },
    { key: 'diagrams', label: 'DCL y diagramas N–V–M', detail: 'No incluidos', available: false },
  ],
  project,
};

const createAdapter = (): ImportCenterAdapter => ({
  inspect: vi.fn().mockResolvedValue(inspection),
  importFile: vi.fn().mockResolvedValue({ project, title: 'Proyecto listo', message: 'Importación terminada.', statistics: inspection.statistics }),
});

const renderInLanguage = (dialog: React.ReactElement, language: 'es' | 'en' = 'es') => {
  const contextProject = createBlankProject();
  contextProject.settings = { ...contextProject.settings, language };
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(contextProject));
  return render(<ProjectProvider>{dialog}</ProjectProvider>);
};

describe('ImportCenterDialog', () => {
  it('localizes active copy, ARIA, steps and destination options in English while preserving project data', async () => {
    const user = userEvent.setup();
    const englishInspection: ImportInspection = {
      ...inspection,
      sourceLabel: 'JSON model',
      summary: 'Model N-07 validated.',
      statistics: [{ label: 'Nodes', value: 0 }],
      contents: [
        { key: 'geometry', label: 'Geometry and properties', detail: '0 nodes', available: true, selectedByDefault: true },
        { key: 'loads', label: 'Loads and combinations', detail: '0 loads', available: true, selectedByDefault: true },
        { key: 'diagrams', label: 'FBD and N–V–M diagrams', detail: 'Not included', available: false },
      ],
    };
    const adapter: ImportCenterAdapter = {
      inspect: vi.fn().mockResolvedValue(englishInspection),
      importFile: vi.fn().mockResolvedValue({ project, statistics: englishInspection.statistics }),
    };
    renderInLanguage(
      <ImportCenterDialog open currentProjectName="Bridge N-07" adapter={adapter} onClose={vi.fn()} onImported={vi.fn()} />,
      'en',
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Import a project with context',
      description: 'Review the file before opening it and decide exactly what to keep.',
    });
    expect(screen.getByRole('button', { name: 'Close import center' })).toBeTruthy();
    const progress = screen.getByRole('navigation', { name: 'Import progress' });
    for (const label of ['File', 'Inspection', 'Content', 'Destination', 'Confirm', 'Result']) {
      expect(progress.textContent).toContain(label);
    }
    expect(screen.getByRole('heading', { name: 'Select the project package' })).toBeTruthy();
    const chooseFile = screen.getByRole('button', { name: 'Choose file' });
    expect(chooseFile).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(chooseFile));
    expect(screen.getByLabelText('Select file to import')).toBeTruthy();
    expect(screen.getByLabelText('Supported formats')).toBeTruthy();

    await user.upload(screen.getByLabelText('Select file to import'), new File(['{}'], 'bridge-N-07.json', { type: 'application/json' }));
    expect(await screen.findByRole('heading', { name: 'Content found' })).toBeTruthy();
    expect(dialog.textContent).toContain('bridge-N-07.json');
    expect(dialog.textContent).toContain('100% confidence');
    expect(screen.getByRole('group', { name: 'Select the content you want to import' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Where do you want to open it?' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Import destination' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Open as a new project/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Replace the current project/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Merge with the current project/ })).toBeTruthy();
    expect(dialog.textContent).toContain('Bridge N-07');

    await user.click(screen.getByRole('button', { name: 'Review import' }));
    const confirmation = screen.getByRole('region', { name: 'Confirm the import' });
    expect(within(confirmation).getByText('Destination')).toBeTruthy();
    expect(within(confirmation).getByText('New project')).toBeTruthy();
    expect(within(confirmation).getByText('Previous copy')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Import now' }));
    expect(await screen.findByRole('heading', { name: 'Import completed' })).toBeTruthy();
    expect(screen.getByText('The content is ready to open in the editor.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open project' })).toBeTruthy();
  });

  it('localizes the built-in JSON adapter in English while preserving the imported project name', async () => {
    const user = userEvent.setup();
    const importedProject = { ...createBlankProject(), name: 'Puente N-07' };
    renderInLanguage(
      <ImportCenterDialog open currentProjectName="Bridge N-01" onClose={vi.fn()} onImported={vi.fn()} />,
      'en',
    );

    await user.upload(
      screen.getByLabelText('Select file to import'),
      new File([JSON.stringify(importedProject)], 'puente-N-07.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('heading', { name: 'Content found' })).toBeTruthy();
    expect(screen.getByText(/structureCo JSON project/)).toBeTruthy();
    expect(screen.getByText('Project “Puente N-07” validated and ready to import.')).toBeTruthy();
    expect(screen.getByText('Geometry and properties')).toBeTruthy();
    expect(screen.getByText('The project has no nodes.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Review import' }));
    await user.click(screen.getByRole('button', { name: 'Import now' }));
    expect(await screen.findByRole('heading', { name: 'Project ready' })).toBeTruthy();
    expect(screen.getByText('The import finished without changing the original file.')).toBeTruthy();
  });

  it('localizes generic inspection and import errors in English without replacing adapter messages', async () => {
    const user = userEvent.setup();
    const inspectAdapter: ImportCenterAdapter = {
      inspect: vi.fn().mockRejectedValue(null),
      importFile: vi.fn(),
    };
    const { rerender } = renderInLanguage(
      <ImportCenterDialog open currentProjectName="Bridge N-07" adapter={inspectAdapter} onClose={vi.fn()} onImported={vi.fn()} />,
      'en',
    );

    await user.upload(screen.getByLabelText('Select file to import'), new File(['broken'], 'broken.json', { type: 'application/json' }));
    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't inspect the file.");
    expect(screen.getByRole('alert').textContent).toContain("We couldn't continue");

    const importAdapter: ImportCenterAdapter = {
      inspect: vi.fn().mockResolvedValue({
        ...inspection,
        sourceLabel: 'JSON model',
        summary: 'Validated model.',
        contents: [{ key: 'geometry', label: 'Geometry', detail: '0 nodes', available: true, selectedByDefault: true }],
      }),
      importFile: vi.fn().mockRejectedValue(null),
    };
    rerender(
      <ProjectProvider>
        <ImportCenterDialog open currentProjectName="Bridge N-07" adapter={importAdapter} onClose={vi.fn()} onImported={vi.fn()} />
      </ProjectProvider>,
    );
    await user.upload(screen.getByLabelText('Select file to import'), new File(['{}'], 'bridge.json', { type: 'application/json' }));
    await screen.findByRole('heading', { name: 'Content found' });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Review import' }));
    await user.click(screen.getByRole('button', { name: 'Import now' }));

    expect((await screen.findByRole('alert')).textContent).toContain("The import couldn't be completed.");
  });

  it('keeps focus inside the modal through every import stage transition', async () => {
    const user = userEvent.setup();
    const adapter: ImportCenterAdapter = {
      inspect: vi.fn().mockResolvedValue({
        ...inspection,
        sourceLabel: 'JSON model',
        summary: 'Validated model.',
        contents: [{ key: 'geometry', label: 'Geometry', detail: '0 nodes', available: true, selectedByDefault: true }],
      }),
      importFile: vi.fn().mockResolvedValue({ project }),
    };
    renderInLanguage(
      <ImportCenterDialog open currentProjectName="Bridge N-07" adapter={adapter} onClose={vi.fn()} onImported={vi.fn()} />,
      'en',
    );
    const dialog = screen.getByRole('dialog');

    await user.upload(screen.getByLabelText('Select file to import'), new File(['{}'], 'bridge.json', { type: 'application/json' }));
    const contentHeading = await screen.findByRole('heading', { name: 'Content found' });
    await waitFor(() => expect(document.activeElement).toBe(contentHeading));
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const destinationHeading = screen.getByRole('heading', { name: 'Where do you want to open it?' });
    await waitFor(() => expect(document.activeElement).toBe(destinationHeading));
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Review import' }));
    const confirmHeading = screen.getByRole('heading', { name: 'Confirm the import' });
    await waitFor(() => expect(document.activeElement).toBe(confirmHeading));
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Import now' }));
    const resultHeading = await screen.findByRole('heading', { name: 'Import completed' });
    await waitFor(() => expect(document.activeElement).toBe(resultHeading));
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('keeps the visually hidden file input out of the keyboard focus loop', async () => {
    const user = userEvent.setup();
    renderInLanguage(<ImportCenterDialog open currentProjectName="Actual" adapter={createAdapter()} onClose={vi.fn()} onImported={vi.fn()} />);

    const chooseFile = screen.getByRole('button', { name: /elegir archivo/i });
    const fileInput = screen.getByLabelText(/seleccionar archivo para importar/i) as HTMLInputElement;
    expect(fileInput.tabIndex).toBe(-1);
    chooseFile.focus();
    await user.tab();

    expect(document.activeElement).not.toBe(fileInput);
  });

  it('uses roving keyboard focus for the import destination radios', async () => {
    const user = userEvent.setup();
    renderInLanguage(<ImportCenterDialog open currentProjectName="Actual" adapter={createAdapter()} onClose={vi.fn()} onImported={vi.fn()} />);

    await user.upload(screen.getByLabelText(/seleccionar archivo para importar/i), new File(['{}'], 'modelo.json', { type: 'application/json' }));
    await screen.findByRole('heading', { name: /contenido encontrado/i });
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    const createNew = screen.getByRole('radio', { name: /abrir como proyecto nuevo/i });
    const replace = screen.getByRole('radio', { name: /reemplazar el proyecto actual/i });
    expect(createNew.tabIndex).toBe(0);
    expect(replace.tabIndex).toBe(-1);

    createNew.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(replace);
    expect(replace.getAttribute('aria-checked')).toBe('true');
    expect(replace.tabIndex).toBe(0);

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(createNew);
    expect(createNew.getAttribute('aria-checked')).toBe('true');
  });

  it('inspects, reviews and imports a file without browser alerts', async () => {
    const user = userEvent.setup();
    const adapter = createAdapter();
    const onImported = vi.fn();
    renderInLanguage(
      <ImportCenterDialog
        open
        currentProjectName="Proyecto actual"
        adapter={adapter}
        onClose={vi.fn()}
        onImported={onImported}
      />,
    );

    const file = new File(['{}'], 'modelo.structureco.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/seleccionar archivo para importar/i), file);

    expect(await screen.findByRole('heading', { name: /contenido encontrado/i })).toBeTruthy();
    expect(screen.getByText('modelo.structureco.json')).toBeTruthy();
    expect(screen.getByText(/100% confianza/i)).toBeTruthy();
    expect((screen.getByLabelText(/DCL y diagramas N–V–M/i) as HTMLInputElement).disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByRole('radiogroup', { name: /destino de la importación/i })).toBeTruthy();
    expect((screen.getByRole('radio', { name: /combinar con el proyecto actual/i }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: /revisar importación/i }));
    expect(screen.getByRole('heading', { name: /confirma la importación/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /importar ahora/i }));

    expect(await screen.findByRole('heading', { name: /proyecto listo/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /abrir proyecto/i }));
    expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ project }));
    expect(adapter.importFile).toHaveBeenCalledWith(file, inspection, expect.objectContaining({ mode: 'new', content: ['geometry', 'loads'] }));
  });

  it('supports drag and drop and reports inspection errors in the dialog', async () => {
    const adapter: ImportCenterAdapter = {
      inspect: vi.fn().mockRejectedValue(new Error('El archivo está dañado.')),
      importFile: vi.fn(),
    };
    const { container } = renderInLanguage(
      <ImportCenterDialog open currentProjectName="Actual" adapter={adapter} onClose={vi.fn()} onImported={vi.fn()} />,
    );
    const file = new File(['broken'], 'modelo.json', { type: 'application/json' });
    fireEvent.drop(container.querySelector('.import-dropzone')!, { dataTransfer: { files: [file] } });

    expect((await screen.findByRole('alert')).textContent).toContain('El archivo está dañado.');
    expect(screen.getByRole('heading', { name: /selecciona el expediente/i })).toBeTruthy();
  });

  it('lets the user cancel a slow inspection instead of being stuck with no way back', async () => {
    // §19 requires "Permite cancelar operaciones pesadas" — before this fix the back/cancel
    // button was unconditionally disabled while stage === 'inspect', so a large PDF or
    // .structureco (near the 25/40 MB budgets from S09) left the user with no way out.
    const user = userEvent.setup();
    let resolveInspect!: (value: ImportInspection) => void;
    const adapter: ImportCenterAdapter = {
      inspect: vi.fn(() => new Promise<ImportInspection>((resolve) => { resolveInspect = resolve; })),
      importFile: vi.fn(),
    };
    renderInLanguage(
      <ImportCenterDialog open currentProjectName="Actual" adapter={adapter} onClose={vi.fn()} onImported={vi.fn()} />,
    );

    await user.upload(screen.getByLabelText(/seleccionar archivo para importar/i), new File(['{}'], 'grande.structureco', { type: 'application/json' }));
    const heading = await screen.findByRole('heading', { name: /inspeccionando el archivo/i });
    expect(heading).toBeTruthy();

    const cancelButton = screen.getByRole('button', { name: /cancelar/i }) as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(false);
    await user.click(cancelButton);

    expect(await screen.findByRole('heading', { name: /selecciona el expediente/i })).toBeTruthy();

    // The abandoned inspection must not resurrect once it finally resolves.
    resolveInspect(inspection);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole('heading', { name: /selecciona el expediente/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /contenido encontrado/i })).toBeNull();
  });

  it('shows distinct copy for inspecting vs. committing, and disables cancel once committing', async () => {
    // Before this fix `outcome` (only ever set at the very end of the commit) gated the
    // loading copy, so "Preparando el resultado…" was unreachable dead code: users saw
    // "Inspeccionando el archivo…" even while the import was actually being written.
    const user = userEvent.setup();
    let resolveImport!: (value: ImportOutcome) => void;
    const adapter: ImportCenterAdapter = {
      inspect: vi.fn().mockResolvedValue(inspection),
      importFile: vi.fn(() => new Promise<ImportOutcome>((resolve) => { resolveImport = resolve; })),
    };
    renderInLanguage(
      <ImportCenterDialog open currentProjectName="Actual" adapter={adapter} onClose={vi.fn()} onImported={vi.fn()} />,
    );

    await user.upload(screen.getByLabelText(/seleccionar archivo para importar/i), new File(['{}'], 'modelo.json', { type: 'application/json' }));
    await screen.findByRole('heading', { name: /contenido encontrado/i });
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /revisar importación/i }));
    await user.click(screen.getByRole('button', { name: /importar ahora/i }));

    expect(await screen.findByRole('heading', { name: /preparando el resultado/i })).toBeTruthy();
    // Committing must not be cancellable: walking away here could leave the project
    // half-replaced.
    const backButton = screen.getByRole('button', { name: /atrás/i }) as HTMLButtonElement;
    expect(backButton.disabled).toBe(true);

    resolveImport({ project });
    expect(await screen.findByRole('heading', { name: /completada|listo/i })).toBeTruthy();
  });

  it('requires explicit confirmation before saving and replacing the current project', async () => {
    const user = userEvent.setup();
    const adapter = createAdapter();
    const onSaveCurrent = vi.fn();
    renderInLanguage(
      <ImportCenterDialog
        open
        currentProjectName="Proyecto actual"
        adapter={adapter}
        onClose={vi.fn()}
        onImported={vi.fn()}
        onSaveCurrent={onSaveCurrent}
      />,
    );
    await user.upload(screen.getByLabelText(/seleccionar archivo para importar/i), new File(['{}'], 'modelo.json', { type: 'application/json' }));
    await screen.findByRole('heading', { name: /contenido encontrado/i });
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('radio', { name: /reemplazar el proyecto actual/i }));
    expect((screen.getByRole('checkbox', { name: /descargar una copia antes de reemplazar/i }) as HTMLInputElement).checked).toBe(true);
    expect(onSaveCurrent).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /revisar importación/i }));
    await user.click(screen.getByRole('button', { name: /importar ahora/i }));
    await waitFor(() => expect(onSaveCurrent).toHaveBeenCalledOnce());
    expect(adapter.importFile).toHaveBeenCalledWith(expect.any(File), inspection, expect.objectContaining({ mode: 'replace', saveCurrent: true }));
  });
});
