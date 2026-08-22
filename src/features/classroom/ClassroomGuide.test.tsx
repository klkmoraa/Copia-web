// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { createSimpleBeamExercise } from '../../education/exerciseTemplates';
import { ClassroomSessionProvider } from '../../store/ClassroomSessionContext';
import { ProjectProvider } from '../../store/ProjectContext';
import { ClassroomGuide } from './ClassroomGuide';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

const Wrapper = ({ projectId, children }: { projectId: string; children: React.ReactNode }) => <ProjectProvider><ClassroomSessionProvider projectId={projectId}>{children}</ClassroomSessionProvider></ProjectProvider>;

describe('ClassroomGuide', () => {
  it('routes the current construction step to the requested tool', async () => {
    const user = userEvent.setup();
    const onChooseTool = vi.fn();
    const project = createBlankProject();
    render(<Wrapper projectId={project.id}><ClassroomGuide project={project} onChooseTool={onChooseTool} /></Wrapper>);
    expect(screen.getByRole('progressbar', { name: /progreso del recorrido aula/i })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: /continuar construcción/i }));
    expect(onChooseTool).toHaveBeenCalledWith('node');
  });

  it('offers analysis immediately without reading legacy predictions', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    const project = createSimpleBeamExercise();
    render(<Wrapper projectId={project.id}><ClassroomGuide project={project} onAnalyze={onAnalyze} compact /></Wrapper>);
    expect(screen.queryByText(/predicci/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: /analizar estructura/i }));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });
});
