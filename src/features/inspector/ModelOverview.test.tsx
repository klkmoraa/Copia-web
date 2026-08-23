// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelOverview } from './ModelOverview';
import { createBlankProject, createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import type { ProjectModel } from '../../types';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';

const renderOverview = (project: ProjectModel) => {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  return render(<ProjectProvider><ModelOverview /></ProjectProvider>);
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Panorama del modelo', () => {
  it('enseña el censo, la extensión y los casos de carga de un modelo con contenido', async () => {
    renderOverview(createDefaultProject());
    const overview = await screen.findByRole('region', { name: 'Panorama del modelo' });

    const cell = (label: string) => within(overview).getByText(label).parentElement?.querySelector('dd')?.textContent;
    expect(cell('Nodos')).toBe('4');
    expect(cell('Miembros')).toBe('3');
    expect(cell('Apoyos')).toBe('2');
    expect(cell('Extensión')).toBe('6 × 4 m');
    // «1 activos de 2» era falta de concordancia; la plantilla se ordena para
    // que valga con cualquier número sin necesitar plural.
    expect(cell('Casos de carga')).toBe('1 de 2 activos');
  });

  /**
   * El estado del análisis y la fiabilidad viven en la barra superior. Que no
   * se repitan aquí no es un detalle: repetirlos en el hueco recién liberado
   * sería cometer, otra vez, el defecto que este rediseño está retirando.
   */
  it('no repite el estado del análisis ni la fiabilidad, que ya viven en la barra superior', async () => {
    renderOverview(createDefaultProject());
    await screen.findByRole('region', { name: 'Panorama del modelo' });

    expect(screen.queryByText(/fiabilidad/i)).toBeNull();
    expect(screen.queryByText(/listo para analizar|análisis actualizado/i)).toBeNull();
  });

  it('convierte el modelo vacío en un primer paso, no en una disculpa', async () => {
    const user = userEvent.setup();
    const commands: string[] = [];
    const unsubscribe = onWorkspaceCommand('open-structure-generator', () => commands.push('generator'));

    renderOverview(createBlankProject());
    const overview = await screen.findByRole('region', { name: 'Panorama del modelo' });
    expect(within(overview).getByRole('heading', { name: 'Este modelo está vacío' })).toBeTruthy();
    // Sin nudos no hay censo que enseñar: enseñarlo en ceros no informaría.
    expect(within(overview).queryByText('Nodos')).toBeNull();

    await user.click(within(overview).getByRole('button', { name: /Generar estructura/ }));
    expect(commands).toEqual(['generator']);
    unsubscribe();
  });

  /**
   * Hasta aquí el recuento de hallazgos sólo existía como un aviso pasajero que
   * se va solo. Un modelo con hallazgos y el aviso ya cerrado no tenía forma de
   * decirlo en ninguna parte.
   */
  it('publica los hallazgos del Model Doctor y abre su superficie', async () => {
    const user = userEvent.setup();
    const commands: string[] = [];
    const unsubscribe = onWorkspaceCommand('open-model-doctor', () => commands.push('doctor'));

    // Un pórtico sin ningún apoyo es un mecanismo: el Doctor tiene que verlo.
    const project = createDefaultProject();
    project.nodes = project.nodes.map((node) => ({ ...node, support: { type: 'none' as const } }));
    renderOverview(project);

    const finding = await screen.findByRole('button', { name: /Model Doctor encontró/ }, { timeout: 5000 });
    await user.click(finding);
    expect(commands).toEqual(['doctor']);
    unsubscribe();
  });

  it('dice explícitamente cuando no hay nada que revisar', async () => {
    renderOverview(createDefaultProject());
    await waitFor(() => expect(screen.getByText('Model Doctor no encuentra nada que revisar.')).toBeTruthy());
  });
});
