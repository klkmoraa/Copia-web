// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import type { AnalysisResult, ResultReliability, ValidationIssue } from '../../types';
import { AnalysisStatus } from './AnalysisStatus';
import { deriveAnalysisStatus } from './analysisStatusModel';

/**
 * D-14 (CRI-95 → CRI-100): the governing reliability cause is tested by
 * injecting a synthetic `ResultReliability`, not by forcing the solver into a
 * real ill-conditioned state — the solver is unrelated to this chrome slice.
 * `resolveReliability` stays the real authority except when a test overrides it.
 */
const reliabilityOverride = vi.hoisted(() => ({ current: null as ResultReliability | null }));
vi.mock('../../engine/reliability', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../engine/reliability')>();
  return {
    ...actual,
    resolveReliability: (result: Parameters<typeof actual.resolveReliability>[0]) =>
      reliabilityOverride.current ?? actual.resolveReliability(result),
  };
});

const issue = (severity: ValidationIssue['severity']): ValidationIssue => ({
  id: `issue-${severity}`,
  severity,
  title: severity,
  message: severity,
});

const result = (success = true, issues: ValidationIssue[] = []): AnalysisResult => ({
  success,
  issues,
  displacements: [],
  nodeResults: [],
} as unknown as AnalysisResult);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});

afterEach(() => {
  cleanup();
  reliabilityOverride.current = null;
});

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
    const props = { isAnalyzing: false, onOpenModelDoctor: vi.fn() };
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
    const onOpenModelDoctor = vi.fn();
    const { rerender } = render(
      <ProjectProvider>
        <AnalysisStatus projectId="project-a" analysis={result(true, [issue('warning')])} isAnalyzing={false} onOpenModelDoctor={onOpenModelDoctor} />
      </ProjectProvider>,
    );

    const warning = screen.getByRole('button', { name: /Revisar advertencias.*Abrir Model Doctor/ });
    await user.click(warning);
    expect(onOpenModelDoctor).toHaveBeenCalledOnce();

    rerender(
      <ProjectProvider>
        <AnalysisStatus projectId="project-a" analysis={result(false)} isAnalyzing={false} onOpenModelDoctor={onOpenModelDoctor} />
      </ProjectProvider>,
    );
    expect(screen.getByRole('button', { name: /No se pudo analizar.*Abrir Model Doctor/ })).toBeTruthy();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });
});

describe('Reliability line and governing cause (D-14 · CRI-95 → CRI-100)', () => {
  const governingCheck = {
    id: 'condition' as const,
    label: 'Condición κ₁ del sistema equilibrado',
    value: 5e11,
    limitedAbove: 1e10,
    unreliableAbove: 1e12,
    level: 'limited' as const,
    message: 'Condición κ₁ del sistema equilibrado: 5.000e+11 supera 1e+10.',
  };

  it('shows reliability as its own line, never as the status pill color', () => {
    reliabilityOverride.current = {
      completed: true,
      usable: true,
      level: 'limited',
      checks: [governingCheck],
      governing: governingCheck,
      reasons: [governingCheck.message],
    };
    render(
      <ProjectProvider>
        <AnalysisStatus projectId="project-a" analysis={result()} isAnalyzing={false} onOpenModelDoctor={vi.fn()} />
      </ProjectProvider>,
    );

    // `success` (the pill, still `resolved`) and `reliable` never collapse into one
    // shared element: the reliability text lives outside the status pill's aria-live
    // region, as a distinct line with its own text.
    expect(screen.getByRole('status').getAttribute('data-analysis-status')).toBe('resolved');
    const line = document.querySelector('.analysis-reliability-line')!;
    expect(line).toBeTruthy();
    expect(line.closest('[role="status"]')).toBeNull();
    expect(within(line as HTMLElement).getByText('Limitada')).toBeTruthy();
  });

  it('never relies on a title as the only source of the governing cause', async () => {
    const user = userEvent.setup();
    reliabilityOverride.current = {
      completed: true,
      usable: true,
      level: 'limited',
      checks: [governingCheck],
      governing: governingCheck,
      reasons: [governingCheck.message],
    };
    render(
      <ProjectProvider>
        <AnalysisStatus projectId="project-a" analysis={result()} isAnalyzing={false} onOpenModelDoctor={vi.fn()} />
      </ProjectProvider>,
    );

    const line = document.querySelector('.analysis-reliability-line')!;
    expect(line.getAttribute('title')).toBeNull();

    // Alcanzable con Tab, no sólo con mouse/hover.
    const trigger = screen.getByRole('button', { name: 'Ver causa de fiabilidad' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    const cause = await screen.findByRole('dialog', { name: 'Ver causa de fiabilidad' });
    expect(within(cause).getByText('Qué pasa')).toBeTruthy();
    expect(within(cause).getByText('Por qué')).toBeTruthy();
    expect(within(cause).getByText(/Condición numérica del sistema.*supera/)).toBeTruthy();
    expect(within(cause).getByText('Qué hacer')).toBeTruthy();
    expect(within(cause).getByText(/Model Doctor/)).toBeTruthy();

    // The status pill keeps the only `aria-live` region in this cluster; the
    // governing cause lives in a plain `dialog`, outside it, so opening it never
    // re-triggers the status announcement (risk called out in the issue).
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    expect(cause.getAttribute('aria-live')).toBeNull();
    expect(cause.querySelector('[aria-live]')).toBeNull();
    expect(cause.closest('[role="status"]')).toBeNull();
  }, 10_000);

  it('renders no governing-cause trigger when every check is reliable', () => {
    reliabilityOverride.current = {
      completed: true, usable: true, level: 'reliable', checks: [], reasons: [],
    };
    render(
      <ProjectProvider>
        <AnalysisStatus projectId="project-a" analysis={result()} isAnalyzing={false} onOpenModelDoctor={vi.fn()} />
      </ProjectProvider>,
    );

    expect(screen.queryByRole('button', { name: 'Ver causa de fiabilidad' })).toBeNull();
  });

  it('shows no reliability line while analyzing or with no analysis yet', () => {
    render(
      <ProjectProvider>
        <AnalysisStatus projectId="project-a" analysis={null} isAnalyzing={true} onOpenModelDoctor={vi.fn()} />
      </ProjectProvider>,
    );
    expect(document.querySelector('.analysis-reliability-line')).toBeNull();
  });
});
