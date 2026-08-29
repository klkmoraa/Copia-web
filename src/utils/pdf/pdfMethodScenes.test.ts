/**
 * The geometry of every method's free-body diagram.
 *
 * These drawings carry claims a reader will act on — which portion of the truss the cut kept,
 * which way a bar's force points, where along the beam the section was taken — and a drawing
 * that lies about any of them is worse than no drawing at all. A scene is a plain object, so
 * each of those claims is asserted directly, without a PDF page anywhere near the test.
 */
import { describe, expect, it } from 'vitest';
import {
  createHibbelerStyleDiagramPractice,
  createHibbelerStyleTrussPractice,
} from '../../data/defaultProject';
import { analyzeProject } from '../../engine/solver';
import { solveMethodOfSections } from '../../analysis-methods/methodOfSections';
import { solveMethodOfJoints } from '../../analysis-methods/methodOfJoints';
import { solveDoubleIntegration } from '../../analysis-methods/doubleIntegration';
import { solvePortalMethod } from '../../analysis-methods/portalMethod';
import { axialDirection } from './pdfFreeBody';
import {
  cutLineThrough,
  doubleIntegrationScenes,
  jointScenes,
  sectionCutScenes,
  storeyCutScenes,
} from './pdfMethodScenes';
import { createModelIndex, type ReportContext } from './reportContext';
import type { ProjectModel } from '../../types';

/**
 * A context with everything the scene builders read and nothing they do not.
 *
 * The builders never touch `layout`, `payload` or `options` — that is the whole point of
 * keeping them pure — so the cast documents the seam rather than hiding a dependency.
 */
const contextFor = (project: ProjectModel): ReportContext => {
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  return {
    project,
    analysis,
    index: createModelIndex(project, analysis),
    scenarioFactors: Object.fromEntries(project.loadCases.filter((entry) => entry.active).map((entry) => [entry.id, 1])),
    options: {},
  } as unknown as ReportContext;
};

const FRAME = { type: 'frame' as const, E: 200e6, A: 0.01, I: 8e-5 };

const proppedCantilever = (): ProjectModel => ({
  ...createHibbelerStyleDiagramPractice(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 6, y: 0, support: { type: 'roller', angleDeg: 90 } },
  ],
  members: [{ id: 'AB', i: 'A', j: 'B', ...FRAME }],
  nodalLoads: [],
  memberLoads: [{
    id: 'W-AB', memberId: 'AB', caseId: 'LC1', type: 'distributed', coordinateSystem: 'global',
    lengthBasis: 'real', start: 0, end: 1, qxStart: 0, qxEnd: 0, qyStart: -10, qyEnd: -10,
  }],
});

const lateralFrame = (): ProjectModel => ({
  ...createHibbelerStyleDiagramPractice(),
  nodes: [
    { id: 'A', x: 0, y: 0, support: { type: 'fixed' } },
    { id: 'B', x: 6, y: 0, support: { type: 'fixed' } },
    { id: 'C', x: 0, y: 4, support: { type: 'none' } },
    { id: 'D', x: 6, y: 4, support: { type: 'none' } },
  ],
  members: [
    { id: 'AC', i: 'A', j: 'C', ...FRAME },
    { id: 'BD', i: 'B', j: 'D', ...FRAME },
    { id: 'CD', i: 'C', j: 'D', ...FRAME },
  ],
  nodalLoads: [{ id: 'H', nodeId: 'C', caseId: 'LC1', fx: 20, fy: 0, mz: 0 }],
  memberLoads: [],
});

describe('axialDirection', () => {
  it('saca la barra traccionada del cuerpo y mete la comprimida', () => {
    const context = contextFor(createHibbelerStyleTrussPractice());
    const member = context.project.members[0];
    const tension = axialDirection(context, member.id, member.i, 10);
    const compression = axialDirection(context, member.id, member.i, -10);
    expect(tension).toBeDefined();
    expect(compression).toBeDefined();
    // Exactly opposite: the same bar, the same end, the opposite sign.
    expect(compression!.fx).toBeCloseTo(-tension!.fx, 12);
    expect(compression!.fy).toBeCloseTo(-tension!.fy, 12);
    // And a bar in tension pulls the retained node towards its far end.
    const here = context.index.node(member.i)!;
    const far = context.index.node(member.j)!;
    expect(Math.sign(tension!.fx)).toBe(Math.sign(far.x - here.x) || Math.sign(tension!.fx));
  });

  it('mide desde el extremo que se conserva, no siempre desde i', () => {
    const context = contextFor(createHibbelerStyleTrussPractice());
    const member = context.project.members[0];
    const fromI = axialDirection(context, member.id, member.i, 10)!;
    const fromJ = axialDirection(context, member.id, member.j, 10)!;
    expect(fromJ.fx).toBeCloseTo(-fromI.fx, 12);
    expect(fromJ.fy).toBeCloseTo(-fromI.fy, 12);
  });
});

describe('cutLineThrough', () => {
  it('cruza una sola barra perpendicularmente a su eje', () => {
    const context = contextFor(createHibbelerStyleTrussPractice());
    const member = context.project.members.find((entry) => entry.id === 'AB')!;
    const line = cutLineThrough(context, [member.id])!;
    expect(line).toBeDefined();
    const ni = context.index.node(member.i)!;
    const nj = context.index.node(member.j)!;
    const bar = { x: nj.x - ni.x, y: nj.y - ni.y };
    const cut = { x: line.to.x - line.from.x, y: line.to.y - line.from.y };
    expect(bar.x * cut.x + bar.y * cut.y).toBeCloseTo(0, 9);
    // And it passes through the bar's midpoint, which is where the cut severs it.
    expect((line.from.x + line.to.x) / 2).toBeCloseTo((ni.x + nj.x) / 2, 9);
    expect((line.from.y + line.to.y) / 2).toBeCloseTo((ni.y + nj.y) / 2, 9);
  });

  it('rebasa los puntos medios extremos, para que el trazo cruce las barras y no muera en su eje', () => {
    const context = contextFor(createHibbelerStyleTrussPractice());
    const ids = context.project.members.slice(0, 2).map((member) => member.id);
    const line = cutLineThrough(context, ids)!;
    const midpoints = ids.map((id) => {
      const member = context.index.member(id)!;
      const ni = context.index.node(member.i)!;
      const nj = context.index.node(member.j)!;
      return { x: (ni.x + nj.x) / 2, y: (ni.y + nj.y) / 2 };
    });
    const between = Math.hypot(midpoints[1].x - midpoints[0].x, midpoints[1].y - midpoints[0].y);
    const drawn = Math.hypot(line.to.x - line.from.x, line.to.y - line.from.y);
    expect(drawn).toBeGreaterThan(between);
  });

  it('no inventa un corte cuando ninguna barra existe', () => {
    const context = contextFor(createHibbelerStyleTrussPractice());
    expect(cutLineThrough(context, ['no-existe'])).toBeUndefined();
  });
});

describe('sectionCutScenes', () => {
  it('dibuja un cuerpo libre por corte, con el lado conservado del método', () => {
    const project = createHibbelerStyleTrussPractice();
    const context = contextFor(project);
    const solution = solveMethodOfSections(project, context.analysis, null);
    expect(solution.applicable).toBe(true);
    if (!solution.applicable) return;

    const scenes = sectionCutScenes(context, solution);
    expect(scenes).toHaveLength(solution.cuts.length);
    for (const [index, scene] of scenes.entries()) {
      const cut = solution.cuts[index];
      expect(scene.keptNodeIds).toEqual(cut.keptNodeIds);
      // Never a member with an end on the discarded side: that member is severed, not kept.
      for (const memberId of scene.keptMemberIds ?? []) {
        const member = context.index.member(memberId)!;
        expect(cut.keptNodeIds).toContain(member.i);
        expect(cut.keptNodeIds).toContain(member.j);
      }
      // One arrow per severed bar, plus the external actions of the retained side.
      const barLabels = (scene.forces ?? []).filter((force) => force.label.startsWith('N('));
      expect(barLabels).toHaveLength(cut.members.length);
      expect(barLabels.every((force) => force.anchor === 'tail')).toBe(true);
    }
  });

  it('rotula tracción y compresión por el signo que resolvió el método', () => {
    const project = createHibbelerStyleTrussPractice();
    const context = contextFor(project);
    const solution = solveMethodOfSections(project, context.analysis, null);
    if (!solution.applicable) return;
    for (const [index, scene] of sectionCutScenes(context, solution).entries()) {
      for (const bar of solution.cuts[index].members) {
        const force = (scene.forces ?? []).find((entry) => entry.label.startsWith(`N(${bar.memberId})`));
        expect(force, bar.memberId).toBeDefined();
        expect(force!.label).toContain(bar.value > 0 ? '(T)' : '(C)');
      }
    }
  });
});

describe('jointScenes', () => {
  it('encuadra cada nudo y le trae todas sus barras concurrentes', () => {
    const project = createHibbelerStyleTrussPractice();
    const context = contextFor(project);
    const solution = solveMethodOfJoints(project, context.analysis, null);
    expect(solution.applicable).toBe(true);
    if (!solution.applicable) return;

    const scenes = jointScenes(context, solution);
    expect(scenes).toHaveLength(solution.steps.length);
    for (const [index, scene] of scenes.entries()) {
      const step = solution.steps[index];
      expect(scene.focus?.nodeId).toBe(step.nodeId);
      expect(scene.focus!.radius).toBeGreaterThan(0);
      const meeting = project.members.filter((member) => member.i === step.nodeId || member.j === step.nodeId);
      expect(new Set(scene.keptMemberIds)).toEqual(new Set(meeting.map((member) => member.id)));
    }
  });
});

describe('doubleIntegrationScenes', () => {
  it('corta dentro del tramo y conserva sólo lo que queda a su izquierda', () => {
    const project = proppedCantilever();
    const context = contextFor(project);
    const solution = solveDoubleIntegration(project, context.analysis, null);
    expect(solution.applicable).toBe(true);
    if (!solution.applicable) return;

    const scenes = doubleIntegrationScenes(context, solution);
    expect(scenes).toHaveLength(solution.segments.length);
    for (const [index, scene] of scenes.entries()) {
      const segment = solution.segments[index];
      const partial = scene.partialMember!;
      expect(partial.memberId).toBe('AB');
      // The station is inside the stretch, and the ratio locates it along the member.
      const station = partial.ratio * 6;
      expect(station).toBeGreaterThanOrEqual(segment.x0 - 1e-9);
      expect(station).toBeLessThanOrEqual(segment.x1 + 1e-9);
      expect(partial.keep).toBe('start');
      expect(scene.includeMemberLoads).toBe(true);
      // V and M are on the cut face, and nothing else claims to be a response there.
      expect((scene.forces ?? []).some((force) => force.label === 'V(x)')).toBe(true);
      expect((scene.moments ?? []).some((moment) => moment.label === 'M(x)')).toBe(true);
    }
  });
});

describe('storeyCutScenes', () => {
  it('corta a la altura del punto de inflexión y conserva lo que hay por encima', () => {
    const project = lateralFrame();
    const context = contextFor(project);
    const solution = solvePortalMethod(project, null);
    expect(solution.applicable).toBe(true);
    if (!solution.applicable) return;

    const scenes = storeyCutScenes(context, solution.columns, solution.storyShear);
    expect(scenes.length).toBeGreaterThan(0);
    const [scene] = scenes;
    const cutY = scene.cut!.from.y;
    expect(scene.cut!.to.y).toBeCloseTo(cutY, 9);
    // Everything the scene keeps really is above the cut.
    for (const nodeId of scene.keptNodeIds ?? []) {
      expect(context.index.node(nodeId)!.y).toBeGreaterThanOrEqual(cutY - 1e-9);
    }
    // The columns are severed, so they are not kept; the beam above the cut is.
    expect(scene.keptMemberIds).toContain('CD');
    expect(scene.keptMemberIds).not.toContain('AC');
    // One shear arrow per column of the storey.
    const shears = (scene.forces ?? []).filter((force) => force.label.startsWith('V') && force.tone === 'shear');
    expect(shears).toHaveLength(solution.columns.filter((column) => column.story === 1).length);
  });
});
