// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectProvider, useProjectModel } from '../../store/ProjectContext';
import { createBlankProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProposalAssistant } from './ProposalAssistant';

/**
 * `M1` es el único miembro del proyecto sembrado, y `w6x9` es una sección real
 * del catálogo (`standardSections`): el proveedor local sólo reconoce lo que
 * ya existe en el modelo, así que la prueba tiene que darle ambos.
 */
const seedProject = () => {
  const project = createBlankProject();
  project.nodes = [
    { id: 'A', x: 0, y: 0, support: { type: 'pin' } },
    { id: 'B', x: 4, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ];
  project.members = [{ id: 'M1', i: 'A', j: 'B', type: 'frame', E: 200e6, A: 0.01, I: 8e-5 }];
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
};

/** Expone lo que el diálogo cambia, sin depender de ninguna pantalla real. */
const MemberProbe = () => {
  const { project, canUndo } = useProjectModel();
  const member = project.members.find((candidate) => candidate.id === 'M1');
  return <p data-testid="member-probe">{member?.sectionId ?? 'sin sección'} · {canUndo ? 'con historial' : 'sin historial'}</p>;
};

const Harness = () => {
  const [open, setOpen] = useState(true);
  return <ProjectProvider>
    <MemberProbe />
    <ProposalAssistant open={open} onClose={() => setOpen(false)} />
  </ProjectProvider>;
};

beforeEach(() => {
  localStorage.clear();
  seedProject();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ProposalAssistant', () => {
  it('prepares a ready proposal, shows its diff, and applies it on confirm', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByTestId('member-probe').textContent).toBe('sin sección · sin historial');

    const dialog = await screen.findByRole('dialog', { name: /asistente local/i });
    await user.type(within(dialog).getByLabelText(/describe el cambio/i), 'aplica w6x9 a M1');
    await user.click(within(dialog).getByRole('button', { name: /proponer cambio/i }));

    expect(await within(dialog).findByText(/revisa el cambio antes de aplicarlo/i)).toBeTruthy();
    expect(within(dialog).getByText('M1')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: /aplicar cambio/i }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /asistente local/i })).toBeNull());
    expect(screen.getByTestId('member-probe').textContent).toBe('w6x9 · con historial');
  });

  it('asks for clarification when the intent names no known member', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const dialog = await screen.findByRole('dialog', { name: /asistente local/i });
    await user.type(within(dialog).getByLabelText(/describe el cambio/i), 'sube la rigidez');
    await user.click(within(dialog).getByRole('button', { name: /proponer cambio/i }));

    expect(await within(dialog).findByRole('status')).toBeTruthy();
    expect(within(dialog).queryByText(/revisa el cambio antes de aplicarlo/i)).toBeNull();
  });
});
