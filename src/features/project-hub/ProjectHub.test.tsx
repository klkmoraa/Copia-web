// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { ProjectProvider } from '../../store/ProjectContext';
import { InMemoryProjectRepository } from '../../storage/projectRepository';
import { saveNamedVersion } from '../../storage/projectVersions';
import { ProjectHub } from './ProjectHub';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ProjectHub', () => {
  it('lists and opens a verified local project', async () => {
    const repository = new InMemoryProjectRepository();
    const project = { ...createDefaultProject(), name: 'Proyecto local verificado' };
    const record = await repository.saveProject(project);
    const onOpen = vi.fn();
    render(<ProjectProvider><ProjectHub repository={repository} onOpen={onOpen} /></ProjectProvider>);

    expect(await screen.findByText('Proyecto local verificado')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir Proyecto local verificado' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: record.id, revision: record.revision }));
  });

  it('duplicates a project without hiding the original', async () => {
    const repository = new InMemoryProjectRepository();
    await repository.saveProject({ ...createDefaultProject(), name: 'Modelo base' });
    render(<ProjectProvider><ProjectHub repository={repository} onOpen={() => undefined} /></ProjectProvider>);
    expect(await screen.findByText('Modelo base')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Duplicar Modelo base' }));
    await waitFor(() => expect(screen.getByText('Copia de Modelo base')).toBeTruthy());
    expect(screen.getByText('Modelo base')).toBeTruthy();
  });

  it('ofrece las versiones de cada proyecto sin salir de la biblioteca', async () => {
    const repository = new InMemoryProjectRepository();
    const project = { ...createDefaultProject(), name: 'Con historial' };
    await repository.saveProject(project);
    await saveNamedVersion(repository, project, 'Antes de subir las cargas');
    render(<ProjectProvider><ProjectHub repository={repository} onOpen={() => undefined} /></ProjectProvider>);

    expect(await screen.findByText('Con historial')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Versiones (1)')).toBeTruthy());
    expect(screen.getByText('Antes de subir las cargas')).toBeTruthy();
  });

  it('no cuenta una versión nombrada como copia recuperable', async () => {
    const repository = new InMemoryProjectRepository();
    const project = { ...createDefaultProject(), name: 'Con historial' };
    await repository.saveProject(project);
    await saveNamedVersion(repository, project, 'Antes de subir las cargas');
    await repository.createRecovery(project, 'manual');
    render(<ProjectProvider><ProjectHub repository={repository} onOpen={() => undefined} /></ProjectProvider>);

    /* Comparten almacén a propósito, pero no son la misma cosa para quien
       mira: una la pidió el usuario y tiene nombre; la otra la tendió el
       producto. Contarlas juntas diría dos donde hay una de cada. */
    await waitFor(() => expect(screen.getByText('Copias recuperables (1)')).toBeTruthy());
  });
});
