// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { translatePhase2 } from '../../i18n/phase2Catalogs';
import { InMemoryProjectRepository, type StoredProjectRecord } from '../../storage/projectRepository';
import { listNamedVersions } from '../../storage/projectVersions';
import type { ProjectModel } from '../../types';
import { ProjectVersions } from './ProjectVersions';

afterEach(cleanup);

const t = (key: Parameters<typeof translatePhase2>[1], variables?: Record<string, string | number>) =>
  translatePhase2('es', key, variables);

/* `createDefaultProject` trae cargas que apuntan a sus propios nudos, y la
   normalización rechaza una carga huérfana. Este modelo reemplaza la geometría,
   así que reemplaza también lo que colgaba de ella. */
const baseProject = (): ProjectModel => ({
  ...createDefaultProject(),
  id: 'P1',
  name: 'Pórtico',
  nodalLoads: [],
  memberLoads: [],
  prescribedDisplacements: [],
  memberInitialEffects: [],
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'N2', x: 4, y: 0, support: { type: 'roller' } },
  ],
  members: [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 2e8, A: 0.01, I: 1e-4 }],
});

const setup = async (project: ProjectModel = baseProject()) => {
  const repository = new InMemoryProjectRepository();
  const record = await repository.saveProject(project);
  return { repository, record };
};

const renderPanel = (
  repository: InMemoryProjectRepository,
  record: StoredProjectRecord,
  overrides: { onRestored?: (record: StoredProjectRecord) => void; onChanged?: () => void } = {},
) => render(<ProjectVersions
  repository={repository}
  record={record}
  t={t}
  formatDate={(iso) => iso}
  onRestored={overrides.onRestored ?? (() => undefined)}
  onChanged={overrides.onChanged ?? (() => undefined)}
/>);

const saveVersion = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.clear(screen.getByLabelText('Nombre de la versión'));
  await user.type(screen.getByLabelText('Nombre de la versión'), label);
  await user.click(screen.getByRole('button', { name: /Guardar versión/ }));
};

describe('guardar una versión', () => {
  it('exige un nombre y no escribe nada sin él', async () => {
    const user = userEvent.setup();
    const { repository, record } = await setup();
    renderPanel(repository, record);

    await user.click(screen.getByRole('button', { name: /Guardar versión/ }));

    expect(screen.getByRole('alert').textContent).toContain('necesita un nombre');
    expect(await listNamedVersions(repository, 'P1')).toHaveLength(0);
  });

  it('guarda el estado que la biblioteca tiene, con su nombre', async () => {
    const user = userEvent.setup();
    const { repository, record } = await setup();
    renderPanel(repository, record);
    await saveVersion(user, 'Antes de subir las cargas');

    await waitFor(async () => {
      expect((await listNamedVersions(repository, 'P1')).map((version) => version.label))
        .toEqual(['Antes de subir las cargas']);
    });
    expect(screen.getByText('Antes de subir las cargas')).toBeTruthy();
  });
});

describe('el diff contra el estado actual', () => {
  it('no inventa diferencias cuando nada cambió', async () => {
    const user = userEvent.setup();
    const { repository, record } = await setup();
    renderPanel(repository, record);
    await saveVersion(user, 'Punto de partida');

    // Guardar selecciona la versión recién creada: el diff se pinta sin más clics.
    await waitFor(() => expect(screen.getByText(/No hay ninguna diferencia/)).toBeTruthy());
  });

  it('nombra el objeto que cambió y sus valores de antes y después', async () => {
    const user = userEvent.setup();
    const { repository, record } = await setup();
    const { unmount } = renderPanel(repository, record);
    await saveVersion(user, 'Antes de mover N2');
    await waitFor(() => expect(screen.getByText('Antes de mover N2')).toBeTruthy());
    unmount();

    const moved = await repository.saveProject({
      ...baseProject(),
      nodes: [
        { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'N2', x: 6, y: 0, support: { type: 'roller' } },
      ],
    }, record.revision);
    renderPanel(repository, moved);
    await user.click(await screen.findByRole('button', { name: /^Antes de mover N2/ }));

    expect(screen.getByText('Modificaciones: 1')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Nudos' })).toBeTruthy();
    expect(screen.getByText(/x: 4 → 6/)).toBeTruthy();
  });

  it('dice cuántos cambios deja fuera en vez de cortar en silencio', async () => {
    const user = userEvent.setup();
    const many: ProjectModel = {
      ...baseProject(),
      nodes: Array.from({ length: 60 }, (_, index) => ({
        id: `N${index}`, x: index, y: 0, support: { type: 'none' } as const,
      })),
      members: [],
    };
    const { repository, record } = await setup(many);
    const { unmount } = renderPanel(repository, record);
    await saveVersion(user, 'Con sesenta nudos');
    await waitFor(() => expect(screen.getByText('Con sesenta nudos')).toBeTruthy());
    unmount();

    const emptied = await repository.saveProject({ ...many, nodes: [], members: [] }, record.revision);
    renderPanel(repository, emptied);
    await user.click(await screen.findByRole('button', { name: /^Con sesenta nudos/ }));

    expect(screen.getByText('Bajas: 60')).toBeTruthy();
    expect(screen.getByText(/y 20 cambios más/)).toBeTruthy();
  });
});

describe('comparar dos versiones', () => {
  it('declara idénticas dos instantáneas del mismo estado', async () => {
    const user = userEvent.setup();
    const { repository, record } = await setup();
    renderPanel(repository, record);
    await saveVersion(user, 'Primera');
    await waitFor(() => expect(screen.getByText('Primera')).toBeTruthy());
    await saveVersion(user, 'Segunda');
    await waitFor(() => expect(screen.getByText('Segunda')).toBeTruthy());

    await user.selectOptions(screen.getByLabelText('Comparar con'), screen.getByRole('option', { name: 'Primera' }));

    expect(screen.getByText(/No hay ninguna diferencia/)).toBeTruthy();
    expect(screen.getByText(/De «Segunda» a «Primera»/)).toBeTruthy();
  });
});

describe('restaurar', () => {
  it('deja el estado anterior como copia recuperable antes de pisarlo', async () => {
    const user = userEvent.setup();
    const { repository, record } = await setup();
    const { unmount } = renderPanel(repository, record);
    await saveVersion(user, 'Estado original');
    await waitFor(() => expect(screen.getByText('Estado original')).toBeTruthy());
    unmount();

    const moved = await repository.saveProject({
      ...baseProject(),
      nodes: [
        { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
        { id: 'N2', x: 9, y: 0, support: { type: 'roller' } },
      ],
    }, record.revision);
    const onRestored = vi.fn();
    renderPanel(repository, moved, { onRestored });

    await user.click(await screen.findByRole('button', { name: 'Restaurar la versión Estado original' }));

    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    const restored = onRestored.mock.calls[0][0] as StoredProjectRecord;
    expect(restored.project.nodes.find((node) => node.id === 'N2')?.x).toBe(4);

    /* Y lo que había no se perdió: restaurar es la única operación de la
       biblioteca que pisa el estado actual, y por eso tiende su red antes. */
    const recoveries = await repository.listRecoveries('P1');
    const net = recoveries.filter((recovery) => recovery.reason === 'manual');
    expect(net).toHaveLength(1);
    expect(net[0].project.nodes.find((node) => node.id === 'N2')?.x).toBe(9);
  });
});
