import { createContext, useContext } from 'react';
import type { Selection, ThemeMode, Tool } from '../types';

export type ResultTab = 'summary' | 'reactions' | 'axial' | 'shear' | 'moment' | 'influence' | 'deformed' | 'buckling' | 'modal' | 'learn' | 'issues';
export interface ResultCursor { memberId: string; x: number; pinned: boolean }

/**
 * Ephemeral editor UI state: active tool, selection, theme, results tab/cursor.
 * Isolated from {@link ProjectModelContext} and {@link ProjectAnalysisContext} so that
 * micro-interactions (hovering, switching tabs) don't re-render model- or analysis-only consumers.
 */
export interface WorkspaceUIContextValue {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  selection: Selection;
  setSelection: (selection: Selection) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
  resultCursor: ResultCursor | null;
  setResultCursor: (cursor: ResultCursor | null) => void;
}

export const WorkspaceUIContext = createContext<WorkspaceUIContextValue | null>(null);

// oxlint-disable-next-line react/only-export-components
export const useWorkspaceUI = (): WorkspaceUIContextValue => {
  const context = useContext(WorkspaceUIContext);
  if (!context) throw new Error('useWorkspaceUI debe utilizarse dentro de ProjectProvider.');
  return context;
};
