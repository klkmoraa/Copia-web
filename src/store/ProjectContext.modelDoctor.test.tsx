// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  prepareTopologyRepairCommand,
  projectCommandSnapshot,
  type PreparedTopologyRepair,
} from '../commands/projectCommand';
import { createDefaultProject } from '../data/defaultProject';
import { unavailableAnalysis } from '../engine/analysisFailure';
import type { ProjectModel } from '../types';
import { ProjectProvider, useProject } from './ProjectContext';

const repairableProject = (): ProjectModel => {
  const project = createDefaultProject();
  project.nodes.push({ id: 'N-DUP', x: project.nodes[0].x, y: project.nodes[0].y, support: { type: 'none' }, internalHinge: true });
  project.nodes.push({ id: 'N-SPLIT', x: 3, y: 4, support: { type: 'fixed' } });
  project.nodalLoads.push({ id: 'NL-DUP', nodeId: 'N-DUP', caseId: 'LC1', fx: 2, fy: 0, mz: 0 });
  project.prescribedDisplacements = [
    ...(project.prescribedDisplacements ?? []),
    { id: 'PD-DUP', nodeId: 'N-DUP', caseId: 'LC1', component: 'ux', value: 0.002 },
  ];
  project.memberInitialEffects = [{ id: 'IE-M2', memberId: 'M2', caseId: 'LC1', type: 'temperature', alpha: 1.2e-5, deltaT: 20, gradient: 1 }];
  return project;
};

const Harness = () => {
  const {
    project, analysis, canUndo, canRedo, executePreparedTopologyRepair,
    renameProject, replaceProject, updateProject, undo, redo,
  } = useProject();
  const preparedRef = useRef<PreparedTopologyRepair | null>(null);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const prepare = () => {
    preparedRef.current = prepareTopologyRepairCommand(project);
    setTarget(preparedRef.current.repairedSnapshot);
    setError('');
  };
  const apply = async () => {
    try {
      if (!preparedRef.current) throw new Error('Falta preview');
      await executePreparedTopologyRepair(preparedRef.current);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return <>
    <output aria-label="doctor-project">{projectCommandSnapshot(project)}</output>
    <output aria-label="doctor-target">{target}</output>
    <output aria-label="doctor-analysis">{analysis ? 'present' : 'none'}</output>
    <output aria-label="doctor-can-undo">{String(canUndo)}</output>
    <output aria-label="doctor-can-redo">{String(canRedo)}</output>
    <output aria-label="doctor-error">{error}</output>
    <button onClick={prepare}>doctor-prepare</button>
    <button onClick={apply}>doctor-apply</button>
    <button onClick={() => renameProject(`${project.name} stale`)}>doctor-rename</button>
    <button onClick={() => updateProject((current) => ({
      ...current,
      nodes: [...current.nodes, { id: 'SESSION-NODE', x: 30, y: 30, support: { type: 'none' } }],
    }))}>doctor-add-session-node</button>
    <button onClick={() => replaceProject(project, unavailableAnalysis('fixture result'))}>doctor-seed-analysis</button>
    <button onClick={undo}>doctor-undo</button>
    <button onClick={redo}>doctor-redo</button>
  </>;
};

const renderHarness = (project: ProjectModel) => {
  localStorage.setItem('structureCo.project', JSON.stringify(project));
  return render(<ProjectProvider><Harness /></ProjectProvider>);
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ProjectContext prepared topology repair', () => {
  it('publishes exactly the preview as one reversible undo/redo intention', async () => {
    const user = userEvent.setup();
    renderHarness(repairableProject());
    const original = screen.getByLabelText('doctor-project').textContent!;

    await user.click(screen.getByText('doctor-prepare'));
    const target = screen.getByLabelText('doctor-target').textContent!;
    expect(screen.getByLabelText('doctor-project').textContent).toBe(original);
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe('false');

    await user.click(screen.getByText('doctor-apply'));
    await waitFor(() => expect(screen.getByLabelText('doctor-project').textContent).toBe(target));
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe('true');

    await user.click(screen.getByText('doctor-undo'));
    expect(screen.getByLabelText('doctor-project').textContent).toBe(original);
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe('false');
    expect(screen.getByLabelText('doctor-can-redo').textContent).toBe('true');

    await user.click(screen.getByText('doctor-redo'));
    expect(screen.getByLabelText('doctor-project').textContent).toBe(target);
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe('true');
  });

  it('rejects a globally stale preview without mutation, history, or analysis invalidation', async () => {
    const user = userEvent.setup();
    renderHarness(repairableProject());
    await user.click(screen.getByText('doctor-seed-analysis'));
    expect(screen.getByLabelText('doctor-analysis').textContent).toBe('present');
    const historyBefore = screen.getByLabelText('doctor-can-undo').textContent;
    await user.click(screen.getByText('doctor-prepare'));
    await user.click(screen.getByText('doctor-rename'));
    const stale = screen.getByLabelText('doctor-project').textContent;

    await user.click(screen.getByText('doctor-apply'));

    await waitFor(() => expect(screen.getByLabelText('doctor-error').textContent).toMatch(/preview.*obsoleto/i));
    expect(screen.getByLabelText('doctor-project').textContent).toBe(stale);
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe(historyBefore);
    expect(screen.getByLabelText('doctor-analysis').textContent).toBe('present');
  });

  it('keeps a result during preview and invalidates it only after successful apply', async () => {
    const user = userEvent.setup();
    renderHarness(repairableProject());
    await user.click(screen.getByText('doctor-seed-analysis'));
    expect(screen.getByLabelText('doctor-analysis').textContent).toBe('present');
    await user.click(screen.getByText('doctor-prepare'));
    expect(screen.getByLabelText('doctor-analysis').textContent).toBe('present');

    await user.click(screen.getByText('doctor-apply'));

    await waitFor(() => expect(screen.getByLabelText('doctor-analysis').textContent).toBe('none'));
  });

  it('does not create history or invalidate analysis when the prepared repair has no changes', async () => {
    const user = userEvent.setup();
    renderHarness(createDefaultProject());
    await user.click(screen.getByText('doctor-seed-analysis'));
    await user.click(screen.getByText('doctor-prepare'));
    await user.click(screen.getByText('doctor-apply'));

    expect(screen.getByLabelText('doctor-analysis').textContent).toBe('present');
    // replaceProject creates the opening checkpoint; the no-op repair adds none.
    await user.click(screen.getByText('doctor-undo'));
    expect(screen.getByLabelText('doctor-can-undo').textContent).toBe('false');
  });

  it('redoes the exact prepared state when the session source contains an absent optional property', async () => {
    const user = userEvent.setup();
    renderHarness(repairableProject());
    await user.click(screen.getByText('doctor-add-session-node'));
    const source = screen.getByLabelText('doctor-project').textContent!;
    await user.click(screen.getByText('doctor-prepare'));
    const repaired = screen.getByLabelText('doctor-target').textContent!;
    await user.click(screen.getByText('doctor-apply'));
    expect(screen.getByLabelText('doctor-project').textContent).toBe(repaired);

    await user.click(screen.getByText('doctor-undo'));
    expect(screen.getByLabelText('doctor-project').textContent).toBe(source);
    await user.click(screen.getByText('doctor-redo'));

    expect(screen.getByLabelText('doctor-project').textContent).toBe(repaired);
  });
});
