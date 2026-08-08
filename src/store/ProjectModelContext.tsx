import { createContext, useContext } from 'react';
import type { AnalysisResult, ProjectModel } from '../types';

/**
 * The structural model, its undo/redo history and persistence state.
 * Isolated from {@link ProjectAnalysisContext} and {@link WorkspaceUIContext} so that
 * switching tools, tabs or re-analyzing doesn't re-render model-only consumers.
 */
export interface ProjectModelContextValue {
  project: ProjectModel;
  canUndo: boolean;
  canRedo: boolean;
  storageIssue: 'recovered' | 'load-failed' | 'save-failed' | null;
  storageMessage: string | null;
  renameProject: (name: string) => void;
  updateProject: (updater: (project: ProjectModel) => ProjectModel, analyzeAfter?: boolean) => void;
  updateProjectView: (updater: (project: ProjectModel) => ProjectModel) => void;
  beginProjectTransaction: () => void;
  updateProjectTransient: (updater: (project: ProjectModel) => ProjectModel) => void;
  moveNodeTransient: (nodeId: string, point: { x: number; y: number }) => void;
  commitProjectTransaction: () => void;
  cancelProjectTransaction: () => void;
  replaceProject: (project: ProjectModel, restoredAnalysis?: AnalysisResult) => void;
  undo: () => void;
  redo: () => void;
}

export const ProjectModelContext = createContext<ProjectModelContextValue | null>(null);

// oxlint-disable-next-line react/only-export-components
export const useProjectModel = (): ProjectModelContextValue => {
  const context = useContext(ProjectModelContext);
  if (!context) throw new Error('useProjectModel debe utilizarse dentro de ProjectProvider.');
  return context;
};
