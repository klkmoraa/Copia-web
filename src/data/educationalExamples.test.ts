import { describe, expect, it } from 'vitest';
import { evaluateDiagramAt } from '../engine/diagram';
import { evaluateEducationalAssertions } from '../engine/educationalAssertions';
import { analyzeProject } from '../engine/solver';
import { toDisplay } from '../engine/units';
import {
  createHibbelerStyleDiagramPractice,
  createHibbelerStyleTrussPractice,
  createHibbelerTributaryBeam,
} from './defaultProject';

const close = (actual: number, expected: number, rtol = 2e-7, atol = 1e-9) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(atol + rtol * Math.max(1, Math.abs(actual), Math.abs(expected)));
};

describe('ejemplos educativos Hibbeler y prácticas originales', () => {
  it('reproduce la viga tributaria pública de la Fig. 2-11', () => {
    const project = createHibbelerTributaryBeam();
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(toDisplay(result.nodeResults[0].ry, 'kip-ft', 'force'), 2.5);
    close(toDisplay(result.nodeResults[1].ry, 'kip-ft', 'force'), 2.5);
    const member = result.memberResults[0];
    const middle = evaluateDiagramAt(member.diagramSegments, member.diagramJumps, member.length / 2)!;
    close(toDisplay(middle.moment, 'kip-ft', 'moment'), 6.25);
    expect(project.educationalCase?.kind).toBe('attributed-example');
    expect(evaluateEducationalAssertions(project.educationalCase?.expectedAssertions ?? [], result).every((entry) => entry.passed)).toBe(true);
  });

  it('resuelve la práctica original de carga uniforme más puntual', () => {
    const project = createHibbelerStyleDiagramPractice();
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, 32.5);
    close(result.nodeResults[1].ry, 27.5);
    const member = result.memberResults[0];
    const atLoad = evaluateDiagramAt(member.diagramSegments, member.diagramJumps, 3, 'right')!;
    close(atLoad.moment, 75);
    expect(project.educationalCase?.note).toMatch(/no reproduce/i);
    expect(evaluateEducationalAssertions(project.educationalCase?.expectedAssertions ?? [], result).every((entry) => entry.passed)).toBe(true);
  });

  it('resuelve la práctica original de armadura 3-4-5', () => {
    const project = createHibbelerStyleTrussPractice();
    const result = analyzeProject(project);
    expect(result.success).toBe(true);
    close(result.nodeResults[0].ry, 30);
    close(result.nodeResults[1].ry, 30);
    const forces = Object.fromEntries(result.memberResults.map((member) => [member.memberId, member.diagram[0].axial]));
    close(forces.AB, 22.5);
    close(forces.AC, -37.5);
    close(forces.BC, -37.5);
    expect(evaluateEducationalAssertions(project.educationalCase?.expectedAssertions ?? [], result).every((entry) => entry.passed)).toBe(true);
  });
});
