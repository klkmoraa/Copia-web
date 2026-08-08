// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { ProjectProvider, useProject } from './ProjectContext';

const TransactionHarness = () => {
  const {
    project,
    canUndo,
    beginProjectTransaction,
    updateProjectTransient,
    commitProjectTransaction,
    cancelProjectTransaction,
    undo,
  } = useProject();
  const move = () => updateProjectTransient((draft) => {
    draft.nodes[0].x += 1;
    return draft;
  });
  return <>
    <output aria-label="x-coordinate">{project.nodes[0].x}</output>
    <output aria-label="can-undo">{String(canUndo)}</output>
    <button onClick={beginProjectTransaction}>begin</button>
    <button onClick={move}>move</button>
    <button onClick={commitProjectTransaction}>commit</button>
    <button onClick={cancelProjectTransaction}>cancel</button>
    <button onClick={undo}>undo</button>
  </>;
};

const AnalysisHarness = () => {
  const { project, analysis, analyze, updateProject, setSelectedCombinationId, canUndo, undo } = useProject();
  return <>
    <output aria-label="analysis-state">{analysis ? (analysis.success ? 'success' : 'failed') : 'none'}</output>
    <output aria-label="analysis-node-count">{project.nodes.length}</output>
    <output aria-label="analysis-member-count">{project.members.length}</output>
    <output aria-label="analysis-issues">{analysis?.issues.map((issue) => issue.id).join(',') ?? ''}</output>
    <output aria-label="analysis-can-undo">{String(canUndo)}</output>
    <button onClick={analyze}>analyze</button>
    <button onClick={() => updateProject((draft) => ({ ...draft, name: `${draft.name} editado` }))}>edit</button>
    <button onClick={() => setSelectedCombinationId(project.combinations[0]?.id ?? '')}>combination</button>
    <button onClick={undo}>undo-analysis</button>
  </>;
};

const DirectHistoryHarness = () => {
  const { project, canUndo, updateProject, undo } = useProject();
  return <><output aria-label="node-count">{project.nodes.length}</output><output aria-label="direct-can-undo">{String(canUndo)}</output><button onClick={() => updateProject((draft) => { draft.nodes.push({ id: `N${draft.nodes.length + 1}`, x: 9, y: 9, support: { type: 'none' } }); return draft; })}>add-direct</button><button onClick={undo}>undo-direct</button></>;
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ProjectContext transactions', () => {
  it('keeps direct edit history correct under React StrictMode', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<StrictMode><ProjectProvider><DirectHistoryHarness /></ProjectProvider></StrictMode>);
    const initial = Number(screen.getByLabelText('node-count').textContent);
    await user.click(screen.getByText('add-direct'));
    expect(Number(screen.getByLabelText('node-count').textContent)).toBe(initial + 1);
    expect(screen.getByLabelText('direct-can-undo').textContent).toBe('true');
    await user.click(screen.getByText('undo-direct'));
    expect(Number(screen.getByLabelText('node-count').textContent)).toBe(initial);
  });

  it('groups all transient drag updates into one undo entry', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><TransactionHarness /></ProjectProvider>);
    const initial = Number(screen.getByLabelText('x-coordinate').textContent);

    await user.click(screen.getByText('begin'));
    await user.click(screen.getByText('move'));
    await user.click(screen.getByText('move'));
    await user.click(screen.getByText('commit'));

    expect(Number(screen.getByLabelText('x-coordinate').textContent)).toBe(initial + 2);
    expect(screen.getByLabelText('can-undo').textContent).toBe('true');
    await user.click(screen.getByText('undo'));
    expect(Number(screen.getByLabelText('x-coordinate').textContent)).toBe(initial);
    expect(screen.getByLabelText('can-undo').textContent).toBe('false');
  });

  it('restores the transaction origin when a pointer gesture is cancelled', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><TransactionHarness /></ProjectProvider>);
    const initial = Number(screen.getByLabelText('x-coordinate').textContent);
    await user.click(screen.getByText('begin'));
    await user.click(screen.getByText('move'));
    await user.click(screen.getByText('cancel'));
    expect(Number(screen.getByLabelText('x-coordinate').textContent)).toBe(initial);
    expect(screen.getByLabelText('can-undo').textContent).toBe('false');
  });
});

describe('ProjectContext analysis lifecycle', () => {
  it('discards pending results after an edit and clears results when the combination changes', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><AnalysisHarness /></ProjectProvider>);

    await user.click(screen.getByText('analyze'));
    await user.click(screen.getByText('edit'));
    await new Promise((resolve) => window.setTimeout(resolve, 70));
    expect(screen.getByLabelText('analysis-state').textContent).toBe('none');

    await user.click(screen.getByText('analyze'));
    await waitFor(() => expect(screen.getByLabelText('analysis-state').textContent).toBe('success'));
    await user.click(screen.getByText('combination'));
    expect(screen.getByLabelText('analysis-state').textContent).toBe('none');
  });

  it('repairs legacy coincident nodes and interior supports as one undoable analysis step', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.nodes = [
      { id: 'N1', x: 0, y: 0, support: { type: 'pin' } },
      { id: 'N2', x: 8, y: 0, support: { type: 'none' } },
      { id: 'N3', x: 0, y: 0, support: { type: 'none' } },
      { id: 'N4', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
    ];
    project.members = [{ id: 'M1', i: 'N1', j: 'N2', type: 'frame', E: 200e6, A: 0.01, I: 8e-5, releases: { iMoment: true, jMoment: true } }];
    project.memberLoads = [{ id: 'P', memberId: 'M1', caseId: 'LC1', type: 'point', coordinateSystem: 'global', lengthBasis: 'real', start: 0, end: 1, px: 0, py: -40, position: 0.5 }];
    localStorage.setItem('structureCo.project', JSON.stringify(project));
    render(<ProjectProvider><AnalysisHarness /></ProjectProvider>);

    await user.click(screen.getByText('analyze'));
    await waitFor(() => expect(screen.getByLabelText('analysis-state').textContent).toBe('success'));
    expect(screen.getByLabelText('analysis-node-count').textContent).toBe('3');
    expect(screen.getByLabelText('analysis-member-count').textContent).toBe('2');
    expect(screen.getByLabelText('analysis-issues').textContent).toContain('topology-auto-repair');
    expect(screen.getByLabelText('analysis-can-undo').textContent).toBe('true');

    await user.click(screen.getByText('undo-analysis'));
    expect(screen.getByLabelText('analysis-node-count').textContent).toBe('4');
    expect(screen.getByLabelText('analysis-member-count').textContent).toBe('1');
    expect(screen.getByLabelText('analysis-state').textContent).toBe('none');
  });
});
