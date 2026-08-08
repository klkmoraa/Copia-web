import type { AnalysisResult } from '../../types';

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
