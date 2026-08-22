// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import type { ProjectModel } from '../../types';
import { BulkEditInspectorPanel } from './BulkEditInspectorPanel';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const setup = () => userEvent.setup({ delay: null });

/**
 * Aplicación real de una edición múltiple que **sólo** toca cargas.
 *
 * Es el caso que ninguna prueba cubría: los miembros y los nudos no cambian, de
 * modo que un guardia que sólo mire sus grupos descarta la operación entera y el
 * usuario ve el panel aceptar la confirmación sin que nada ocurra.
 */
const Harness = ({ onReady }: { onReady: (api: ReturnType<typeof useProjectModel>) => void }) => {
  const api = useProjectModel();
  const { selection, setSelection } = useWorkspaceUI();
  onReady(api);
  if (selection?.kind !== 'multi') {
    return <button type="button" onClick={() => setSelection({
      kind: 'multi', nodeIds: api.project.nodes.map((item) => item.id), memberIds: [],
    })}>seleccionar</button>;
  }
  return <BulkEditInspectorPanel selection={selection} />;
};

const Seed = () => {
  const { project, replaceProject } = useProjectModel();
  if (project.nodalLoads.length === 2 && project.nodes.length === 2) return null;
  const next: ProjectModel = {
    ...project,
    nodes: [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 4, y: 0, support: { type: 'pin' } },
    ],
    members: [],
    nodalLoads: [
      { id: 'L1', nodeId: 'N1', caseId: project.loadCases[0].id, fx: 0, fy: -10, mz: 0 },
      { id: 'L2', nodeId: 'N2', caseId: project.loadCases[0].id, fx: 0, fy: -25, mz: 0 },
    ],
    memberLoads: [],
    memberInitialEffects: [],
    prescribedDisplacements: [],
  };
  return <button type="button" onClick={() => replaceProject(next)}>sembrar</button>;
};

const renderPanel = () => {
  let api!: ReturnType<typeof useProjectModel>;
  render(
    <ProjectProvider>
      <Seed />
      <Harness onReady={(value) => { api = value; }} />
    </ProjectProvider>,
  );
  return { project: () => api.project, undo: () => api.undo(), redo: () => api.redo() };
};

/** Prepara → revisa → confirma: aplicar exige pasar por la revisión. */
const confirm = async (user: ReturnType<typeof setup>) => {
  await user.click(screen.getByRole('button', { name: /^Revisar cambios/ }));
  const review = screen.getByRole('region', { name: 'Revisar cambios' });
  await user.click(within(review).getByRole('button', { name: /^Aplicar/ }));
};

const select = async (user: ReturnType<typeof setup>) => {
  await user.click(screen.getByRole('button', { name: 'sembrar' }));
  await user.click(screen.getByRole('button', { name: 'seleccionar' }));
};

const field = (property: string) =>
  document.querySelector(`.bulk-field[data-property="${property}"]`) as HTMLElement;

describe('BulkEditInspectorPanel · loads', () => {
  it('applies a loads-only bulk edit instead of silently dropping it', async () => {
    const user = setup();
    const harness = renderPanel();
    await select(user);

    const fy = field('nodalLoad.fy').querySelector('input') as HTMLInputElement;
    await user.clear(fy);
    await user.type(fy, '-30');
    await user.tab();

    await confirm(user);

    await waitFor(() => expect(harness.project().nodalLoads[0].fy).toBe(-30));
    expect(harness.project().nodalLoads.map((load) => load.fy)).toEqual([-30, -30]);
  });

  it('keeps a loads-only bulk edit as a single undo entry', async () => {
    const user = setup();
    const harness = renderPanel();
    await select(user);

    const fy = field('nodalLoad.fy').querySelector('input') as HTMLInputElement;
    await user.clear(fy);
    await user.type(fy, '-30');
    await user.tab();
    await confirm(user);
    await waitFor(() => expect(harness.project().nodalLoads[0].fy).toBe(-30));

    harness.undo();
    await waitFor(() => expect(harness.project().nodalLoads[0].fy).toBe(-10));
    expect(harness.project().nodalLoads.map((load) => load.fy)).toEqual([-10, -25]);

    harness.redo();
    await waitFor(() => expect(harness.project().nodalLoads[1].fy).toBe(-30));
    expect(harness.project().nodalLoads.map((load) => load.fy)).toEqual([-30, -30]);
  });

  it('never reports a negative incompatible count when loads hang from the selection', async () => {
    const user = setup();
    renderPanel();
    await select(user);

    const summary = document.querySelector('.bulk-summary') as HTMLElement;
    expect(summary.textContent).not.toMatch(/-\d/);
  });
});
