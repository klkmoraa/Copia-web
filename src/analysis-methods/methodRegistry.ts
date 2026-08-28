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

export type SolutionMethodId = 'matrix-stiffness' | 'double-integration' | 'portal-method' | 'cantilever-method' | 'three-moment' | 'virtual-work' | 'castigliano-truss' | 'hardy-cross' | 'kani-frame' | 'method-of-sections' | 'method-of-joints' | 'conjugate-beam';

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
    id: 'conjugate-beam',
    labelKey: 'method.conjugateBeam',
    // The classical closed-form alternative to Double Integration on the same isostatic span:
    // instead of solving the boundary-value problem directly, it converts the beam's supports
    // by a fixed table and reads slope and deflection off the shear and moment of a fictitious
    // beam. Its deeper requirement — nothing between the two ends, no interior support and no
    // interior hinge, since the conversion table has no counterpart for either — is
    // `solveConjugateBeam`'s job.
    applies: (classification) => (
      (classification.kind === 'simple-beam' || classification.kind === 'continuous-beam')
      && classification.indeterminacy === 0
    ),
  },
  {
    id: 'three-moment',
    labelKey: 'method.threeMoment',
    // Only means something with an interior support to write an equation about; a simple beam
    // (0 degrees) has nothing for it to solve. Its deeper requirements — every support simple
    // (no fixed end), full continuity, uniform EI within each span — are `solveThreeMoment`'s job.
    applies: (classification) => (
      (classification.kind === 'simple-beam' || classification.kind === 'continuous-beam')
      && classification.indeterminacy >= 1
    ),
  },
  {
    id: 'hardy-cross',
    labelKey: 'method.hardyCross',
    // The same continuous-beam scope as Three Moments — every support simple, full continuity,
    // uniform EI within each span — reached instead by iterative joint balancing. Offered
    // alongside Three Moments rather than in its place, because the two are checked against each
    // other, not only against the solver.
    applies: (classification) => (
      (classification.kind === 'simple-beam' || classification.kind === 'continuous-beam')
      && classification.indeterminacy >= 1
    ),
  },
  {
    id: 'virtual-work',
    labelKey: 'method.virtualWork',
    // The first method offered on a truss instead of a beam or a frame. Its deeper requirements
    // — no distributed load along a member, at least one genuinely free joint — are
    // `solveVirtualWork`'s job.
    applies: (classification) => classification.kind === 'truss',
  },
  {
    id: 'method-of-sections',
    labelKey: 'method.methodOfSections',
    // Pure statics on a cut portion of the truss, which only closes with three equations per cut
    // when the truss itself is statically determinate — unlike Virtual Work, which needs no such
    // restriction. `solveMethodOfSections` is what actually searches for a valid cut per member.
    applies: (classification) => classification.kind === 'truss' && classification.indeterminacy === 0,
  },
  {
    id: 'method-of-joints',
    labelKey: 'method.methodOfJoints',
    // The classical complement to the Method of Sections: local equilibrium at one pin at a
    // time instead of global equilibrium of a cut portion. Same scope — pure statics only closes
    // when the truss is statically determinate — for the same reason. `solveMethodOfJoints` is
    // what actually walks the joints in dependency order.
    applies: (classification) => classification.kind === 'truss' && classification.indeterminacy === 0,
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
  {
    id: 'cantilever-method',
    labelKey: 'method.cantileverMethod',
    // Also approximate, also lateral-load-only, and offered on the same shallow shape: a frame.
    // `solveCantileverMethod` is what actually checks the grid, the loads, and — this method's
    // own extra requirement — that the first storey's columns share one base condition, so the
    // flexure-formula cut is a single free body.
    applies: (classification) => classification.kind === 'frame',
  },
  {
    id: 'castigliano-truss',
    labelKey: 'method.castiglianoTruss',
    // Only means something with a redundant reaction to solve for; a determinate truss (0
    // degrees) is exactly what `virtual-work` already narrates. Its deeper requirements — the
    // indeterminacy has to be external (no extra bar), every support axis-aligned — are
    // `solveCastiglianoTruss`'s job.
    applies: (classification) => classification.kind === 'truss' && classification.indeterminacy >= 1,
  },
  {
    id: 'kani-frame',
    labelKey: 'method.kaniFrame',
    // The frame counterpart of Hardy Cross's iterative joint balancing — offered on the same
    // shallow shape (a frame) as Portal and Cantilever. Its formula carries no sway term, so it
    // only lands on the solver's own moments when the frame genuinely does not translate
    // sideways under this load; `solveKaniFrame` checks that by computing the answer and
    // measuring the gap, not by guessing it from the geometry, and declares itself inapplicable
    // rather than narrate anything less exact than that.
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
