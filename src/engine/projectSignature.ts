import type { ProjectModel } from '../types';

const cache = new WeakMap<ProjectModel, string>();

/**
 * Identity of everything `analyzeProject` reads.
 *
 * The store hands out a fresh, deep-cloned `ProjectModel` for any change, so
 * object identity cannot tell a new node apart from a new unit system. Anything
 * that only affects presentation — units, language, diagram scale, layers — is
 * deliberately absent here, so changing it never discards results that are
 * still exact. `settings.calculationMode`, `settings.analysisMode` and
 * `settings.pDeltaConfig` *are* included because `analyzeProjectAuto` branches
 * and iterates on them.
 *
 * Memoised per project object: the callers share one computation per change.
 */
export const analysisSignature = (project: ProjectModel): string => {
  const cached = cache.get(project);
  if (cached !== undefined) return cached;
  const signature = JSON.stringify([
    project.nodes,
    project.members,
    project.loadCases,
    project.combinations,
    project.nodalLoads,
    project.prescribedDisplacements ?? null,
    project.memberLoads,
    project.memberInitialEffects ?? null,
    project.settings.calculationMode ?? null,
    project.settings.analysisMode ?? null,
    project.settings.pDeltaConfig ?? null,
  ]);
  cache.set(project, signature);
  return signature;
};
