// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { ProjectProvider, useProject } from './ProjectContext';

// The solver chunk is loaded lazily. A rejected import (stale deploy, offline
// tab) must surface as a readable failure instead of an endless "analysing".
vi.mock('../engine/solver', () => ({
  analyzeProject: () => {
    throw new Error('No se pudo cargar el módulo de análisis.');
  },
}));

const FailureHarness = () => {
  const { analysis, isAnalyzing, analyze } = useProject();
  return <>
    <output aria-label="analysis-state">{analysis ? (analysis.success ? 'success' : 'failed') : 'none'}</output>
    <output aria-label="analysis-busy">{String(isAnalyzing)}</output>
    <output aria-label="analysis-issues">{analysis?.issues.map((issue) => issue.id).join(',') ?? ''}</output>
    <output aria-label="analysis-message">{analysis?.issues.map((issue) => issue.message).join(' | ') ?? ''}</output>
    <button onClick={analyze}>analyze</button>
  </>;
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ProjectContext analysis failures', () => {
  it('reports a readable failure instead of staying busy forever when the analysis cannot run', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><FailureHarness /></ProjectProvider>);

    await user.click(screen.getByText('analyze'));

    await waitFor(() => expect(screen.getByLabelText('analysis-state').textContent).toBe('failed'));
    expect(screen.getByLabelText('analysis-busy').textContent).toBe('false');
    expect(screen.getByLabelText('analysis-issues').textContent).toContain('analysis-failed');
    expect(screen.getByLabelText('analysis-message').textContent).toContain('No se pudo cargar el módulo de análisis.');
  });

  it('surfaces a worker reported failure instead of silently recomputing it on the main thread', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    const posted: unknown[] = [];
    class StubWorker {
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      postMessage(message: { requestId: number }) {
        posted.push(message);
        window.setTimeout(() => {
          this.onmessage?.({
            data: { type: 'analysis-error', requestId: message.requestId, message: 'Restricciones cinemáticas incompatibles.' },
          } as MessageEvent<unknown>);
        }, 0);
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', StubWorker);
    try {
      render(<ProjectProvider><FailureHarness /></ProjectProvider>);
      await user.click(screen.getByText('analyze'));

      await waitFor(() => expect(screen.getByLabelText('analysis-state').textContent).toBe('failed'));
      expect(posted).toHaveLength(1);
      expect(screen.getByLabelText('analysis-busy').textContent).toBe('false');
      expect(screen.getByLabelText('analysis-issues').textContent).toContain('analysis-failed');
      expect(screen.getByLabelText('analysis-message').textContent).toContain('Restricciones cinemáticas incompatibles.');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
