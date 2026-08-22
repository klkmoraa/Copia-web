import { describe, expect, it } from 'vitest';
import { createSimpleBeamExercise, createTriangularTrussExercise } from './exerciseTemplates';
import { buildClassroomPedagogy } from './classroomPedagogy';

describe('buildClassroomPedagogy', () => {
  it('provides three real levels for beams and trusses', () => {
    const beam = buildClassroomPedagogy(createSimpleBeamExercise());
    const truss = buildClassroomPedagogy(createTriangularTrussExercise());
    expect(beam.kind).toBe('beam');
    expect(truss.kind).toBe('truss');
    expect(beam.levels.map((level) => level.id)).toEqual(['fundamentals', 'procedure', 'verification']);
    expect(truss.levels.map((level) => level.id)).toEqual(['fundamentals', 'procedure', 'verification']);
    expect(beam.levels[0].topics).not.toEqual(truss.levels[0].topics);
  });

  it('classifies a frame by its frame members and two-dimensional geometry', () => {
    const project = createSimpleBeamExercise();
    project.nodes.push({ id: 'N3', x: 2, y: 3, support: { type: 'none' } });
    project.members.push({ ...project.members[0], id: 'M2', i: 'N2', j: 'N3' });
    expect(buildClassroomPedagogy(project).kind).toBe('frame');
  });
});
