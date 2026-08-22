// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findStandardSection } from '../../data/standardSections';
import { ProjectProvider } from '../../store/ProjectContext';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import type { MemberModel, ProjectModel } from '../../types';
import { BulkEditInspectorPanel } from './BulkEditInspectorPanel';

afterEach(cleanup);
// El proveedor restaura el último proyecto guardado; sin limpiar, una prueba
// heredaría el modelo que la anterior acabó de editar.
beforeEach(() => localStorage.clear());

const w12x53 = findStandardSection('w12x53')!;
const setup = () => userEvent.setup({ delay: null });

const member = (id: string, overrides: Partial<MemberModel> = {}): MemberModel => ({
  id, i: 'N1', j: 'N2', type: 'frame',
  materialId: 'steel-a992', materialOrigin: 'catalog',
  sectionId: 'w12x26', sectionOrigin: 'catalog',
  E: 200000000, A: 0.004935474, I: 0.0000849112108224,
  ...overrides,
});

/**
 * Monta el panel sobre el proyecto real del store y expone lo que la prueba
 * necesita observar: el modelo publicado y el historial.
 */
const Harness = ({ onReady }: { onReady: (api: ReturnType<typeof useProjectModel>) => void }) => {
  const api = useProjectModel();
  const { selection, setSelection } = useWorkspaceUI();
  onReady(api);
  if (selection?.kind !== 'multi') {
    return <button type="button" onClick={() => setSelection({
      kind: 'multi', nodeIds: [], memberIds: api.project.members.map((item) => item.id),
    })}>seleccionar</button>;
  }
  return <BulkEditInspectorPanel selection={selection} />;
};

const renderPanel = (members: MemberModel[]) => {
  let api!: ReturnType<typeof useProjectModel>;
  render(
    <ProjectProvider>
      <Seed members={members} />
      <Harness onReady={(value) => { api = value; }} />
    </ProjectProvider>,
  );
  return {
    project: () => api.project,
    canUndo: () => api.canUndo,
    undo: () => api.undo(),
    redo: () => api.redo(),
  };
};

/** Sustituye el proyecto por uno controlado antes de editar. */
const Seed = ({ members }: { members: MemberModel[] }) => {
  const { project, replaceProject } = useProjectModel();
  const seeded = project.members.length === members.length
    && project.members.every((item, index) => item.id === members[index].id);
  if (seeded) return null;
  const next: ProjectModel = {
    ...project,
    nodes: [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ],
    members,
    nodalLoads: [],
    memberLoads: [],
    memberInitialEffects: [],
    prescribedDisplacements: [],
  };
  return <button type="button" onClick={() => replaceProject(next)}>sembrar</button>;
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

describe('BulkEditInspectorPanel', () => {
  it('applies one property to every selected member and leaves the rest untouched', async () => {
    const user = setup();
    const harness = renderPanel([
      member('M1', { sectionId: 'ipe-300', materialId: 'steel-a992' }),
      member('M2', { sectionId: 'w12x26', materialId: 'steel-a36' }),
      member('M3', { sectionId: 'ipe-300', materialId: 'steel-a992' }),
    ]);
    await select(user);

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await confirm(user);

    await waitFor(() => expect(harness.project().members[0].sectionId).toBe('w12x53'));
    for (const item of harness.project().members) {
      expect(item.sectionId).toBe('w12x53');
      expect(item.sectionOrigin).toBe('catalog');
      expect(item.A).toBe(w12x53.area);
    }
    // El material era mixto y nadie lo tocó: sobrevive miembro a miembro.
    expect(harness.project().members.map((item) => item.materialId))
      .toEqual(['steel-a992', 'steel-a36', 'steel-a992']);
  });

  it('records the whole bulk edit as a single undo entry', async () => {
    const user = setup();
    const harness = renderPanel([member('M1'), member('M2'), member('M3')]);
    await select(user);

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    await confirm(user);
    await waitFor(() => expect(harness.project().members[0].sectionId).toBe('w12x53'));

    harness.undo();

    await waitFor(() => expect(harness.project().members[0].sectionId).toBe('w12x26'));
    // Un solo Undo restaura los tres. Con una entrada por miembro, este único
    // undo habría devuelto sólo el último y los otros dos seguirían en W12x53.
    expect(harness.project().members.map((item) => item.sectionId))
      .toEqual(['w12x26', 'w12x26', 'w12x26']);

    harness.redo();
    await waitFor(() => expect(harness.project().members[2].sectionId).toBe('w12x53'));
    expect(harness.project().members.map((item) => item.sectionId))
      .toEqual(['w12x53', 'w12x53', 'w12x53']);
  });

  it('does not touch the project while changes are only staged', async () => {
    const user = setup();
    const harness = renderPanel([member('M1'), member('M2')]);
    await select(user);
    const before = JSON.stringify(harness.project());

    await user.selectOptions(screen.getByLabelText('Sección'), 'w12x53');
    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('1 cambio preparado');

    // Preparar no publica: el modelo es byte a byte el mismo, así que no hay
    // nada que persistir ni análisis que invalidar.
    expect(JSON.stringify(harness.project())).toBe(before);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(JSON.stringify(harness.project())).toBe(before);
    expect(screen.getByTestId('bulk-changes-count').textContent).toBe('Ningún cambio preparado');
  });

  it('writes a frame-only property only to the frames of a mixed selection', async () => {
    const user = setup();
    const harness = renderPanel([
      member('M1', { type: 'frame' }),
      member('M2', { type: 'truss' }),
    ]);
    await select(user);

    await user.click(screen.getByRole('button', { name: /Más propiedades/ }));
    const releases = document.querySelector('.bulk-field[data-property="member.releases.iMoment"]') as HTMLElement;
    expect(releases.textContent).toContain('1 de 2 compatibles');
    await user.click(within(releases).getByRole('radio', { name: 'Sí' }));
    await confirm(user);

    await waitFor(() => expect(harness.project().members[0].releases).toEqual({ iMoment: true }));
    expect(harness.project().members[1].releases).toBeUndefined();
  });

  it('warns that applying leaves the current results out of date', async () => {
    const user = setup();
    renderPanel([member('M1'), member('M2')]);
    await select(user);

    expect(screen.getByText(/quedarán desactualizados/)).toBeTruthy();
  });
});
