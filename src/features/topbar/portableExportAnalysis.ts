import type { LoadCombination, ProjectModel } from '../../types';
import { analyzeProjectAuto } from '../../engine/pDelta';

/**
 * Runs the configured analysis mode for a portable export when no interactive
 * result exists. Keeping this dispatcher outside the component makes it
 * regression-testable and prevents a P-Delta project from silently exporting a
 * newly recalculated first-order result.
 */
export const analyzeForPortableExport = (
  project: ProjectModel,
  combination?: LoadCombination | null,
) => analyzeProjectAuto(project, combination, { includeEducationTrace: true });
