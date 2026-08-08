// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import type { AnalysisResult, ValidationIssue } from '../../types';
import { AnalysisStatus } from './AnalysisStatus';
import { deriveAnalysisStatus } from './analysisStatusModel';

const issue = (severity: ValidationIssue['severity']): ValidationIssue => ({
  id: `issue-${severity}`,
  severity,
  title: severity,
  message: severity,
});

const result = (success = true, issues: ValidationIssue[] = []): AnalysisResult => ({
  success,
  issues,
} as unknown as AnalysisResult);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});

afterEach(() => cleanup());

describe('deriveAnalysisStatus', () => {
  it('derives every visual state from existing analysis inputs', () => {
    expect(deriveAnalysisStatus({ analysis: null, isAnalyzing: false, hadAnalysis: false })).toBe('ready');
    expect(deriveAnalysisStatus({ analysis: null, isAnalyzing: true, hadAnalysis: false })).toBe('calculating');
    expect(deriveAnalysisStatus({ analysis: result(), isAnalyzing: false, hadAnalysis: false })).toBe('resolved');
    expect(deriveAnalysisStatus({ analysis: null, isAnalyzing: false, hadAnalysis: true })).toBe('stale');
    expect(deriveAnalysisStatus({ analysis: result(true, [issue('warning')]), isAnalyzing: false, hadAnalysis: false })).toBe('warning');
    expect(deriveAnalysisStatus({ analysis: result(false), isAnalyzing: false, hadAnalysis: false })).toBe('error');
    expect(deriveAnalysisStatus({ analysis: result(true, [issue('error')]), isAnalyzing: false, hadAnalysis: false })).toBe('error');
  });
});

describe('AnalysisStatus', () => {
  it('remembers a cleared result as stale only within the same project', () => {
    const props = { isAnalyzing: false, onOpenIssues: vi.fn() };
    const { rerender } = render(
      <ProjectProvider>
        <AnalysisStatus {...props} projectId="project-a" analysis={result()} />
      </ProjectProvider>,
    );

    expect(screen.getByRole('status').getAttribute('data-analysis-status')).toBe('resolved');
    expect(screen.getByLabelText('Análisis actualizado')).toBeTruthy();

    rerender(
      <ProjectProvider>
        <AnalysisStatus {...props} projectId="project-a" analysis={null} />
      </ProjectProvider>,
    );
    expect(screen.getByRole('status').getAttribute('data-analysis-status')).toBe('stale');
    expect(screen.getByLabelText('Resultados desactualizados')).toBeTruthy();

    rerender(
      <ProjectProvider>
        <AnalysisStatus {...props} projectId="project-b" analysis={null} />
      </ProjectProvider>,
    );
    expect(screen.getByRole('status').getAttribute('data-analysis-status')).toBe('ready');
    expect(screen.getByLabelText('Listo para analizar')).toBeTruthy();
  });

  it('exposes warning and error states as accessible actions', async () => {
    const user = userEvent.setup();
    const onOpenIssues = vi.fn();
    const { rerender } = render(
      <ProjectProvider>
        <AnalysisStatus projectId="project-a" analysis={result(true, [issue('warning')])} isAnalyzing={false} onOpenIssues={onOpenIssues} />
      </ProjectProvider>,
    );

    const warning = screen.getByRole('button', { name: /Revisar advertencias.*Abrir detalles del análisis/ });
    await user.click(warning);
    expect(onOpenIssues).toHaveBeenCalledOnce();

    rerender(
      <ProjectProvider>
        <AnalysisStatus projectId="project-a" analysis={result(false)} isAnalyzing={false} onOpenIssues={onOpenIssues} />
      </ProjectProvider>,
    );
    expect(screen.getByRole('button', { name: /No se pudo analizar.*Abrir detalles del análisis/ })).toBeTruthy();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });
});
