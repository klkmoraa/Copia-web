import { describe, expect, it } from 'vitest';
import { createDefaultProject } from '../data/defaultProject';
import { analysisSignature } from './projectSignature';

const clone = <T>(value: T): T => structuredClone(value);

describe('analysis signature', () => {
  it('ignores presentation settings and a deep clone of the same model', () => {
    const project = createDefaultProject();
    const reference = analysisSignature(project);

    expect(analysisSignature(clone(project))).toBe(reference);

    const displayOnly = clone(project);
    displayOnly.name = 'Otro nombre';
    displayOnly.settings.units = 'N-mm';
    displayOnly.settings.language = 'en';
    displayOnly.settings.diagramScale = (project.settings.diagramScale ?? 1) * 2;
    expect(analysisSignature(displayOnly)).toBe(reference);
  });

  it('changes for every input the solver reads, including the calculation mode', () => {
    const project = createDefaultProject();
    const reference = analysisSignature(project);

    const movedNode = clone(project);
    movedNode.nodes[0].x += 1;
    expect(analysisSignature(movedNode)).not.toBe(reference);

    const softerMember = clone(project);
    softerMember.members[0].I *= 0.5;
    expect(analysisSignature(softerMember)).not.toBe(reference);

    const classroom = clone(project);
    classroom.settings.calculationMode = project.settings.calculationMode === 'classroom' ? 'complete' : 'classroom';
    expect(analysisSignature(classroom)).not.toBe(reference);
  });
});
