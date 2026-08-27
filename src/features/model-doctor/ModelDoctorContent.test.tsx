// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { useProjectModel } from '../../store/ProjectModelContext';
import type { ProjectModel } from '../../types';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';
import { DataSurface } from '../data/DataSurface.tsx';
import { ModelDoctorContent } from './ModelDoctorContent';
import { buildModelDoctorReport } from './modelDoctorDiagnostics';

const withInvalidProperty = (): ProjectModel => {
  const project = createDefaultProject();
  project.members[0] = { ...project.members[0], E: 0 };
  return project;
};

const withWarning = (): ProjectModel => {
  const project = createDefaultProject();
  project.nodes.push({ id: 'N-ISOLATED', x: 20, y: 20, support: { type: 'none' } });
  return project;
};

const withRepairableTopology = (): ProjectModel => {
  const project = createDefaultProject();
  project.nodes.push({ id: 'N-SPLIT', x: 3, y: 4 + 3e-9, support: { type: 'fixed' } });
  project.memberLoads.push({
    id: 'ML-SPLIT', memberId: 'M2', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real',
    start: 0, end: 1, px: 0, py: -5, position: 0.75,
  });
  project.memberInitialEffects = [{ id: 'IE-SPLIT', memberId: 'M2', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 20 }];
  return project;
};

const renderDoctor = (project: ProjectModel, initiallyOpen = true) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  const Harness = () => {
    const [open, setOpen] = useState(initiallyOpen);
    const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set());
    const { project: currentProject, canUndo, canRedo, updateProject, undo, redo } = useProjectModel();
    return <>
      <output aria-label="doctor-project-snapshot">{JSON.stringify(currentProject)}</output>
      <output aria-label="doctor-can-undo">{String(canUndo)}</output>
      <output aria-label="doctor-can-redo">{String(canRedo)}</output>
      <button type="button" onClick={() => setOpen(true)}>Abrir Model Doctor</button>
      <button type="button" onClick={() => updateProject((draft) => ({ ...draft, name: `${draft.name} editado` }))}>Editar proyecto cerrado</button>
      <button type="button" onClick={undo}>Deshacer reparación test</button>
      <button type="button" onClick={redo}>Rehacer reparación test</button>
      {/* La Revisión no monta su propio cromo: lo pone «Datos». Montar la
          superficie entera en su pestaña es lo que hace producción, y es lo
          único que deja probar el cierre, el foco y el `peek` de verdad. */}
      {open ? <DataSurface
        open
        tab="review"
        onTabChange={() => {}}
        onOpenChange={setOpen}
        acknowledgedIds={acknowledgedIds}
        onAcknowledgedIdsChange={setAcknowledgedIds}
      /> : null}
    </>;
  };
  return render(<ProjectProvider><Harness /></ProjectProvider>);
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ModelDoctorContent surface', () => {
  it('shows a useful all-clear state without requiring an analysis result', async () => {
    renderDoctor(createDefaultProject());

    const dialog = await screen.findByRole('dialog', { name: 'Datos' });
    // El cuerpo de la pestaña viaja en su propio chunk: llega diferido dentro
    // de la superficie, así que se espera en vez de darlo por montado.
    expect(await within(dialog).findByText('0 críticos · 0 advertencias · 0 sugerencias')).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: /modelo listo para revisar/i })).toBeTruthy();
  });

  it('shows an evident absence of grounding as a non-repairable critical before analysis', async () => {
    const project = createDefaultProject();
    project.nodes = project.nodes.map((node) => ({ ...node, support: { type: 'none' } }));
    renderDoctor(project);

    const finding = (await screen.findAllByRole('article')).find((article) => article.textContent?.includes('Estructura sin restricciones'))!;
    expect(finding).toBeTruthy();
    expect(finding.getAttribute('aria-labelledby')?.split(/\s+/).map((id) => document.getElementById(id)?.textContent).join(' ')).toMatch(/crítico/i);
    expect(within(finding).queryByRole('button', { name: /previsualizar reparaci/i })).toBeNull();
  });

  it('summarizes severity and filters findings without hiding acknowledged criticals', async () => {
    const user = userEvent.setup();
    renderDoctor(withInvalidProperty());
    const dialog = await screen.findByRole('dialog', { name: 'Datos' });

    expect(within(dialog).getByText(/1 crítico/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: /críticos/i }));
    const finding = within(dialog).getByRole('article');
    expect(finding.getAttribute('aria-labelledby')?.split(/\s+/).every((id) => document.getElementById(id))).toBe(true);
    expect(finding.getAttribute('aria-labelledby')?.split(/\s+/).map((id) => document.getElementById(id)?.textContent).join(' ')).toMatch(/crítico.*módulo elástico/i);
    expect(finding.textContent).toContain('E');
    expect(within(finding).queryByRole('button', { name: /reconocer/i })).toBeNull();
  });

  it('explains what was detected, why it matters, and what to do', async () => {
    const user = userEvent.setup();
    renderDoctor(withInvalidProperty());
    const finding = await screen.findByRole('article');

    const explain = within(finding).getByRole('button', { name: /explicar/i });
    expect(explain.getAttribute('aria-expanded')).toBe('false');
    await user.click(explain);

    expect(explain.getAttribute('aria-expanded')).toBe('true');
    expect(within(finding).getByRole('heading', { name: /por qué importa/i })).toBeTruthy();
    expect(within(finding).getByRole('heading', { name: /acción recomendada/i })).toBeTruthy();
    expect(finding.textContent).toMatch(/rigidez/i);
  });

  it('keeps warning acknowledgement as session-only UI state and leaves the finding visible', async () => {
    const user = userEvent.setup();
    renderDoctor(withWarning());
    const finding = (await screen.findAllByRole('article')).find((article) => article.textContent?.includes('N-ISOLATED'))!;
    const before = screen.getByLabelText('doctor-project-snapshot').textContent;

    await user.click(within(finding).getByRole('button', { name: /reconocer/i }));

    expect(within(finding).getByText(/reconocido para esta sesión/i)).toBeTruthy();
    expect(screen.getAllByText(/N-ISOLATED/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('doctor-project-snapshot').textContent).toBe(before);
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe('false');

    await user.click(screen.getByRole('button', { name: /cerrar datos/i }));
    await user.click(screen.getByRole('button', { name: 'Abrir Model Doctor' }));
    expect(await screen.findByText(/reconocido para esta sesión/i)).toBeTruthy();
  });

  /**
   * La costura `buildReport` es del CUERPO, no del cromo: lo que demuestra es
   * que el diagnóstico no corre mientras la Revisión no está montada. Con la
   * superficie unificada eso sigue valiendo, y gana una garantía nueva: abrir
   * «Datos» en otra pestaña tampoco monta la Revisión, así que tampoco
   * diagnostica.
   */
  it('no diagnostica mientras no está montada, ni con «Datos» abierto en otra pestaña', async () => {
    const buildReport = vi.fn(buildModelDoctorReport);
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(withWarning()));

    const { rerender } = render(<ProjectProvider>
      <DataSurface open tab="results" onTabChange={() => {}} onOpenChange={() => {}} />
    </ProjectProvider>);
    await screen.findByRole('dialog', { name: 'Datos' });
    expect(buildReport).not.toHaveBeenCalled();

    rerender(<ProjectProvider>
      <ModelDoctorContent buildReport={buildReport} />
    </ProjectProvider>);
    await waitFor(() => expect(buildReport.mock.calls.length).toBeGreaterThan(0));
  });

  it('previews every safe topology change without mutating, then applies one undoable intention', async () => {
    const user = userEvent.setup();
    const project = withRepairableTopology();
    renderDoctor(project);
    const original = screen.getByLabelText('doctor-project-snapshot').textContent;
    const finding = (await screen.findAllByRole('article')).find((article) => article.textContent?.includes('N-SPLIT'))!;

    const previewAction = within(finding).getByRole('button', { name: /previsualizar reparaci/i });
    await user.click(previewAction);

    const preview = await screen.findByRole('heading', { name: /revisi.n de la reparaci.n segura/i });
    expect(preview).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('.model-doctor-preview__back')));
    expect(screen.getByText(/M2 se dividir/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /nodos remapeados/i })).toBeTruthy();
    expect(screen.getByText(/y=4\.000000003.*y=4/)).toBeTruthy();
    expect(screen.getByText(/carga de miembro ML-SPLIT/i)).toBeTruthy();
    expect(screen.getByText(/efecto inicial IE-SPLIT/i)).toBeTruthy();
    expect(screen.getByLabelText('doctor-project-snapshot').textContent).toBe(original);
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe('false');

    await user.click(screen.getByRole('button', { name: /aplicar reparaci/i }));

    const appliedStatus = await screen.findByText(/una sola intenci.n reversible/i);
    await waitFor(() => expect(document.activeElement).toBe(appliedStatus));
    const repaired = screen.getByLabelText('doctor-project-snapshot').textContent;
    expect(repaired).not.toBe(original);
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe('true');
    expect(screen.queryByText(/N-SPLIT.*no es una uni.n estructural/i)).toBeNull();

    await user.click(screen.getByText('Deshacer reparación test'));
    expect(screen.getByLabelText('doctor-project-snapshot').textContent).toBe(original);
    expect(screen.getByLabelText('doctor-can-redo').textContent).toBe('true');
    expect((await screen.findAllByRole('article')).some((article) => article.textContent?.includes('N-SPLIT'))).toBe(true);
    await user.click(screen.getByText('Rehacer reparación test'));
    expect(screen.getByLabelText('doctor-project-snapshot').textContent).toBe(repaired);
    await waitFor(() => {
      expect(screen.queryAllByRole('article').some((article) => article.textContent?.includes('N-SPLIT'))).toBe(false);
    });
  });

  it('keeps keyboard focus inside the dialog when preview is opened and returns it to its finding when cancelled', async () => {
    const user = userEvent.setup();
    renderDoctor(withRepairableTopology());
    const finding = (await screen.findAllByRole('article')).find((article) => article.textContent?.includes('N-SPLIT'))!;
    const previewAction = within(finding).getByRole('button', { name: /previsualizar reparaci/i });
    await user.click(previewAction);

    const back = (await screen.findAllByRole('button', { name: /cancelar preview/i }))[0];
    await waitFor(() => expect(document.activeElement).toBe(back));
    await user.click(back);

    const restoredFinding = (await screen.findAllByRole('article')).find((article) => article.textContent?.includes('N-SPLIT'))!;
    const restoredAction = within(restoredFinding).getByRole('button', { name: /previsualizar reparaci/i });
    await waitFor(() => expect(document.activeElement).toBe(restoredAction));
  });

  it('keeps aria reference tokens valid when a diagnostic object id contains spaces', async () => {
    const project = createDefaultProject();
    const previousId = project.members[0].id;
    project.members[0] = { ...project.members[0], id: 'M con espacio', E: 0 };
    project.memberLoads = project.memberLoads.map((load) => load.memberId === previousId ? { ...load, memberId: 'M con espacio' } : load);
    project.memberInitialEffects = (project.memberInitialEffects ?? []).map((effect) => effect.memberId === previousId ? { ...effect, memberId: 'M con espacio' } : effect);
    renderDoctor(project);

    const finding = (await screen.findAllByRole('article')).find((article) => article.textContent?.includes('M con espacio'))!;
    for (const attribute of ['aria-labelledby']) {
      const tokens = finding.getAttribute(attribute)?.split(/\s+/) ?? [];
      expect(tokens).toHaveLength(2);
      expect(tokens.every((token) => document.getElementById(token))).toBe(true);
    }
    const explain = within(finding).getByRole('button', { name: /explicar/i });
    expect(explain.getAttribute('aria-controls')?.includes(' ')).toBe(false);
    expect(document.getElementById(explain.getAttribute('aria-controls')!)).toBeNull();
    await userEvent.setup().click(explain);
    expect(document.getElementById(explain.getAttribute('aria-controls')!)).toBeTruthy();
  });

  it('keeps DOM ids and aria references unique for adversarial diagnostic ids', async () => {
    const project = createDefaultProject();
    project.nodes.push(
      { id: '%', x: 20, y: 20, support: { type: 'none' } },
      { id: '_25', x: 30, y: 20, support: { type: 'none' } },
    );
    renderDoctor(project);

    const findings = (await screen.findAllByRole('article')).filter((article) =>
      article.textContent?.includes('Nodo aislado'));
    const ids = findings.flatMap((finding) => Array.from(finding.querySelectorAll<HTMLElement>('[id]'), (element) => element.id));

    expect(findings).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
    for (const finding of findings) {
      for (const token of finding.getAttribute('aria-labelledby')?.split(/\s+/) ?? []) {
        expect(finding.contains(document.getElementById(token))).toBe(true);
      }
      const explain = within(finding).getByRole('button', { name: /explicar/i });
      expect(ids.filter((id) => id === explain.getAttribute('aria-controls'))).toHaveLength(0);
    }
  });

  it('invalidates a preview after any project change and requires regeneration', async () => {
    const user = userEvent.setup();
    renderDoctor(withRepairableTopology());
    const finding = (await screen.findAllByRole('article')).find((article) => article.textContent?.includes('N-SPLIT'))!;
    await user.click(within(finding).getByRole('button', { name: /previsualizar reparaci/i }));

    await user.click(screen.getByText('Editar proyecto cerrado'));

    expect((await screen.findByRole('alert')).textContent).toMatch(/preview qued. obsoleto/i);
    expect((screen.getByRole('button', { name: /aplicar reparaci/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /regenerar preview/i })).toBeTruthy();
  });

  it('names topology connections that remain unresolved beside other safe preview changes', async () => {
    const user = userEvent.setup();
    const project = withRepairableTopology();
    project.nodes.push({ id: 'OFFSET', x: 0.1, y: 4, support: { type: 'fixed' } });
    project.members[1] = { ...project.members[1], rigidOffsetI: 0.3 };
    renderDoctor(project);
    const repairable = (await screen.findAllByRole('article'))
      .find((article) => article.textContent?.includes('N-SPLIT'))!;

    await user.click(within(repairable).getByRole('button', { name: /previsualizar reparaci/i }));

    const heading = await screen.findByRole('heading', { name: /conexiones que requieren revisi.n manual/i });
    const unresolved = heading.closest('section')!;
    expect(within(unresolved).getByText('OFFSET · M2')).toBeTruthy();
    expect(within(unresolved).getByText(/coincide con el interior de M2/i)).toBeTruthy();
    expect(within(unresolved).getByText(/no se modificar. autom.ticamente/i)).toBeTruthy();
    expect(unresolved.textContent).not.toMatch(/divide M2 en OFFSET/i);
  });

  it('locates a physical target using selection plus focus-object and degrades to peek instead of closing (CRI-102)', async () => {
    const user = userEvent.setup();
    const focusObject = vi.fn();
    const unsubscribe = onWorkspaceCommand('focus-object', focusObject);
    renderDoctor(withInvalidProperty());
    const finding = await screen.findByRole('article');
    const before = screen.getByLabelText('doctor-project-snapshot').textContent;

    await user.click(within(finding).getByRole('button', { name: /localizar/i }));

    await waitFor(() => expect(focusObject).toHaveBeenCalledWith({ kind: 'member', id: 'M1' }));
    expect(screen.getByLabelText('doctor-project-snapshot').textContent).toBe(before);
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe('false');
    // Localizar degrada a peek: la lista de hallazgos nunca se desmonta (D-11).
    expect(screen.getByRole('dialog', { name: 'Datos' })).toBeTruthy();
    expect(await screen.findByRole('article')).toBeTruthy();
    unsubscribe();
  });

  it('keeps a stale repair preview marked as stale across a peek and restores it unchanged (CRI-102 / T-INV-8)', async () => {
    const user = userEvent.setup();
    const project = withRepairableTopology();
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    const PeekHarness = () => {
      const [extent, setExtent] = useState<'default' | 'peek'>('default');
      const { updateProject } = useProjectModel();
      return <>
        <button type="button" onClick={() => updateProject((draft) => ({ ...draft, name: `${draft.name} editado` }))}>Editar proyecto cerrado</button>
        <button type="button" onClick={() => setExtent('peek')}>Simular peek</button>
        <button type="button" onClick={() => setExtent('default')}>Simular restaurar</button>
        {/* El `peek` es del CROMO, y el cromo es ahora `DataSurface`: la
            pestaña Revisión ya no monta su propio Drawer. Por eso esta prueba
            —que es sobre el ciclo peek/restaurar— monta la superficie entera
            en su pestaña, y no sólo el cuerpo. */}
        <DataSurface
          open
          tab="review"
          onTabChange={() => {}}
          onOpenChange={() => {}}
          extent={extent}
          onPeek={() => setExtent('peek')}
          onRestore={() => setExtent('default')}
        />
      </>;
    };
    render(<ProjectProvider><PeekHarness /></ProjectProvider>);
    const repairable = (await screen.findAllByRole('article'))
      .find((article) => article.textContent?.includes('N-SPLIT'))!;
    await user.click(within(repairable).getByRole('button', { name: /previsualizar reparaci/i }));
    await screen.findByRole('heading', { name: /revisi.n de la reparaci.n segura/i });

    await user.click(screen.getByRole('button', { name: 'Editar proyecto cerrado' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/preview qued. obsoleto/i);

    // Degradar a peek no la desmonta: el aviso de stale sigue en el DOM.
    // El Drawer se porta a `document.body`, no al `container` de la prueba.
    await user.click(screen.getByRole('button', { name: 'Simular peek' }));
    await waitFor(() => expect(document.body.querySelector('[data-surface-extent="peek"]')).toBeTruthy());
    const stillMounted = document.body.querySelector('.model-doctor-preview__stale');
    expect(stillMounted?.textContent).toMatch(/preview qued. obsoleto/i);

    // Restaurar recupera exactamente el mismo estado: sigue stale, no se
    // aplicó ni se descartó nada de camino.
    await user.click(screen.getByRole('button', { name: 'Simular restaurar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/preview qued. obsoleto/i);
    expect((screen.getByRole('button', { name: /aplicar reparaci/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('closes with Escape and returns focus to the launcher', async () => {
    const user = userEvent.setup();
    renderDoctor(createDefaultProject(), false);
    const launcher = screen.getByRole('button', { name: 'Abrir Model Doctor' });
    await user.click(launcher);
    await screen.findByRole('dialog', { name: 'Datos' });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Datos' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(launcher));
  });

  it('localizes the surface chrome in English with the project language', async () => {
    const project = createDefaultProject();
    project.settings = { ...project.settings, language: 'en' };
    renderDoctor(project);

    const dialog = await screen.findByRole('dialog', { name: 'Data' });
    expect(await within(dialog).findByText('0 critical · 0 warnings · 0 suggestions')).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: /model ready for review/i })).toBeTruthy();
  });

  it('localizes a real finding, its category, explanation, impact, and actions in English', async () => {
    const project = withInvalidProperty();
    project.settings = { ...project.settings, language: 'en' };
    renderDoctor(project);
    const finding = await screen.findByRole('article');

    await userEvent.setup().click(within(finding).getByRole('button', { name: /explain.*elastic modulus/i }));

    expect(finding.textContent).toContain('properties');
    expect(finding.textContent).toMatch(/elastic modulus/i);
    expect(finding.textContent).toMatch(/stiffness/i);
    expect(finding.textContent).not.toMatch(/módulo|miembro|rigidez|por qué|acción recomendada/i);
  });

  it('gives repeated card actions a finding-specific accessible name and avoids announcing whole lists', async () => {
    renderDoctor(withWarning());
    const finding = await screen.findByRole('article');

    expect(within(finding).getByRole('button', { name: /localizar.*nodo aislado/i })).toBeTruthy();
    expect(within(finding).getByRole('button', { name: /explicar.*nodo aislado/i })).toBeTruthy();
    expect(document.querySelector('.model-doctor-findings')?.hasAttribute('aria-live')).toBe(false);
  });
});
