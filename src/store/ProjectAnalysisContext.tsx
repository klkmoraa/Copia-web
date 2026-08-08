import { createContext, useContext } from 'react';
import type { AnalysisResult, DiagramQuantity } from '../types';

export interface InfluenceCanvasState {
  pathMemberIds: string[];
  target: { memberId: string; x: number; quantity: DiagramQuantity };
  source?: { memberId: string; ratio: number; ordinate: number };
}

/**
 * Structural analysis results and async calculation state.
 * Isolated from {@link ProjectModelContext} and {@link WorkspaceUIContext} so that
 * re-analyzing doesn't re-render consumers that only care about the edited model or the active tool.
 */
export interface ProjectAnalysisContextValue {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  selectedCombinationId: string;
  setSelectedCombinationId: (id: string) => void;
  learningFocus: { nodeIds: string[]; memberIds: string[] } | null;
  setLearningFocus: (focus: { nodeIds: string[]; memberIds: string[] } | null) => void;
  influenceCanvasState: InfluenceCanvasState | null;
  setInfluenceCanvasState: (state: InfluenceCanvasState | null) => void;
  analyze: () => void;
  clearAnalysis: () => void;
  /**
   * Lazily computes and merges `educationTrace` onto the current analysis when
   * it is missing — `analyze()` runs the interactive path without it (see
   * AG-013). No-op (resolves the existing result) once the trace is already
   * present or the current run is unsuccessful.
   */
  ensureEducationTrace: () => Promise<AnalysisResult | null>;
}

export const ProjectAnalysisContext = createContext<ProjectAnalysisContextValue | null>(null);

// oxlint-disable-next-line react/only-export-components
export const useProjectAnalysis = (): ProjectAnalysisContextValue => {
  const context = useContext(ProjectAnalysisContext);
  if (!context) throw new Error('useProjectAnalysis debe utilizarse dentro de ProjectProvider.');
  return context;
};
