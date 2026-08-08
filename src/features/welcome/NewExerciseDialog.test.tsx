// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { NewExerciseDialog } from './NewExerciseDialog';

beforeAll(() => {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);
  }
});

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const renderInLanguage = (dialog: React.ReactElement, language: 'es' | 'en' = 'es') => {
  const project = createBlankProject();
  project.settings = { ...project.settings, language };
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  return render(<ProjectProvider>{dialog}</ProjectProvider>);
};

describe('NewExerciseDialog', () => {
  it('localizes dialog copy, ARIA, templates, fields and options in English without translating project data', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    renderInLanguage(<NewExerciseDialog open onClose={vi.fn()} onCreate={onCreate} />, 'en');

    const dialog = screen.getByRole('dialog', {
      name: 'New exercise',
      description: 'Start from scratch or generate a model with editable geometry, supports, and load.',
    });
    const descriptionId = dialog.getAttribute('aria-describedby');
    expect(descriptionId).toBe('new-exercise-subtitle');
    expect(document.getElementById(descriptionId!)?.textContent).toBe('Start from scratch or generate a model with editable geometry, supports, and load.');
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Exercise type' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Choose a starting point' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Start from scratch.*Empty canvas.*Basic.*Getting started/ })).toBeTruthy();
    expect(screen.getByText('The project will open empty. The guide will tell you when to add nodes, members, supports, and loads.')).toBeTruthy();

    const simpleBeam = screen.getByRole('radio', { name: /Simply supported beam/ });
    await user.click(simpleBeam);
    expect(screen.getByText('Editable point load on a statically determinate beam.')).toBeTruthy();
    expect(within(simpleBeam).getByText('Beams')).toBeTruthy();
    expect(within(simpleBeam).getByText('Diagrams')).toBeTruthy();
    const length = screen.getByRole('spinbutton', { name: 'Length or span' });
    await user.clear(length);
    await user.type(length, '12');
    expect(screen.getByRole('spinbutton', { name: 'Downward load' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Load position' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Create exercise' }));

    expect(onCreate).toHaveBeenCalledOnce();
    const createdProject = onCreate.mock.calls[0][0];
    expect(createdProject.name).toBe('Viga simplemente apoyada');
    expect(createdProject.nodes[1].x).toBe(12);
  });

  it('creates a parameterized classroom exercise', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    renderInLanguage(<NewExerciseDialog open onClose={vi.fn()} onCreate={onCreate} />);
    expect(screen.getByRole('dialog', { name: /nuevo ejercicio/i })).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: /viga simplemente apoyada/i }));
    const length = screen.getByRole('spinbutton', { name: /longitud o claro/i });
    await user.clear(length);
    await user.type(length, '12');
    await user.click(screen.getByRole('button', { name: /crear ejercicio/i }));

    expect(onCreate).toHaveBeenCalledOnce();
    const project = onCreate.mock.calls[0][0];
    expect(project.settings.calculationMode).toBe('classroom');
    expect(project.nodes[1].x).toBe(12);
  });

  it('keeps empty numeric parameters out of the model and reports an inline localized error', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    renderInLanguage(<NewExerciseDialog open onClose={vi.fn()} onCreate={onCreate} />, 'en');
    await user.click(screen.getByRole('radio', { name: /Simply supported beam/ }));
    const length = screen.getByRole('spinbutton', { name: 'Length or span' });

    await user.clear(length);
    await user.click(screen.getByRole('button', { name: 'Create exercise' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('This field cannot be empty.');
    expect(length.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(length);
  });

  it('closes with Escape and renders nothing while closed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = renderInLanguage(<NewExerciseDialog open onClose={onClose} onCreate={vi.fn()} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<ProjectProvider><NewExerciseDialog open={false} onClose={onClose} onCreate={vi.fn()} /></ProjectProvider>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('supports arrow navigation and restores focus to its opener', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = renderInLanguage(<><button type="button">Abrir ejercicio</button><NewExerciseDialog open={false} onClose={onClose} onCreate={vi.fn()} /></>);
    const opener = screen.getByRole('button', { name: /abrir ejercicio/i });
    opener.focus();
    rerender(<ProjectProvider><><button type="button">Abrir ejercicio</button><NewExerciseDialog open onClose={onClose} onCreate={vi.fn()} /></></ProjectProvider>);
    const blank = await screen.findByRole('radio', { name: /desde cero/i });
    blank.focus();
    fireEvent.keyDown(blank, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByRole('radio', { name: /viga simplemente apoyada/i }).getAttribute('aria-checked')).toBe('true'));
    await user.keyboard('{Escape}');
    rerender(<ProjectProvider><><button type="button">Abrir ejercicio</button><NewExerciseDialog open={false} onClose={onClose} onCreate={vi.fn()} /></></ProjectProvider>);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: /abrir ejercicio/i })));
  });
});
