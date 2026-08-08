import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../data/defaultProject';
import { analyzeProject } from '../engine/solver';
import { deriveClassroomProgress } from './classroomProgress';
import { createSimpleBeamExercise } from './exerciseTemplates';

describe('deriveClassroomProgress', () => {
  it('starts with geometry and changes its action after two nodes exist', () => {
    const project = createBlankProject();
    project.settings.calculationMode = 'classroom';
    let progress = deriveClassroomProgress(project);
    expect(progress.currentStep.id).toBe('geometry');
    expect(progress.currentStep.action).toEqual({ kind: 'tool', tool: 'node', label: 'Crear nodos' });

    project.nodes.push(
      { id: 'N1', x: 0, y: 0, support: { type: 'none' } },
      { id: 'N2', x: 4, y: 0, support: { type: 'none' } },
    );
    progress = deriveClassroomProgress(project);
    expect(progress.currentStep.action).toEqual({ kind: 'tool', tool: 'member', label: 'Conectar miembros' });
  });

  it('requires connected restraints in X and Y before marking supports complete', () => {
    const project = createSimpleBeamExercise();
    project.nodes[1].support = { type: 'none' };
    const progress = deriveClassroomProgress(project);
    expect(progress.geometry.valid).toBe(true);
    expect(progress.supports.valid).toBe(false);
    expect(progress.currentStep.id).toBe('supports');
  });

  it('distinguishes loads in active and inactive cases', () => {
    const project = createSimpleBeamExercise();
    project.loadCases[0].active = false;
    const progress = deriveClassroomProgress(project);
    expect(progress.loads.actionCount).toBe(1);
    expect(progress.loads.activeActionCount).toBe(0);
    expect(progress.loads.valid).toBe(false);
    expect(progress.currentStep.id).toBe('loads');
    expect(progress.currentStep.description).toMatch(/casos inactivos/i);
  });

  it('advances through analysis and reports completion', () => {
    const project = createSimpleBeamExercise();
    const before = deriveClassroomProgress(project);
    expect(before.readyToAnalyze).toBe(true);
    expect(before.completedSteps).toBe(3);
    expect(before.currentStep.id).toBe('analysis');

    const analysis = analyzeProject(project);
    expect(analysis.success).toBe(true);
    const after = deriveClassroomProgress(project, analysis);
    expect(after.completedSteps).toBe(4);
    expect(after.completionPercent).toBe(100);
    expect(after.steps.every((step) => step.complete)).toBe(true);
  });

  it('marks an unsuccessful analysis as requiring attention', () => {
    const project = createSimpleBeamExercise();
    const failed = { ...analyzeProject(project), success: false };
    const progress = deriveClassroomProgress(project, failed);
    expect(progress.currentStep.id).toBe('analysis');
    expect(progress.currentStep.state).toBe('attention');
    expect(progress.currentStep.description).toMatch(/Avisos/i);
  });
});
