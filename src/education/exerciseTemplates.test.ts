import { describe, expect, it } from 'vitest';
import { analyzeProject, validateProject } from '../engine/solver';
import {
  classroomExerciseTemplates,
  createCantileverExercise,
  createPortalFrameExercise,
  createSimpleBeamExercise,
  createTriangularTrussExercise,
} from './exerciseTemplates';

describe('classroom exercise templates', () => {
  it('has unique typed metadata and always creates classroom projects', () => {
    expect(new Set(classroomExerciseTemplates.map((template) => template.id)).size).toBe(classroomExerciseTemplates.length);
    for (const template of classroomExerciseTemplates) {
      expect(template.durationMinutes).toBeGreaterThan(0);
      expect(template.topics.length).toBeGreaterThan(0);
      expect(template.build().settings.calculationMode).toBe('classroom');
    }
  });

  it('builds a parameterized simple beam without exposing material input', () => {
    const project = createSimpleBeamExercise({ length: 12, loadMagnitude: 75, loadPosition: 0.25 });
    expect(project.nodes[1]).toMatchObject({ x: 12, support: { type: 'roller' } });
    expect(project.members[0].releases).toEqual({ iMoment: true, jMoment: true });
    expect(project.memberLoads[0]).toMatchObject({ type: 'point', py: -75, position: 0.25 });
  });

  it('builds the cantilever, portal and truss geometry from essential dimensions', () => {
    const cantilever = createCantileverExercise({ length: 7, loadMagnitude: 20 });
    expect(cantilever.nodes[0].support.type).toBe('fixed');
    expect(cantilever.nodes[1].x).toBe(7);
    expect(cantilever.nodalLoads[0].fy).toBe(-20);

    const portal = createPortalFrameExercise({ length: 9, height: 5, distributedLoadMagnitude: 18 });
    expect(portal.nodes.find((node) => node.id === 'N4')).toMatchObject({ x: 9, y: 5 });
    expect(portal.memberLoads[0]).toMatchObject({ qyStart: -18, qyEnd: -18 });

    const truss = createTriangularTrussExercise({ length: 10, height: 3, loadMagnitude: 50 });
    expect(truss.nodes.find((node) => node.id === 'N3')).toMatchObject({ x: 5, y: 3 });
    expect(truss.members.every((member) => member.type === 'truss')).toBe(true);
    expect(truss.nodalLoads[0].fy).toBe(-50);
  });

  it('produces analyzable starter models for every nonblank template', () => {
    for (const template of classroomExerciseTemplates.filter((candidate) => candidate.id !== 'blank')) {
      const project = template.build();
      const errors = validateProject(project).filter((issue) => issue.severity === 'error');
      expect(errors, template.name).toEqual([]);
      expect(analyzeProject(project).success, template.name).toBe(true);
    }
  });

  it('falls back to safe dimensions and clamps relative load position', () => {
    const project = createSimpleBeamExercise({ length: -1, loadMagnitude: Number.NaN, loadPosition: 2 });
    expect(project.nodes[1].x).toBe(8);
    expect(project.memberLoads[0]).toMatchObject({ py: -40, position: 1 });
  });
});
