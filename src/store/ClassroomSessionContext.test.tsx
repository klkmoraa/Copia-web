// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClassroomSessionProvider, useClassroomSession } from './ClassroomSessionContext';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

const Probe = () => {
  const session = useClassroomSession();
  return <>
    <output data-testid="state">{session.revealState}</output>
    <output data-testid="predictions">{JSON.stringify(session.predictions)}</output>
    <output data-testid="signs">{JSON.stringify(session.signPredictions)}</output>
    <output data-testid="conclusion">{session.conclusion}</output>
    <output data-testid="requested">{String(session.analysisRequested)}</output>
    <button onClick={session.startPredicting}>Predecir</button>
    <button onClick={session.revealResults}>Revelar</button>
    <button onClick={() => session.setPrediction('M1', 'moment', 42)}>Predecir M</button>
    <button onClick={() => session.setPrediction('M1', 'moment', null)}>Borrar M</button>
    <button onClick={() => session.setSignPrediction('M1', 'moment', 'negative')}>Predecir signo M</button>
    <button onClick={() => session.setConclusion('La respuesta confirma la hipótesis.')}>Concluir</button>
    <button onClick={session.markAnalysisRequested}>Marcar análisis</button>
  </>;
};

describe('ClassroomSessionProvider', () => {
  it('stores finite numeric predictions and reveals results deliberately', async () => {
    const user = userEvent.setup();
    render(<ClassroomSessionProvider projectId="P1"><Probe /></ClassroomSessionProvider>);
    expect(screen.getByTestId('state').textContent).toBe('hidden');

    await user.click(screen.getByRole('button', { name: 'Predecir' }));
    await user.click(screen.getByRole('button', { name: 'Predecir M' }));
    expect(screen.getByTestId('state').textContent).toBe('predicting');
    expect(screen.getByTestId('predictions').textContent).toBe('{"M1":{"moment":42}}');

    await user.click(screen.getByRole('button', { name: 'Revelar' }));
    expect(screen.getByTestId('state').textContent).toBe('revealed');
    await user.click(screen.getByRole('button', { name: 'Borrar M' }));
    expect(screen.getByTestId('predictions').textContent).toBe('{}');
  });

  it('resets attempts and visibility when the project changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ClassroomSessionProvider projectId="P1"><Probe /></ClassroomSessionProvider>);
    await user.click(screen.getByRole('button', { name: 'Predecir M' }));
    await user.click(screen.getByRole('button', { name: 'Revelar' }));

    rerender(<ClassroomSessionProvider projectId="P2"><Probe /></ClassroomSessionProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('state').textContent).toBe('hidden');
      expect(screen.getByTestId('predictions').textContent).toBe('{}');
    });
  });

  it('persists the educational attempt per project without changing project data', async () => {
    const user = userEvent.setup();
    const first = render(<ClassroomSessionProvider projectId="P1"><Probe /></ClassroomSessionProvider>);
    await user.click(screen.getByRole('button', { name: 'Predecir signo M' }));
    await user.click(screen.getByRole('button', { name: 'Marcar análisis' }));
    await user.click(screen.getByRole('button', { name: 'Revelar' }));
    await user.click(screen.getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(localStorage.getItem('structureCo.classroom.session.v1:P1')).toContain('negative'));
    first.unmount();

    render(<ClassroomSessionProvider projectId="P1"><Probe /></ClassroomSessionProvider>);
    expect(screen.getByTestId('state').textContent).toBe('revealed');
    expect(screen.getByTestId('signs').textContent).toBe('{"M1":{"moment":"negative"}}');
    expect(screen.getByTestId('requested').textContent).toBe('true');
    expect(screen.getByTestId('conclusion').textContent).toContain('confirma');
  });

  it('invalidates the attempt when a previously valid physical analysis becomes stale', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ClassroomSessionProvider projectId="P1" analysisAvailable><Probe /></ClassroomSessionProvider>);
    await user.click(screen.getByRole('button', { name: 'Predecir M' }));
    await user.click(screen.getByRole('button', { name: 'Predecir signo M' }));
    await user.click(screen.getByRole('button', { name: 'Marcar análisis' }));
    await user.click(screen.getByRole('button', { name: 'Revelar' }));

    rerender(<ClassroomSessionProvider projectId="P1" analysisAvailable={false}><Probe /></ClassroomSessionProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('state').textContent).toBe('hidden');
      expect(screen.getByTestId('predictions').textContent).toBe('{}');
      expect(screen.getByTestId('signs').textContent).toBe('{}');
      expect(screen.getByTestId('requested').textContent).toBe('false');
    });
  });
});
