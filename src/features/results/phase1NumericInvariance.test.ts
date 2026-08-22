import { describe, expect, it } from 'vitest';
import { createPortalFrameExercise, createSimpleBeamExercise, createTriangularTrussExercise } from '../../education/exerciseTemplates';
import { analyzeProject } from '../../engine/solver';
import type { ProjectModel } from '../../types';

const numericContract = (project: ProjectModel) => {
  const complete = structuredClone(project);
  complete.settings.calculationMode = 'complete';
  const classroom = structuredClone(project);
  classroom.settings.calculationMode = 'classroom';
  const completeResult = analyzeProject(complete);
  const classroomResult = analyzeProject(classroom);
  return {
    complete: {
      success: completeResult.success,
      nodeResults: completeResult.nodeResults,
      memberResults: completeResult.memberResults,
      displacements: completeResult.displacements,
      equilibrium: completeResult.equilibrium,
      loadAudit: completeResult.loadAudit,
    },
    classroom: {
      success: classroomResult.success,
      nodeResults: classroomResult.nodeResults,
      memberResults: classroomResult.memberResults,
      displacements: classroomResult.displacements,
      equilibrium: classroomResult.equilibrium,
      loadAudit: classroomResult.loadAudit,
    },
  };
};

describe('Phase 1 numeric invariance', () => {
  it.each([
    ['beam', createSimpleBeamExercise()],
    ['truss', createTriangularTrussExercise()],
    ['frame', createPortalFrameExercise()],
  ])('keeps %s results byte-for-byte equal inside and outside Aula', (_kind, project) => {
    const result = numericContract(project);
    expect(result.classroom).toEqual(result.complete);
  });
});
