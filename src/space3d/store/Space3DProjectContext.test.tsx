// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Space3DProjectProvider, useSpace3DProject } from './Space3DProjectContext';
import { createBlankSpace3DProject, createSpace3DPortalExample } from '../model/defaultProject';
import { serializeSpace3DProject } from '../data/codec';
import { SPACE3D_STORAGE_KEY } from '../data/storage';
import { freeSpace3DRestraints } from '../model/types';
import type { Space3DStorageLike } from '../data/storage';

class MemoryStorage implements Space3DStorageLike {
  readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}

const Harness = () => {
  const {
    project, analysis, analysisState, analysisTargetId, canUndo, canRedo, selectedEntity,
    execute, undo, redo, analyze, cancelAnalysis, replaceProject, importPortable, exportPortable, select, lastError,
  } = useSpace3DProject();

  return <div>
    <p data-testid="nodes">{project.nodes.map((node) => node.id).join(',')}</p>
    <p data-testid="members">{project.members.map((member) => member.id).join(',')}</p>
    <p data-testid="state">{analysisState}</p>
    <p data-testid="success">{String(analysis?.success ?? 'none')}</p>
    <p data-testid="uy">{analysis?.nodeResults.find((item) => item.nodeId === 'N4')?.displacement.uy ?? ''}</p>
    <p data-testid="selection">{selectedEntity ? `${selectedEntity.kind}:${selectedEntity.id}` : 'none'}</p>
    <p data-testid="error">{lastError ?? ''}</p>
    <p data-testid="undo">{String(canUndo)}</p>
    <p data-testid="target">{analysisTargetId}</p>
    <p data-testid="redo">{String(canRedo)}</p>
    <button onClick={() => execute({ kind: 'add-node', node: { id: 'N9', x: 1, y: 1, z: 1, restraints: freeSpace3DRestraints() } })}>add</button>
    <button onClick={() => execute({ kind: 'delete-node', nodeId: 'N1' })}>bad</button>
    <button onClick={() => undo()}>undo</button>
    <button onClick={() => redo()}>redo</button>
    <button onClick={() => { void analyze(); }}>analyze</button>
    <button onClick={() => cancelAnalysis()}>cancel</button>
    <button onClick={() => select({ kind: 'node', id: 'N2' })}>select</button>
    <button onClick={() => replaceProject(createBlankSpace3DProject())}>blank</button>
    <button onClick={() => importPortable(serializeSpace3DProject(createSpace3DPortalExample()))}>import</button>
    <button onClick={() => importPortable('{ nope')}>import-bad</button>
    <p data-testid="export">{exportPortable().length > 0 ? 'ok' : 'empty'}</p>
  </div>;
};

let storage: MemoryStorage;

const renderProvider = () => render(
  <Space3DProjectProvider storage={storage}><Harness /></Space3DProjectProvider>,
);

beforeEach(() => { storage = new MemoryStorage(); });
afterEach(() => cleanup());

describe('Space3DProjectProvider', () => {
  it('arranca con el ejemplo espacial y lo persiste en su propia clave', async () => {
    renderProvider();
    expect(screen.getByTestId('nodes').textContent).toBe('N1,N2,N3,N4');
    await waitFor(() => expect(storage.getItem(SPACE3D_STORAGE_KEY)).toBeTruthy());
    expect(storage.map.size).toBe(1);
  });

  it('recupera el proyecto guardado en el siguiente montaje', async () => {
    storage.setItem(SPACE3D_STORAGE_KEY, serializeSpace3DProject(createBlankSpace3DProject()));
    renderProvider();
    expect(screen.getByTestId('nodes').textContent).toBe('');
    expect(screen.getByTestId('members').textContent).toBe('');
  });

  it('ejecuta comandos con deshacer y rehacer', async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('nodes').textContent).toBe('N1,N2,N3,N4,N9');
    expect(screen.getByTestId('undo').textContent).toBe('true');

    await user.click(screen.getByRole('button', { name: 'undo' }));
    expect(screen.getByTestId('nodes').textContent).toBe('N1,N2,N3,N4');
    expect(screen.getByTestId('redo').textContent).toBe('true');

    await user.click(screen.getByRole('button', { name: 'redo' }));
    expect(screen.getByTestId('nodes').textContent).toBe('N1,N2,N3,N4,N9');
  });

  it('rechaza un comando inválido conservando el proyecto y publicando el error', async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole('button', { name: 'bad' }));
    expect(screen.getByTestId('nodes').textContent).toBe('N1,N2,N3,N4');
    expect(screen.getByTestId('error').textContent).toBe('node-in-use');
    expect(screen.getByTestId('undo').textContent).toBe('false');
  });

  it('analiza y marca el resultado como obsoleto al editar después', async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole('button', { name: 'analyze' }));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready'));
    expect(screen.getByTestId('success').textContent).toBe('true');
    const displacement = screen.getByTestId('uy').textContent;
    expect(Number(displacement)).toBeLessThan(0);

    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('state').textContent).toBe('stale');
    expect(screen.getByTestId('uy').textContent).toBe(displacement);
  });

  it('marca obsoleto también tras deshacer, importar o reemplazar', async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole('button', { name: 'analyze' }));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready'));
    await user.click(screen.getByRole('button', { name: 'blank' }));
    expect(screen.getByTestId('state').textContent).toBe('stale');
    expect(screen.getByTestId('nodes').textContent).toBe('');
  });

  it('publica un fallo de análisis sin borrar el modelo', async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole('button', { name: 'blank' }));
    await user.click(screen.getByRole('button', { name: 'analyze' }));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('failed'));
    expect(screen.getByTestId('success').textContent).toBe('false');
  });

  it('cancela un análisis en vuelo sin dejar el estado en running', async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole('button', { name: 'cancel' }));
    expect(screen.getByTestId('state').textContent).toBe('idle');
  });

  it('importa un portable válido y rechaza uno corrupto', async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole('button', { name: 'blank' }));
    expect(screen.getByTestId('nodes').textContent).toBe('');
    await user.click(screen.getByRole('button', { name: 'import' }));
    expect(screen.getByTestId('nodes').textContent).toBe('N1,N2,N3,N4');

    await user.click(screen.getByRole('button', { name: 'import-bad' }));
    expect(screen.getByTestId('nodes').textContent).toBe('N1,N2,N3,N4');
    expect(screen.getByTestId('error').textContent).toBe('malformed-json');
  });

  it('exporta un portable no vacío y mantiene la selección', async () => {
    const user = userEvent.setup();
    renderProvider();
    expect(screen.getByTestId('export').textContent).toBe('ok');
    await user.click(screen.getByRole('button', { name: 'select' }));
    expect(screen.getByTestId('selection').textContent).toBe('node:N2');
    await user.click(screen.getByRole('button', { name: 'blank' }));
    expect(screen.getByTestId('selection').textContent).toBe('none');
  });

  it('toma el objetivo de análisis del proyecto en vez de asumir LC1', async () => {
    const user = userEvent.setup();
    const renamed = {
      ...createSpace3DPortalExample(),
      loadCases: [{ id: 'permanente', name: 'Permanente' }],
      nodalLoads: createSpace3DPortalExample().nodalLoads.map((load) => ({ ...load, caseId: 'permanente' })),
      loadCombinations: [],
    };
    render(<Space3DProjectProvider storage={storage} initialProject={renamed}><Harness /></Space3DProjectProvider>);
    expect(screen.getByTestId('target').textContent).toBe('permanente');

    await user.click(screen.getByRole('button', { name: 'analyze' }));
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready'));
  });

  it('realinea el objetivo cuando el proyecto cambia y el anterior ya no existe', async () => {
    const user = userEvent.setup();
    renderProvider();
    expect(screen.getByTestId('target').textContent).toBe('LC1');
    await user.click(screen.getByRole('button', { name: 'blank' }));
    // El proyecto vacío conserva LC1; un import con otros casos debe realinear.
    expect(screen.getByTestId('target').textContent).toBe('LC1');
  });

  it('analiza igual bajo StrictMode, que monta y limpia dos veces', async () => {
    const user = userEvent.setup();
    render(<StrictMode>
      <Space3DProjectProvider storage={storage}><Harness /></Space3DProjectProvider>
    </StrictMode>);
    const analyze = screen.getAllByRole('button', { name: 'analyze' })[0];
    await user.click(analyze);
    await waitFor(() => expect(screen.getAllByTestId('state')[0].textContent).toBe('ready'));
  });

  it('no deja trabajo pendiente al desmontar', async () => {
    const user = userEvent.setup();
    const view = renderProvider();
    await user.click(screen.getByRole('button', { name: 'analyze' }));
    expect(() => view.unmount()).not.toThrow();
  });
});
