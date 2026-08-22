import { createContext, useContext } from 'react';
import type { AnalysisResult, ProjectModel, ProjectSettings } from '../types';
import type { PreparedTopologyRepair, ProjectCommand, ProjectCommandResult } from '../commands/projectCommand';
import type { PreparedStructureGeneration } from '../commands/structureGeneration';
import type { PreparedStructuralEdit } from '../data/structuralEditing';

/**
 * The structural model, its undo/redo history and persistence state.
 * Isolated from {@link ProjectAnalysisContext} and {@link WorkspaceUIContext} so that
 * switching tools, tabs or re-analyzing doesn't re-render model-only consumers.
 */
export interface ProjectModelContextValue {
  project: ProjectModel;
  canUndo: boolean;
  canRedo: boolean;
  storageIssue: 'recovered' | 'load-failed' | 'save-failed' | 'repository-degraded' | 'conflict' | null;
  storageMessage: string | null;

  /** Renames only current-project metadata; it creates no history and does not invalidate analysis. */
  renameProject: (name: string) => void;

  /**
   * Applies a typed structural operation compiled to validated patches.
   * `ProjectCommand` is deliberately a subset of mutations, not a universal mutation bus:
   * this route records history and invalidates analysis.
   */
  executeProjectCommand: (command: ProjectCommand) => Promise<ProjectCommandResult | undefined>;

  /** Applies the exact topology state accepted in a Model Doctor preview. */
  executePreparedTopologyRepair: (prepared: PreparedTopologyRepair) => Promise<TopologyRepairExecutionResult>;

  /** Applies the exact structural-edit state shown by a local canvas preview. */
  executePreparedStructuralEdit: (prepared: PreparedStructuralEdit) => Promise<PreparedStructuralEditExecutionResult>;

  /**
   * Applies the exact geometry shown by a generation preview.
   * The whole generated batch lands as one history entry, never as one mutation per member.
   */
  executePreparedStructureGeneration: (prepared: PreparedStructureGeneration) => Promise<StructureGenerationExecutionResult>;

  /**
   * Applies a discrete reversible edit. It records one history entry and invalidates analysis.
   * Use it for model edits that do not need a typed command contract.
   */
  updateProject: (updater: (project: ProjectModel) => ProjectModel, analyzeAfter?: boolean) => void;

  /** Applies a purely visual preference change; it creates no history and keeps analysis valid. */
  updateProjectView: (updater: (project: ProjectModel) => ProjectModel) => void;

  /** Changes only analysis-affecting settings; it creates no history but invalidates stale results. */
  updateProjectAnalysisSettings: (updater: (settings: Pick<ProjectSettings, 'analysisMode' | 'pDeltaConfig'>) => Pick<ProjectSettings, 'analysisMode' | 'pDeltaConfig'>) => void;

  /** Starts a continuous gesture. Its transient updates do not fill history. */
  beginProjectTransaction: (description?: string) => void;

  /** Publishes one continuous gesture update and invalidates analysis without creating history. */
  updateProjectTransient: (updater: (project: ProjectModel) => ProjectModel) => void;
  moveNodeTransient: (nodeId: string, point: { x: number; y: number }) => void;

  /** Commits the gesture as one reversible history entry when it changed the model. */
  commitProjectTransaction: () => void;

  /** Cancels the gesture, restores its starting model, and leaves history unchanged. */
  cancelProjectTransaction: () => void;

  /**
   * Special normalized load/restore boundary. It is intentionally not a `ProjectCommand`.
   * Existing opening history, restored-result, repository-revision, and selection-reset behavior is preserved.
   */
  replaceProject: (project: ProjectModel, restoredAnalysis?: AnalysisResult, repositoryRevision?: number) => void;
  undo: () => void;
  redo: () => void;
}

export interface TopologyRepairExecutionResult {
  applied: boolean;
  report: PreparedTopologyRepair['report'];
}

export interface PreparedStructuralEditExecutionResult {
  applied: boolean;
}

export interface StructureGenerationExecutionResult {
  applied: boolean;
  /** IDs realmente creados, para que la superficie pueda seleccionarlos. */
  nodeIds: readonly string[];
  memberIds: readonly string[];
}

export const ProjectModelContext = createContext<ProjectModelContextValue | null>(null);

// oxlint-disable-next-line react/only-export-components
export const useProjectModel = (): ProjectModelContextValue => {
  const context = useContext(ProjectModelContext);
  if (!context) throw new Error('useProjectModel debe utilizarse dentro de ProjectProvider.');
  return context;
};
