/**
 * Which solution methods exist, and which ones this structure can honestly be solved with.
 *
 * The product resolves everything with the matrix stiffness method — that is what
 * `analyzeProject` does, and for frames of exact Euler–Bernoulli elements it *is* the finite
 * element method, so neither is re-implemented here. What a second method adds is the
 * *procedure*: the same answer reached the way a reader was taught to reach it.
 *
 * Every method therefore has to land on the solver's own result, and its narrator is
 * responsible for proving it. A method that disagreed with the solver would not be a second
 * opinion, it would be a bug.
 */
import type { ProjectModel } from '../types';
import { classifyStructure, type StructureClassification } from './structureClassification';

export type SolutionMethodId = 'matrix-stiffness' | 'double-integration' | 'portal-method';

export const DEFAULT_SOLUTION_METHOD: SolutionMethodId = 'matrix-stiffness';

export interface SolutionMethodDefinition {
  id: SolutionMethodId;
  /** Translation key for the selector and the report heading. */
  labelKey: string;
  /** Decides whether this structure can be solved this way at all. */
  applies: (classification: StructureClassification, project: ProjectModel) => boolean;
}

export const SOLUTION_METHODS: readonly SolutionMethodDefinition[] = [
  {
    id: 'matrix-stiffness',
    labelKey: 'method.matrixStiffness',
    // Always available: it is what actually produced the results in the rest of the document.
    applies: () => true,
  },
  {
    id: 'double-integration',
    labelKey: 'method.doubleIntegration',
    applies: (classification) => (
      (classification.kind === 'simple-beam' || classification.kind === 'continuous-beam')
      // A mechanism has no solution to narrate, and the solver refuses it anyway.
      && classification.indeterminacy >= 0
    ),
  },
  {
    id: 'portal-method',
    labelKey: 'method.portalMethod',
    // A deliberately approximate method for lateral load on a rectangular building frame. Its
    // deeper requirements — a clean storey/column-line grid, no lateral load on the members
    // themselves, an actual lateral load to narrate — can only be checked by trying to reduce
    // the frame to that grid, which is `solvePortalMethod`'s job; the selector only offers it
    // where the shallow shape (a frame) makes that attempt plausible.
    applies: (classification) => classification.kind === 'frame',
  },
];

/** Methods that genuinely apply to this project, in registry order. */
export const applicableMethods = (project: ProjectModel): SolutionMethodDefinition[] => {
  const classification = classifyStructure(project);
  return SOLUTION_METHODS.filter((method) => method.applies(classification, project));
};

/**
 * The method to actually use: the stored choice when it still applies, the default otherwise.
 *
 * A project saved as a beam and later edited into a frame must not keep exporting a method
 * that no longer means anything, so the fallback is silent and automatic.
 */
export const resolveSolutionMethod = (project: ProjectModel): SolutionMethodId => {
  const requested = project.settings.solutionMethod;
  if (!requested) return DEFAULT_SOLUTION_METHOD;
  return applicableMethods(project).some((method) => method.id === requested)
    ? requested
    : DEFAULT_SOLUTION_METHOD;
};
