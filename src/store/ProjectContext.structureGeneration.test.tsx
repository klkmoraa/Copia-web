// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectCommandSnapshot } from '../commands/projectCommand';
import {
  prepareStructureGeneration,
  type PreparedStructureGeneration,
} from '../commands/structureGeneration';
import { createDefaultProject } from '../data/defaultProject';
import { findGeneratorFixture } from '../data/generators/generatorFixtures';
import { unavailableAnalysis } from '../engine/analysisFailure';
import type { ProjectModel } from '../types';
import { ProjectProvider, useProject } from './ProjectContext';

const PARAMS = findGeneratorFixture('multi-story-frame-two-levels').params;

const Harness = () => {
  const {
    project, analysis, canUndo, canRedo, executePreparedStructureGeneration,
    renameProject, replaceProject, undo, redo,
  } = useProject();
  const preparedRef = useRef<PreparedStructureGeneration | null>(null);
  const [target, setTarget] = useState('');
  const [created, setCreated] = useState('');
  const [error, setError] = useState('');

  const prepare = () => {
    preparedRef.current = prepareStructureGeneration(project, PARAMS);
    setTarget(preparedRef.current.previewSnapshot);
    setError('');
  };
  const apply = async () => {
    try {
      if (!preparedRef.current) throw new Error('Falta preview');
      const result = await executePreparedStructureGeneration(preparedRef.current);
      setCreated(`${result.nodeIds.length}/${result.memberIds.length}`);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return <>
    <output aria-label="gen-project">{projectCommandSnapshot(project)}</output>
    <output aria-label="gen-target">{target}</output>
    <output aria-label="gen-created">{created}</output>
    <output aria-label="gen-nodes">{String(project.nodes.length)}</output>
    <output aria-label="gen-analysis">{analysis ? 'present' : 'none'}</output>
    <output aria-label="gen-can-undo">{String(canUndo)}</output>
    <output aria-label="gen-can-redo">{String(canRedo)}</output>
    <output aria-label="gen-error">{error}</output>
    <button onClick={prepare}>gen-prepare</button>
    <button onClick={apply}>gen-apply</button>
    <button onClick={() => renameProject(`${project.name} movido`)}>gen-rename</button>
    <button onClick={() => replaceProject(project, unavailableAnalysis('fixture result'))}>gen-seed-analysis</button>
    <button onClick={undo}>gen-undo</button>
    <button onClick={redo}>gen-redo</button>
  </>;
};

const renderHarness = (project: ProjectModel = createDefaultProject()) => {
  localStorage.setItem('structureCo.project', JSON.stringify(project));
  return render(<ProjectProvider><Harness /></ProjectProvider>);
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ProjectContext prepared structure generation', () => {
  it('commits the whole geometry as a single undo/redo step', async () => {
    const user = userEvent.setup();
    renderHarness();
    const original = screen.getByLabelText('gen-project').textContent!;
    const originalNodes = screen.getByLabelText('gen-nodes').textContent!;

    await user.click(screen.getByText('gen-prepare'));
    const target = screen.getByLabelText('gen-target').textContent!;
    // Preparing shows the result without touching the model.
    expect(screen.getByLabelText('gen-project').textContent).toBe(original);
    expect(screen.getByLabelText('gen-can-undo').textContent).toBe('false');

    await user.click(screen.getByText('gen-apply'));
    await waitFor(() => expect(screen.getByLabelText('gen-project').textContent).toBe(target));
    // 3 ejes × 3 niveles: 9 nudos y, por entrepiso, 3 columnas más 2 vigas.
    expect(screen.getByLabelText('gen-created').textContent).toBe('9/10');
    expect(screen.getByLabelText('gen-can-undo').textContent).toBe('true');

    // One undo returns the whole batch, not one member at a time.
    await user.click(screen.getByText('gen-undo'));
    expect(screen.getByLabelText('gen-project').textContent).toBe(original);
    expect(screen.getByLabelText('gen-nodes').textContent).toBe(originalNodes);
    expect(screen.getByLabelText('gen-can-undo').textContent).toBe('false');
    expect(screen.getByLabelText('gen-can-redo').textContent).toBe('true');

    await user.click(screen.getByText('gen-redo'));
    expect(screen.getByLabelText('gen-project').textContent).toBe(target);
    expect(screen.getByLabelText('gen-can-redo').textContent).toBe('false');
  });

  it('rejects a stale preview without mutation, history or result invalidation', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByText('gen-seed-analysis'));
    expect(screen.getByLabelText('gen-analysis').textContent).toBe('present');
    const historyBefore = screen.getByLabelText('gen-can-undo').textContent;

    await user.click(screen.getByText('gen-prepare'));
    await user.click(screen.getByText('gen-rename'));
    const stale = screen.getByLabelText('gen-project').textContent;

    await user.click(screen.getByText('gen-apply'));

    await waitFor(() => expect(screen.getByLabelText('gen-error').textContent).toMatch(/obsolet/i));
    expect(screen.getByLabelText('gen-project').textContent).toBe(stale);
    expect(screen.getByLabelText('gen-can-undo').textContent).toBe(historyBefore);
    expect(screen.getByLabelText('gen-analysis').textContent).toBe('present');
  });

  it('keeps the current result while previewing and invalidates it only on commit', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByText('gen-seed-analysis'));
    expect(screen.getByLabelText('gen-analysis').textContent).toBe('present');

    await user.click(screen.getByText('gen-prepare'));
    expect(screen.getByLabelText('gen-analysis').textContent).toBe('present');

    await user.click(screen.getByText('gen-apply'));

    await waitFor(() => expect(screen.getByLabelText('gen-analysis').textContent).toBe('none'));
  });

  it('leaves the model untouched when a preview is prepared and never confirmed', async () => {
    const user = userEvent.setup();
    renderHarness();
    const original = screen.getByLabelText('gen-project').textContent!;

    await user.click(screen.getByText('gen-prepare'));
    await user.click(screen.getByText('gen-prepare'));

    expect(screen.getByLabelText('gen-project').textContent).toBe(original);
    expect(screen.getByLabelText('gen-can-undo').textContent).toBe('false');
    expect(screen.getByLabelText('gen-can-redo').textContent).toBe('false');
  });

  it('undoes back to the exact snapshot the preview was prepared against', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByText('gen-prepare'));
    const source = screen.getByLabelText('gen-project').textContent!;
    await user.click(screen.getByText('gen-apply'));
    await waitFor(() => expect(screen.getByLabelText('gen-can-undo').textContent).toBe('true'));
    const generated = screen.getByLabelText('gen-project').textContent!;

    await user.click(screen.getByText('gen-undo'));
    expect(screen.getByLabelText('gen-project').textContent).toBe(source);
    await user.click(screen.getByText('gen-redo'));
    expect(screen.getByLabelText('gen-project').textContent).toBe(generated);
  });

  it('chains two generations as two independent undo steps', async () => {
    const user = userEvent.setup();
    renderHarness();
    const original = screen.getByLabelText('gen-project').textContent!;

    await user.click(screen.getByText('gen-prepare'));
    await user.click(screen.getByText('gen-apply'));
    await waitFor(() => expect(screen.getByLabelText('gen-can-undo').textContent).toBe('true'));
    const afterFirst = screen.getByLabelText('gen-project').textContent!;

    await user.click(screen.getByText('gen-prepare'));
    await user.click(screen.getByText('gen-apply'));
    await waitFor(() => expect(screen.getByLabelText('gen-project').textContent).not.toBe(afterFirst));
    expect(screen.getByLabelText('gen-nodes').textContent).toBe('22');

    await user.click(screen.getByText('gen-undo'));
    expect(screen.getByLabelText('gen-project').textContent).toBe(afterFirst);
    await user.click(screen.getByText('gen-undo'));
    expect(screen.getByLabelText('gen-project').textContent).toBe(original);
  });
});
