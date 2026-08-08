// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '../../data/defaultProject';
import { createSimpleBeamExercise } from '../../education/exerciseTemplates';
import { ClassroomSessionProvider, useClassroomSession } from '../../store/ClassroomSessionContext';
import { ProjectProvider } from '../../store/ProjectContext';
import { ClassroomGuide } from './ClassroomGuide';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

const Wrapper = ({ projectId, children }: { projectId: string; children: React.ReactNode }) => <ProjectProvider><ClassroomSessionProvider projectId={projectId}>{children}</ClassroomSessionProvider></ProjectProvider>;

const PredictionSetup = () => {
  const session = useClassroomSession();
  return <button onClick={() => session.setSignPrediction('M1', 'moment', 'negative')}>Registrar hipótesis</button>;
};

describe('ClassroomGuide', () => {
  it('routes the current construction step to the requested tool', async () => {
    const user = userEvent.setup();
    const onChooseTool = vi.fn();
    const project = createBlankProject();
    render(<Wrapper projectId={project.id}><ClassroomGuide project={project} onChooseTool={onChooseTool} /></Wrapper>);
    expect(screen.getByRole('progressbar', { name: /progreso del recorrido aula/i })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    await user.click(screen.getByRole('button', { name: /continuar construcción/i }));
    expect(onChooseTool).toHaveBeenCalledWith('node');
  });

  it('requires a prediction before offering the existing analysis action', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    const project = createSimpleBeamExercise();
    render(<Wrapper projectId={project.id}><PredictionSetup /><ClassroomGuide project={project} onAnalyze={onAnalyze} compact /></Wrapper>);
    expect(screen.getByRole('button', { name: /registrar predicción/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /analizar estructura/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Registrar hipótesis' }));
    await user.click(screen.getByRole('button', { name: /analizar estructura/i }));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });
});
