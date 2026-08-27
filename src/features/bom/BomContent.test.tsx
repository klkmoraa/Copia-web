// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findStandardMaterial } from '../../data/standardMaterials';
import { findStandardSection } from '../../data/standardSections';
import type { ProjectModel } from '../../types';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';

const material = findStandardMaterial('steel-a992')!;
const section = findStandardSection('w6x9')!;

const makeProject = (secondLength = 4): ProjectModel => ({
  schemaVersion: 6,
  id: 'P-BOM-UI',
  name: 'BOM UI',
  nodes: [
    { id: 'N1', x: 0, y: 0, support: { type: 'none' } },
    { id: 'N2', x: 3, y: 0, support: { type: 'none' } },
    { id: 'N3', x: 3, y: secondLength, support: { type: 'none' } },
  ],
  members: [
    {
      id: 'F1', i: 'N1', j: 'N2', type: 'frame',
      E: material.elasticModulus, A: section.area, I: section.inertiaX, density: material.density,
      materialId: material.id, materialOrigin: 'catalog', sectionId: section.id, sectionOrigin: 'catalog',
    },
    {
      id: 'T1', i: 'N2', j: 'N3', type: 'truss',
      E: 20_000_000, A: 0.01, I: 0, density: 2_400,
      materialOrigin: 'custom', sectionOrigin: 'custom',
    },
  ],
  loadCases: [], combinations: [], nodalLoads: [], memberLoads: [], memberInitialEffects: [],
  settings: {
    units: 'kN-m', language: 'es', gridSize: 1, snap: true,
    showGrid: true, showNodeLabels: true, showMemberLabels: true,
    showLocalAxes: false, showLoads: true, showDimensions: true,
    showResultValues: true, diagramScale: 1, deformedScale: 1, diagramSide: 'positive',
  },
});

const context = { project: makeProject() };
const setSelection = vi.fn();
vi.mock('../../store/ProjectModelContext', () => ({ useProjectModel: () => context }));
vi.mock('../../store/WorkspaceUIContext', () => ({ useWorkspaceUI: () => ({ setSelection }) }));
vi.mock('../../i18n/useI18n', async () => {
  const { translate } = await import('../../i18n/catalogs');
  return { useI18n: () => ({ language: 'es' as const, t: (key: Parameters<typeof translate>[1], variables?: Record<string, string | number>) => translate('es', key, variables) }) };
});

afterEach(() => {
  cleanup();
  context.project = makeProject();
  setSelection.mockReset();
});

describe('BomContent', () => {
  it('shows geometric quantities, explicit scope, provenance, and no purchase claim', async () => {
    const { BomContent } = await import('./BomContent');
    render(<BomContent />);

    const panel = screen.getByTestId('structural-bom');
    expect(within(panel).getByRole('heading', { name: 'Cuantificación geométrica' })).toBeTruthy();
    expect(within(panel).getByText(/Longitud entre nudos/)).toBeTruthy();
    expect(within(panel).getByText(/0% de desperdicio/)).toBeTruthy();
    expect(within(panel).getByRole('columnheader', { name: 'Material' })).toBeTruthy();
    expect(within(panel).getByRole('columnheader', { name: 'Sección' })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: /Localizar barra F1/ })).toBeTruthy();
    expect(within(panel).getByRole('button', { name: /Localizar barra T1/ })).toBeTruthy();
    expect(within(panel).getByText(/No es una estimación de compra/)).toBeTruthy();
    expect(panel.textContent).not.toMatch(/\$|USD|MXN/);
    expect(panel.dataset.rowCount).toBe('2');
  });

  it('filters member family and identity while preserving stable aggregate rows', async () => {
    const user = userEvent.setup();
    const { BomContent } = await import('./BomContent');
    render(<BomContent />);

    const panel = screen.getByTestId('structural-bom');
    await user.click(within(panel).getByRole('button', { name: 'Armaduras' }));
    expect(panel.dataset.rowCount).toBe('1');
    expect(within(panel).queryByRole('button', { name: /Localizar barra T1/ })).toBeNull();

    await user.selectOptions(within(panel).getByLabelText('Identidad'), 'unresolved');
    expect(panel.dataset.rowCount).toBe('0');
    expect(within(panel).getByText('Ninguna fila coincide con los filtros.')).toBeTruthy();
  });

  it('rebuilds from the current project and exports exactly the visible filter scope', async () => {
    const user = userEvent.setup();
    const download = vi.fn();
    const { BomContent } = await import('./BomContent');
    const view = render(<BomContent download={download} />);

    expect(screen.getByTestId('bom-total-length').textContent).toContain('7');
    context.project = makeProject(6);
    view.rerender(<BomContent download={download} />);
    expect(screen.getByTestId('bom-total-length').textContent).toContain('9');

    await user.selectOptions(screen.getByLabelText('Identidad'), 'catalog');
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBe(context.project);
    expect(download.mock.calls[0][1].filters).toEqual({ memberTypes: ['frame', 'truss'], identity: 'catalog' });
    expect(download.mock.calls[0][1].rows.map((row: { rowId: string }) => row.rowId)).toEqual(['catalog:frame:steel-a992:w6x9']);
  });

  it('selects provenance explicitly and asks the broker to reveal the original member, degrading to peek', async () => {
    const user = userEvent.setup();
    const onPeek = vi.fn();
    const focused: string[] = [];
    const unsubscribe = onWorkspaceCommand('focus-object', (target) => focused.push(target.id));
    const { BomContent } = await import('./BomContent');
    render(<BomContent onPeek={onPeek} />);

    await user.click(screen.getByRole('button', { name: /Localizar barra F1/ }));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    expect(setSelection).toHaveBeenCalledWith({ kind: 'member', id: 'F1' });
    expect(onPeek).toHaveBeenCalledTimes(1);
    expect(focused).toEqual(['F1']);
    unsubscribe();
  });
});
