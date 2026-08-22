import { resolveReliability } from '../../engine/reliability';
import type { AnalysisResult, ReliabilityCheck, ReliabilityLevel } from '../../types';

export type AnalysisVisualStatus = 'ready' | 'calculating' | 'resolved' | 'stale' | 'warning' | 'error';

interface DeriveAnalysisStatusOptions {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  hadAnalysis: boolean;
}

export const deriveAnalysisStatus = ({
  analysis,
  isAnalyzing,
  hadAnalysis,
}: DeriveAnalysisStatusOptions): AnalysisVisualStatus => {
  if (isAnalyzing) return 'calculating';
  if (!analysis) return hadAnalysis ? 'stale' : 'ready';
  if (!analysis.success || analysis.issues.some((issue) => issue.severity === 'error')) return 'error';
  if (analysis.issues.some((issue) => issue.severity === 'warning')) return 'warning';
  return 'resolved';
};

export interface ReliabilityPresentation {
  level: ReliabilityLevel;
  governing?: ReliabilityCheck;
}

/**
 * `success` (did the run finish) and `reliable` (can the numbers be trusted) answer
 * different questions — a run can succeed and still be numerically unreliable. This
 * is deliberately derived independently of {@link deriveAnalysisStatus} so the two
 * never collapse into one shared color or label (protected contract, CRI-100).
 */
export const deriveReliabilityPresentation = (
  analysis: AnalysisResult | null,
  isAnalyzing: boolean,
): ReliabilityPresentation | null => {
  if (isAnalyzing || !analysis) return null;
  const reliability = resolveReliability(analysis);
  return { level: reliability.level, governing: reliability.governing };
};
