// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createDefaultProject } from '../../data/defaultProject';
import type { StructureGenerationGhost } from '../../data/generators/generatorGhost';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import type { ProjectModel } from '../../types';
import { StructureGeneratorSurface } from './StructureGeneratorSurface';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const setup = () => userEvent.setup({ delay: null });

/**
 * La superficie sobre el proveedor real: lo que se prueba aquí es exactamente el
 * puente entre el formulario y el proyecto —preparar, no mutar, confirmar una
 * sola vez y poder deshacerlo—, no el dibujo, que ya cubre el panel.
 */
const Harness = ({
  onGhostChange,
  onClose = () => undefined,
}: {
  onGhostChange?: (ghost: StructureGenerationGhost | null) => void;
  onClose?: () => void;
}) => {
  const { project, canUndo, undo, redo, analysis } = useProject();
  const [open, setOpen] = useState(true);
  return <>
    <output aria-label="nodes">{String(project.nodes.length)}</output>
    <output aria-label="members">{String(project.members.length)}</output>
    <output aria-label="can-undo">{String(canUndo)}</output>
    <output aria-label="analysis">{analysis ? 'present' : 'none'}</output>
    <button onClick={undo}>probe-undo</button>
    <button onClick={redo}>probe-redo</button>
    {open ? <StructureGeneratorSurface
      {...(onGhostChange ? { onGhostChange } : {})}
      onClose={() => { setOpen(false); onClose(); }}
    /> : null}
  </>;
};

const renderSurface = (
  project: ProjectModel = createDefaultProject(),
  props: Parameters<typeof Harness>[0] = {},
) => {
  localStorage.setItem('structureCo.project', JSON.stringify(project));
  return render(<ProjectProvider><Harness {...props} /></ProjectProvider>);
};

const value = (label: string) => screen.getByLabelText(label).textContent;
const summaryValue = (id: string) => document.querySelector(`[data-summary-row="${id}"] strong`)?.textContent;
const generate = async (user: ReturnType<typeof setup>) => {
  await user.click(screen.getByRole('button', { name: 'Revisar' }));
  await user.click(screen.getByRole('button', { name: 'Generar' }));
};

describe('vista previa', () => {
  it('prepara sin tocar el modelo ni el almacenamiento', async () => {
    const user = setup();
    renderSurface();
    const before = { nodes: value('nodes'), members: value('members') };
    const stored = localStorage.getItem('structureCo.project');

    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    const count = within(spans).getByLabelText('Claros: cantidad');
    await user.clear(count);
    await user.type(count, '5');

    expect(summaryValue('nodes')).toBe('6');
    expect(value('nodes')).toBe(before.nodes);
    expect(value('members')).toBe(before.members);
    expect(localStorage.getItem('structureCo.project')).toBe(stored);
    expect(value('can-undo')).toBe('false');
  });

  it('publica el ghost mientras se ajusta y lo retira al cerrar', async () => {
    const user = setup();
    const onGhostChange = vi.fn();
    renderSurface(createDefaultProject(), { onGhostChange });
    await waitFor(() => expect(onGhostChange).toHaveBeenCalled());
    const ghost = onGhostChange.mock.calls.at(-1)![0] as StructureGenerationGhost;
    expect(ghost.nodes.length).toBeGreaterThan(0);
    // El ghost no es un ProjectModel y no lleva IDs de entidad.
    expect(ghost.nodes.every((node) => !('id' in node))).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Cerrar generador' }));
    await waitFor(() => expect(onGhostChange.mock.calls.at(-1)![0]).toBeNull());
  });

  it('no vuelve a generar cuando el cambio no altera los parámetros', async () => {
    const user = setup();
    const onGhostChange = vi.fn();
    renderSurface(createDefaultProject(), { onGhostChange });
    await waitFor(() => expect(onGhostChange).toHaveBeenCalled());
    const calls = onGhostChange.mock.calls.length;
    const first = onGhostChange.mock.calls.at(-1)![0];

    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    // `5` → `5.` no cambia nada que el núcleo pueda ver.
    await user.type(within(spans).getByLabelText('Claros: separación'), '.');
    expect(onGhostChange.mock.calls.length).toBe(calls);
    expect(onGhostChange.mock.calls.at(-1)![0]).toBe(first);
  });

  it('retira la vista previa cuando los parámetros dejan de ser válidos', async () => {
    const user = setup();
    const onGhostChange = vi.fn();
    renderSurface(createDefaultProject(), { onGhostChange });
    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    await user.clear(within(spans).getByLabelText('Claros: cantidad'));
    await waitFor(() => expect(onGhostChange.mock.calls.at(-1)![0]).toBeNull());
    expect(document.querySelector('[data-summary-row="nodes"]')).toBeNull();
  });
});

describe('confirmación', () => {
  it('añade la geometría exacta que el resumen prometía, en un solo paso', async () => {
    const user = setup();
    renderSurface();
    const baseNodes = Number(value('nodes'));
    const baseMembers = Number(value('members'));
    const promisedNodes = Number(summaryValue('nodes'));
    const promisedMembers = Number(summaryValue('members'));

    await generate(user);

    await waitFor(() => expect(value('nodes')).toBe(String(baseNodes + promisedNodes)));
    expect(value('members')).toBe(String(baseMembers + promisedMembers));
    expect(value('can-undo')).toBe('true');
  });

  it('un solo deshacer retira la geometría entera', async () => {
    const user = setup();
    renderSurface();
    const baseNodes = value('nodes');
    const baseMembers = value('members');
    await generate(user);
    await waitFor(() => expect(value('nodes')).not.toBe(baseNodes));

    await user.click(screen.getByRole('button', { name: 'probe-undo' }));
    await waitFor(() => expect(value('nodes')).toBe(baseNodes));
    expect(value('members')).toBe(baseMembers);

    await user.click(screen.getByRole('button', { name: 'probe-redo' }));
    await waitFor(() => expect(value('nodes')).not.toBe(baseNodes));
  });

  it('cierra la superficie al confirmar', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderSurface(createDefaultProject(), { onClose });
    await generate(user);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(document.querySelector('[data-structure-generator-surface]')).toBeNull();
  });

  it('cancelar no deja rastro ni ocupa el historial', async () => {
    const user = setup();
    renderSurface();
    const before = { nodes: value('nodes'), members: value('members') };
    const spans = document.querySelector('[data-spacing-field="spans"]') as HTMLElement;
    await user.click(within(spans).getByRole('radio', { name: 'Personalizada' }));
    await user.type(within(spans).getByLabelText('Claros: separaciones'), '4, 6, 4');
    await user.click(screen.getByRole('button', { name: 'Revisar' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar generador' }));

    expect(value('nodes')).toBe(before.nodes);
    expect(value('members')).toBe(before.members);
    expect(value('can-undo')).toBe('false');
  });

  it('los apoyos elegidos llegan al modelo y los no elegidos no', async () => {
    const user = setup();
    renderSurface(createDefaultProject());
    await user.click(screen.getByRole('radio', { name: 'Pórtico' }));
    await user.click(screen.getByRole('button', { name: 'Origen de inserción' }));
    await user.click(screen.getByRole('radio', { name: 'Empotramiento' }));
    await generate(user);

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('structureCo.project')!) as ProjectModel;
      expect(stored.nodes.filter((node) => node.support.type === 'fixed').length).toBe(3);
    });
  });

  it('lo confirmado son nudos y barras normales, sin marca de generador', async () => {
    const user = setup();
    renderSurface();
    await generate(user);
    await waitFor(() => expect(value('can-undo')).toBe('true'));
    const stored = JSON.parse(localStorage.getItem('structureCo.project')!) as ProjectModel;
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain('generator');
    expect(serialized).not.toContain('ghost');
    expect(stored.nodes.every((node) => /^N\d+$/.test(node.id))).toBe(true);
    expect(stored.members.every((member) => /^M\d+$/.test(member.id))).toBe(true);
  });

  it('no crea ninguna carga', async () => {
    const user = setup();
    const project = createDefaultProject();
    renderSurface(project);
    const beforeLoads = project.nodalLoads.length + project.memberLoads.length;
    await generate(user);
    await waitFor(() => expect(value('can-undo')).toBe('true'));
    const stored = JSON.parse(localStorage.getItem('structureCo.project')!) as ProjectModel;
    expect(stored.nodalLoads.length + stored.memberLoads.length).toBe(beforeLoads);
  });
});

describe('origen elegido en el lienzo', () => {
  it('escribe el punto recibido en el formulario y avisa de que lo consumió', async () => {
    const onOriginPickResolved = vi.fn();
    const project = createDefaultProject();
    localStorage.setItem('structureCo.project', JSON.stringify(project));
    const { rerender } = render(<ProjectProvider>
      <StructureGeneratorSurface onClose={() => undefined} />
    </ProjectProvider>);

    rerender(<ProjectProvider>
      <StructureGeneratorSurface
        pickedOrigin={{ x: 7, y: -2, token: 1 }}
        onOriginPickResolved={onOriginPickResolved}
        onClose={() => undefined}
      />
    </ProjectProvider>);

    await waitFor(() => expect(onOriginPickResolved).toHaveBeenCalledTimes(1));
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Origen de inserción' }));
    expect((screen.getByRole('textbox', { name: 'Origen X' }) as HTMLInputElement).value).toBe('7');
    expect((screen.getByRole('textbox', { name: 'Origen Y' }) as HTMLInputElement).value).toBe('-2');
  });
});
