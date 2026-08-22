// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { ProjectProvider, useProject } from './ProjectContext';
import type { ProjectCommand } from '../commands/projectCommand';
import { prepareStructuralEdit, type PreparedStructuralEdit } from '../data/structuralEditing';

const TransactionHarness = () => {
  const {
    project,
    analysis,
    canUndo,
    analyze,
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
    <output aria-label="transaction-analysis-state">{analysis ? (analysis.success ? 'success' : 'failed') : 'none'}</output>
    <output aria-label="can-undo">{String(canUndo)}</output>
    <button onClick={analyze}>transaction-analyze</button>
    <button onClick={() => beginProjectTransaction()}>begin</button>
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

const AnalysisSettingsHarness = () => {
  const {
    project,
    analysis,
    isAnalyzing,
    canUndo,
    canRedo,
    analyze,
    updateProject,
    updateProjectAnalysisSettings,
    updateProjectView,
    undo,
    redo,
  } = useProject();
  return <>
    <output aria-label="settings-analysis-state">{analysis ? (analysis.success ? 'success' : 'failed') : 'none'}</output>
    <output aria-label="settings-is-analyzing">{String(isAnalyzing)}</output>
    <output aria-label="settings-analysis-mode">{project.settings.analysisMode ?? 'first-order'}</output>
    <output aria-label="settings-max-load-steps">{project.settings.pDeltaConfig?.maxLoadSteps ?? ''}</output>
    <output aria-label="settings-project-name">{project.name}</output>
    <output aria-label="settings-can-undo">{String(canUndo)}</output>
    <output aria-label="settings-can-redo">{String(canRedo)}</output>
    <button onClick={analyze}>settings-analyze</button>
    <button onClick={() => updateProjectAnalysisSettings((settings) => ({ ...settings, analysisMode: 'p-delta' }))}>settings-p-delta</button>
    <button onClick={() => updateProjectAnalysisSettings((settings) => ({
      ...settings,
      pDeltaConfig: { ...settings.pDeltaConfig, maxLoadSteps: 17 },
    }))}>settings-p-delta-steps</button>
    <button onClick={() => updateProjectView((draft) => ({
      ...draft,
      settings: { ...draft.settings, units: 'N-mm' },
    }))}>settings-view-preference</button>
    <button onClick={() => updateProject((draft) => ({ ...draft, name: 'Proyecto editado' }))}>settings-edit</button>
    <button onClick={undo}>settings-undo</button>
    <button onClick={redo}>settings-redo</button>
  </>;
};

const CommandHistoryHarness = () => {
  const { project, analysis, canUndo, canRedo, analyze, executeProjectCommand, undo, redo } = useProject();
  const createMember = async () => {
    const source = project.members[0];
    const command: ProjectCommand = {
      kind: 'member.create', description: 'Crear miembro command', nodes: [],
      member: { ...structuredClone(source), id: 'M-command', i: source.i, j: source.j },
    };
    await executeProjectCommand(command);
  };
  return <>
    <output aria-label="command-members">{project.members.length}</output>
    <output aria-label="command-analysis-state">{analysis ? (analysis.success ? 'success' : 'failed') : 'none'}</output>
    <output aria-label="command-undo">{String(canUndo)}</output>
    <output aria-label="command-redo">{String(canRedo)}</output>
    <button onClick={analyze}>command-analyze</button>
    <button onClick={createMember}>command-create</button>
    <button onClick={undo}>command-undo-action</button>
    <button onClick={redo}>command-redo-action</button>
  </>;
};

const SpecialBoundaryHarness = () => {
  const { project, analysis, canUndo, analyze, renameProject, replaceProject, undo } = useProject();
  const replace = () => {
    const next = createDefaultProject();
    next.id = 'replaced-project';
    next.name = 'Proyecto reemplazado';
    replaceProject(next);
  };
  return <>
    <output aria-label="boundary-project-name">{project.name}</output>
    <output aria-label="boundary-analysis-state">{analysis ? (analysis.success ? 'success' : 'failed') : 'none'}</output>
    <output aria-label="boundary-can-undo">{String(canUndo)}</output>
    <button onClick={analyze}>boundary-analyze</button>
    <button onClick={() => renameProject('Proyecto renombrado')}>boundary-rename</button>
    <button onClick={replace}>boundary-replace</button>
    <button onClick={undo}>boundary-undo</button>
  </>;
};

const TopologyCommandHarness = () => {
  const { project, analysis, canUndo, canRedo, analyze, executeProjectCommand, undo, redo } = useProject();
  const [resultNodeId, setResultNodeId] = useState('');
  const split = async () => {
    const result = await executeProjectCommand({
      kind: 'member.split', description: 'Dividir miembro desde Context', memberId: project.members[0].id, ratio: 0.5,
    });
    if (result?.kind === 'member.split') setResultNodeId(result.nodeId);
  };
  return <>
    <output aria-label="topology-nodes">{project.nodes.length}</output>
    <output aria-label="topology-members">{project.members.length}</output>
    <output aria-label="topology-result-node">{resultNodeId}</output>
    <output aria-label="topology-analysis">{analysis ? (analysis.success ? 'success' : 'failed') : 'none'}</output>
    <output aria-label="topology-can-undo">{String(canUndo)}</output>
    <output aria-label="topology-can-redo">{String(canRedo)}</output>
    <button onClick={analyze}>topology-analyze</button>
    <button onClick={split}>topology-split</button>
    <button onClick={undo}>topology-undo</button>
    <button onClick={redo}>topology-redo</button>
  </>;
};

const PreparedStructuralEditHarness = () => {
  const {
    project,
    analysis,
    canUndo,
    canRedo,
    analyze,
    executePreparedStructuralEdit,
    updateProject,
    undo,
    redo,
  } = useProject();
  const [prepared, setPrepared] = useState<PreparedStructuralEdit | null>(null);
  const [error, setError] = useState('');
  const prepareMove = () => setPrepared(prepareStructuralEdit(project, {
    kind: 'move', selection: { kind: 'node', id: project.nodes[0].id }, delta: { x: 2, y: -1 },
  }));
  const prepareNoop = () => setPrepared(prepareStructuralEdit(project, {
    kind: 'move', selection: { kind: 'node', id: project.nodes[0].id }, delta: { x: 0, y: 0 },
  }));
  const apply = async () => {
    if (!prepared) return;
    try {
      await executePreparedStructuralEdit(prepared);
      setPrepared(null);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'error');
    }
  };
  return <>
    <output aria-label="prepared-x">{project.nodes[0].x}</output>
    <output aria-label="prepared-y">{project.nodes[0].y}</output>
    <output aria-label="prepared-project-name">{project.name}</output>
    <output aria-label="prepared-analysis">{analysis ? (analysis.success ? 'success' : 'failed') : 'none'}</output>
    <output aria-label="prepared-can-undo">{String(canUndo)}</output>
    <output aria-label="prepared-can-redo">{String(canRedo)}</output>
    <output aria-label="prepared-active">{String(Boolean(prepared))}</output>
    <output aria-label="prepared-preview-x">{prepared?.previewProject.nodes[0].x ?? ''}</output>
    <output aria-label="prepared-error">{error}</output>
    <button onClick={analyze}>prepared-analyze</button>
    <button onClick={prepareMove}>prepared-create</button>
    <button onClick={prepareNoop}>prepared-create-noop</button>
    <button onClick={() => setPrepared(null)}>prepared-cancel</button>
    <button onClick={apply}>prepared-apply</button>
    <button onClick={() => updateProject((draft) => ({ ...draft, name: 'Cambio concurrente' }))}>prepared-external-change</button>
    <button onClick={undo}>prepared-undo</button>
    <button onClick={redo}>prepared-redo</button>
  </>;
};

const StructuralDeleteCommandHarness = () => {
  const { project, analysis, canUndo, canRedo, analyze, executeProjectCommand, undo, redo } = useProject();
  const removeNode = async () => {
    await executeProjectCommand({ kind: 'node.delete', description: 'Eliminar N3 desde Context', nodeId: 'N3' });
  };
  const snapshot = JSON.stringify({
    nodes: project.nodes,
    members: project.members,
    nodalLoads: project.nodalLoads,
    memberLoads: project.memberLoads,
    prescribedDisplacements: project.prescribedDisplacements,
    memberInitialEffects: project.memberInitialEffects,
  });
  return <>
    <output aria-label="structural-delete-snapshot">{snapshot}</output>
    <output aria-label="structural-delete-analysis">{analysis ? (analysis.success ? 'success' : 'failed') : 'none'}</output>
    <output aria-label="structural-delete-can-undo">{String(canUndo)}</output>
    <output aria-label="structural-delete-can-redo">{String(canRedo)}</output>
    <button onClick={analyze}>structural-delete-analyze</button>
    <button onClick={removeNode}>structural-delete-node</button>
    <button onClick={undo}>structural-delete-undo</button>
    <button onClick={redo}>structural-delete-redo</button>
  </>;
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ProjectContext transactions', () => {
  it('records one reversible history entry for one command intention', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><CommandHistoryHarness /></ProjectProvider>);
    const initial = Number(screen.getByLabelText('command-members').textContent);
    await user.click(screen.getByText('command-create'));
    await waitFor(() => expect(Number(screen.getByLabelText('command-members').textContent)).toBe(initial + 1));
    expect(screen.getByLabelText('command-undo').textContent).toBe('true');
    await user.click(screen.getByText('command-undo-action'));
    expect(Number(screen.getByLabelText('command-members').textContent)).toBe(initial);
    expect(screen.getByLabelText('command-redo').textContent).toBe('true');
    await user.click(screen.getByText('command-redo-action'));
    await waitFor(() => expect(Number(screen.getByLabelText('command-members').textContent)).toBe(initial + 1));
  });

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

  it('characterizes that a discrete update is undoable and invalidates a completed result', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><AnalysisHarness /></ProjectProvider>);

    await user.click(screen.getByText('analyze'));
    await waitFor(() => expect(screen.getByLabelText('analysis-state').textContent).toBe('success'));
    await user.click(screen.getByText('edit'));

    expect(screen.getByLabelText('analysis-state').textContent).toBe('none');
    expect(screen.getByLabelText('analysis-can-undo').textContent).toBe('true');
    await user.click(screen.getByText('undo-analysis'));
    expect(screen.getByLabelText('analysis-can-undo').textContent).toBe('false');
  });

  it('characterizes that a transient gesture invalidates immediately, commits once, and cancel leaves no history', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><TransactionHarness /></ProjectProvider>);

    await user.click(screen.getByText('transaction-analyze'));
    await waitFor(() => expect(screen.getByLabelText('transaction-analysis-state').textContent).toBe('success'));
    await user.click(screen.getByText('begin'));
    await user.click(screen.getByText('move'));
    expect(screen.getByLabelText('transaction-analysis-state').textContent).toBe('none');
    await user.click(screen.getByText('commit'));
    expect(screen.getByLabelText('can-undo').textContent).toBe('true');
    await user.click(screen.getByText('undo'));
    expect(screen.getByLabelText('can-undo').textContent).toBe('false');

    await user.click(screen.getByText('begin'));
    await user.click(screen.getByText('move'));
    await user.click(screen.getByText('cancel'));
    expect(screen.getByLabelText('can-undo').textContent).toBe('false');
  });
});

describe('ProjectContext analysis settings lifecycle', () => {
  const renderSettingsHarness = () => {
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><AnalysisSettingsHarness /></ProjectProvider>);
  };

  const analyzeSuccessfully = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByText('settings-analyze'));
    await waitFor(() => expect(screen.getByLabelText('settings-analysis-state').textContent).toBe('success'));
  };

  it('clears a successful result when analysis mode changes', async () => {
    const user = userEvent.setup();
    renderSettingsHarness();
    await analyzeSuccessfully(user);

    await user.click(screen.getByText('settings-p-delta'));

    expect(screen.getByLabelText('settings-analysis-mode').textContent).toBe('p-delta');
    expect(screen.getByLabelText('settings-analysis-state').textContent).toBe('none');
  });

  it('clears a successful result when a P-Delta parameter changes', async () => {
    const user = userEvent.setup();
    renderSettingsHarness();
    await analyzeSuccessfully(user);

    await user.click(screen.getByText('settings-p-delta-steps'));

    expect(screen.getByLabelText('settings-max-load-steps').textContent).toBe('17');
    expect(screen.getByLabelText('settings-analysis-state').textContent).toBe('none');
  });

  it('never publishes an in-flight result after analysis settings change', async () => {
    const user = userEvent.setup();
    const OriginalWorker = globalThis.Worker;
    class DelayedWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(request: { requestId: number }) {
        window.setTimeout(() => this.onmessage?.({ data: {
          type: 'analysis-result',
          requestId: request.requestId,
          result: { success: false, issues: [] },
        } } as MessageEvent), 25);
      }
      terminate() {}
    }
    Object.defineProperty(globalThis, 'Worker', { configurable: true, value: DelayedWorker });
    try {
      renderSettingsHarness();
      await user.click(screen.getByText('settings-analyze'));
      expect(screen.getByLabelText('settings-is-analyzing').textContent).toBe('true');

      await user.click(screen.getByText('settings-p-delta'));
      await new Promise((resolve) => window.setTimeout(resolve, 60));

      expect(screen.getByLabelText('settings-analysis-state').textContent).toBe('none');
      expect(screen.getByLabelText('settings-is-analyzing').textContent).toBe('false');
    } finally {
      Object.defineProperty(globalThis, 'Worker', { configurable: true, value: OriginalWorker });
    }
  });

  it('keeps a valid result for a purely visual preference change', async () => {
    const user = userEvent.setup();
    renderSettingsHarness();
    await analyzeSuccessfully(user);

    await user.click(screen.getByText('settings-view-preference'));

    expect(screen.getByLabelText('settings-analysis-state').textContent).toBe('success');
    expect(screen.getByLabelText('settings-can-undo').textContent).toBe('false');
  });

  it('keeps the existing undo and redo contract for analysis settings changes', async () => {
    const user = userEvent.setup();
    renderSettingsHarness();

    await user.click(screen.getByText('settings-edit'));
    await user.click(screen.getByText('settings-p-delta'));
    expect(screen.getByLabelText('settings-can-undo').textContent).toBe('true');

    await user.click(screen.getByText('settings-undo'));
    expect(screen.getByLabelText('settings-project-name').textContent).not.toBe('Proyecto editado');
    expect(screen.getByLabelText('settings-analysis-mode').textContent).toBe('first-order');
    expect(screen.getByLabelText('settings-can-redo').textContent).toBe('true');

    await user.click(screen.getByText('settings-redo'));
    expect(screen.getByLabelText('settings-project-name').textContent).toBe('Proyecto editado');
    expect(screen.getByLabelText('settings-analysis-mode').textContent).toBe('p-delta');
  });

  it('characterizes that analysis settings invalidate without creating a history entry', async () => {
    const user = userEvent.setup();
    renderSettingsHarness();
    await analyzeSuccessfully(user);

    await user.click(screen.getByText('settings-p-delta'));

    expect(screen.getByLabelText('settings-analysis-state').textContent).toBe('none');
    expect(screen.getByLabelText('settings-can-undo').textContent).toBe('false');
  });
});

describe('ProjectContext mutation-policy boundaries', () => {
  it('characterizes that a command is reversible and invalidates a completed result', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><CommandHistoryHarness /></ProjectProvider>);

    await user.click(screen.getByText('command-analyze'));
    await waitFor(() => expect(screen.getByLabelText('command-analysis-state').textContent).toBe('success'));
    await user.click(screen.getByText('command-create'));

    expect(screen.getByLabelText('command-analysis-state').textContent).toBe('none');
    expect(screen.getByLabelText('command-undo').textContent).toBe('true');
  });

  it('characterizes that rename preserves the active result and does not create history', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><SpecialBoundaryHarness /></ProjectProvider>);

    await user.click(screen.getByText('boundary-analyze'));
    await waitFor(() => expect(screen.getByLabelText('boundary-analysis-state').textContent).toBe('success'));
    await user.click(screen.getByText('boundary-rename'));

    expect(screen.getByLabelText('boundary-project-name').textContent).toBe('Proyecto renombrado');
    expect(screen.getByLabelText('boundary-analysis-state').textContent).toBe('success');
    expect(screen.getByLabelText('boundary-can-undo').textContent).toBe('false');
  });

  it('characterizes replaceProject as a loading boundary with opening history and cleared stale results', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><SpecialBoundaryHarness /></ProjectProvider>);

    await user.click(screen.getByText('boundary-analyze'));
    await waitFor(() => expect(screen.getByLabelText('boundary-analysis-state').textContent).toBe('success'));
    await user.click(screen.getByText('boundary-replace'));

    expect(screen.getByLabelText('boundary-project-name').textContent).toBe('Proyecto reemplazado');
    expect(screen.getByLabelText('boundary-analysis-state').textContent).toBe('none');
    expect(screen.getByLabelText('boundary-can-undo').textContent).toBe('true');
    await user.click(screen.getByText('boundary-undo'));
    expect(screen.getByLabelText('boundary-project-name').textContent).not.toBe('Proyecto reemplazado');
  });

  it('publishes a topological command result with one invalidating undo/redo entry', async () => {
    const user = userEvent.setup();
    localStorage.setItem('structureCo.project', JSON.stringify(createDefaultProject()));
    render(<ProjectProvider><TopologyCommandHarness /></ProjectProvider>);
    const initialNodes = screen.getByLabelText('topology-nodes').textContent;
    const initialMembers = screen.getByLabelText('topology-members').textContent;

    await user.click(screen.getByText('topology-analyze'));
    await waitFor(() => expect(screen.getByLabelText('topology-analysis').textContent).toBe('success'));
    await user.click(screen.getByText('topology-split'));
    await waitFor(() => expect(screen.getByLabelText('topology-result-node').textContent).not.toBe(''));

    expect(screen.getByLabelText('topology-analysis').textContent).toBe('none');
    expect(Number(screen.getByLabelText('topology-nodes').textContent)).toBe(Number(initialNodes) + 1);
    expect(Number(screen.getByLabelText('topology-members').textContent)).toBe(Number(initialMembers) + 1);
    expect(screen.getByLabelText('topology-can-undo').textContent).toBe('true');

    await user.click(screen.getByText('topology-undo'));
    expect(screen.getByLabelText('topology-nodes').textContent).toBe(initialNodes);
    expect(screen.getByLabelText('topology-members').textContent).toBe(initialMembers);
    expect(screen.getByLabelText('topology-can-undo').textContent).toBe('false');
    expect(screen.getByLabelText('topology-can-redo').textContent).toBe('true');

    await user.click(screen.getByText('topology-redo'));
    expect(Number(screen.getByLabelText('topology-nodes').textContent)).toBe(Number(initialNodes) + 1);
    expect(Number(screen.getByLabelText('topology-members').textContent)).toBe(Number(initialMembers) + 1);
  });

  it('records one invalidating undo/redo entry for a structural delete cascade', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    localStorage.setItem('structureCo.project', JSON.stringify(project));
    render(<ProjectProvider><StructuralDeleteCommandHarness /></ProjectProvider>);
    const before = screen.getByLabelText('structural-delete-snapshot').textContent;

    await user.click(screen.getByText('structural-delete-analyze'));
    await waitFor(() => expect(screen.getByLabelText('structural-delete-analysis').textContent).toBe('success'));
    await user.click(screen.getByText('structural-delete-node'));
    await waitFor(() => expect(screen.getByLabelText('structural-delete-snapshot').textContent).not.toBe(before));
    const removed = screen.getByLabelText('structural-delete-snapshot').textContent;

    expect(screen.getByLabelText('structural-delete-analysis').textContent).toBe('none');
    expect(screen.getByLabelText('structural-delete-can-undo').textContent).toBe('true');
    expect(removed).not.toContain('"N3"');
    expect(removed).not.toContain('"M1"');
    expect(removed).not.toContain('"M2"');
    expect(removed).toContain('"M3"');

    await user.click(screen.getByText('structural-delete-undo'));
    expect(screen.getByLabelText('structural-delete-snapshot').textContent).toBe(before);
    expect(screen.getByLabelText('structural-delete-can-undo').textContent).toBe('false');
    expect(screen.getByLabelText('structural-delete-can-redo').textContent).toBe('true');

    await user.click(screen.getByText('structural-delete-redo'));
    expect(screen.getByLabelText('structural-delete-snapshot').textContent).toBe(removed);
  });
});

describe('ProjectContext prepared structural editing', () => {
  const renderHarness = () => {
    const project = createDefaultProject();
    localStorage.setItem('structureCo.project', JSON.stringify(project));
    render(<ProjectProvider><PreparedStructuralEditHarness /></ProjectProvider>);
    return project;
  };

  it('keeps preview and cancel outside ProjectModel, analysis and history', async () => {
    const user = userEvent.setup();
    const source = renderHarness();
    const originalX = String(source.nodes[0].x);

    await user.click(screen.getByText('prepared-analyze'));
    await waitFor(() => expect(screen.getByLabelText('prepared-analysis').textContent).toBe('success'));
    await user.click(screen.getByText('prepared-create'));

    expect(screen.getByLabelText('prepared-active').textContent).toBe('true');
    expect(screen.getByLabelText('prepared-x').textContent).toBe(originalX);
    expect(screen.getByLabelText('prepared-preview-x').textContent).toBe(String(source.nodes[0].x + 2));
    expect(screen.getByLabelText('prepared-analysis').textContent).toBe('success');
    expect(screen.getByLabelText('prepared-can-undo').textContent).toBe('false');

    await user.click(screen.getByText('prepared-cancel'));
    expect(screen.getByLabelText('prepared-active').textContent).toBe('false');
    expect(screen.getByLabelText('prepared-x').textContent).toBe(originalX);
    expect(screen.getByLabelText('prepared-analysis').textContent).toBe('success');
    expect(screen.getByLabelText('prepared-can-undo').textContent).toBe('false');
  });

  it('does not persist a prepared preview or cancellation, then persists exactly the confirmed result', async () => {
    const user = userEvent.setup();
    const source = renderHarness();
    // Let the provider's initial compatibility save settle before observing this operation.
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await user.click(screen.getByText('prepared-create'));
    await user.click(screen.getByText('prepared-cancel'));
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    const projectWritesBeforeConfirm = setItem.mock.calls.filter(([key]) =>
      key === 'structureCo.project' || key === 'structureCo.project.backup',
    );
    expect(projectWritesBeforeConfirm).toHaveLength(0);

    await user.click(screen.getByText('prepared-create'));
    await user.click(screen.getByText('prepared-apply'));
    await waitFor(() => expect(screen.getByLabelText('prepared-x').textContent).toBe(String(source.nodes[0].x + 2)));
    await new Promise((resolve) => window.setTimeout(resolve, 320));

    const projectWritesAfterConfirm = setItem.mock.calls.filter(([key]) => key === 'structureCo.project');
    expect(projectWritesAfterConfirm.length).toBeGreaterThan(0);
    const persisted = JSON.parse(localStorage.getItem('structureCo.project') ?? '{}') as typeof source;
    expect(persisted.nodes[0]).toMatchObject({ x: source.nodes[0].x + 2, y: source.nodes[0].y - 1 });
  });

  it('commits one exact intent, invalidates without reanalysis, and restores exact undo/redo snapshots', async () => {
    const user = userEvent.setup();
    const source = renderHarness();
    const originalX = String(source.nodes[0].x);
    const originalY = String(source.nodes[0].y);

    await user.click(screen.getByText('prepared-analyze'));
    await waitFor(() => expect(screen.getByLabelText('prepared-analysis').textContent).toBe('success'));
    await user.click(screen.getByText('prepared-create'));
    const previewX = screen.getByLabelText('prepared-preview-x').textContent;
    await user.click(screen.getByText('prepared-apply'));

    await waitFor(() => expect(screen.getByLabelText('prepared-x').textContent).toBe(previewX));
    expect(screen.getByLabelText('prepared-y').textContent).toBe(String(source.nodes[0].y - 1));
    expect(screen.getByLabelText('prepared-analysis').textContent).toBe('none');
    expect(screen.getByLabelText('prepared-can-undo').textContent).toBe('true');

    await user.click(screen.getByText('prepared-undo'));
    expect(screen.getByLabelText('prepared-x').textContent).toBe(originalX);
    expect(screen.getByLabelText('prepared-y').textContent).toBe(originalY);
    expect(screen.getByLabelText('prepared-can-undo').textContent).toBe('false');
    expect(screen.getByLabelText('prepared-can-redo').textContent).toBe('true');

    await user.click(screen.getByText('prepared-redo'));
    expect(screen.getByLabelText('prepared-x').textContent).toBe(previewX);
    expect(screen.getByLabelText('prepared-y').textContent).toBe(String(source.nodes[0].y - 1));
  });

  it('treats a no-op as no history and keeps a valid result', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByText('prepared-analyze'));
    await waitFor(() => expect(screen.getByLabelText('prepared-analysis').textContent).toBe('success'));
    await user.click(screen.getByText('prepared-create-noop'));
    await user.click(screen.getByText('prepared-apply'));

    expect(screen.getByLabelText('prepared-analysis').textContent).toBe('success');
    expect(screen.getByLabelText('prepared-can-undo').textContent).toBe('false');
  });

  it('rejects a stale preview atomically after another project change', async () => {
    const user = userEvent.setup();
    const source = renderHarness();
    const originalX = String(source.nodes[0].x);
    await user.click(screen.getByText('prepared-create'));
    await user.click(screen.getByText('prepared-external-change'));
    expect(screen.getByLabelText('prepared-project-name').textContent).toBe('Cambio concurrente');

    await user.click(screen.getByText('prepared-apply'));
    await waitFor(() => expect(screen.getByLabelText('prepared-error').textContent).toMatch(/obsolet/i));
    expect(screen.getByLabelText('prepared-x').textContent).toBe(originalX);
    expect(screen.getByLabelText('prepared-project-name').textContent).toBe('Cambio concurrente');
  });
});
