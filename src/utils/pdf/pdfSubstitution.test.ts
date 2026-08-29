/**
 * The report's promise about its own equations: every relation it prints is one that was
 * carried out, with this project's numbers, and the arithmetic closes.
 *
 * These assertions look at the strings themselves rather than at the rendered page, because
 * a displayed equation is drawn as vector geometry (`mathVector.ts`) and carries no
 * extractable text — the PDF-level tests can only see the `(n)` tag beside it.
 */
import { describe, expect, it } from 'vitest';
import {
  createHibbelerStyleDiagramPractice,
  createHibbelerStyleTrussPractice,
  createHibbelerTributaryBeam,
} from '../../data/defaultProject';
import { analyzeProject } from '../../engine/solver';
import { createPortablePayload } from '../portablePayload';
import { createModelIndex, type ReportContext } from './reportContext';
import {
  equilibriumSums,
  freeBodyEquations,
  quantityConstructionSteps,
  quantitySlopeEquation,
  stepSubstitutions,
} from './pdfSubstitution';
import type { ProjectModel } from '../../types';

const buildContext = async (project: ProjectModel): Promise<ReportContext> => {
  const analysis = analyzeProject(project);
  expect(analysis.success).toBe(true);
  const payload = await createPortablePayload(project, analysis, { generatedAt: '2026-07-16T12:00:00.000Z' });
  return {
    // No page is drawn here, so the layout is never touched: these builders only read the model.
    layout: undefined as unknown as ReportContext['layout'],
    project,
    analysis,
    payload,
    options: {},
    scenarioFactors: Object.fromEntries(project.loadCases.filter((entry) => entry.active).map((entry) => [entry.id, 1])),
    index: createModelIndex(project, analysis),
  };
};

const equations = (context: ReportContext, stepId: string): string[] =>
  stepSubstitutions(context, stepId).flatMap((block) => block.equations);

describe('ecuaciones sustituidas de la memoria', () => {
  it('escribe la geometría con las coordenadas reales, no con Xⱼ − Xᵢ', async () => {
    const context = await buildContext(createHibbelerStyleDiagramPractice());
    const geometry = equations(context, 'geometry');
    // A(0,0) -> B(8,0): the subtraction, the radical and both direction cosines, all resolved.
    expect(geometry).toContain('ΔX = 8 − 0 = 8 m');
    expect(geometry).toContain('L = √(8² + 0²) = 8 m');
    expect(geometry).toContain('c = 8/8 = 1');
    for (const equation of geometry) expect(equation).not.toMatch(/Xⱼ|ΔX²|\(x\)/);
  });

  it('desarrolla la rigidez del elemento como el producto que realmente se hizo', async () => {
    const context = await buildContext(createHibbelerStyleDiagramPractice());
    const stiffness = equations(context, 'stiffness');
    // E·A/L = 2e8 · 0.01 / 8 = 250000 kN/m, and the same figure the annex's own K reports.
    expect(stiffness).toContain('EA/L = 2e+8 · 0.01 / 8 = 250000 kN/m');
    expect(stiffness.some((equation) => equation.startsWith('12EI/L³ = 12 · 2e+8 · 8e-5 / 8³ ='))).toBe(true);
  });

  it('localiza el extremo del momento resolviendo V = 0 con los números del tramo', async () => {
    const context = await buildContext(createHibbelerStyleDiagramPractice());
    const diagrams = equations(context, 'diagrams');
    expect(diagrams.some((equation) => /^V\(s\) = 32\.5 - 5 s/.test(equation))).toBe(true);
    // The first stretch never reaches V = 0 (it ends at 3 m), so no station is claimed there.
    expect(diagrams.some((equation) => equation.startsWith('V = 0 →'))).toBe(false);
  });

  it('suma el equilibrio término a término y cierra en el valor del motor', async () => {
    const context = await buildContext(createHibbelerStyleDiagramPractice());
    const [, vertical] = equilibriumSums(context);
    // -60 kN applied, +32.5 and +27.5 at the two supports.
    expect(vertical.equation).toBe('ΣF_y = -60 + 32.5 + 27.5 = 0 kN');
    expect(vertical.result).toBe('0 kN');
  });

  it('nunca inventa una expansión que no reproduzca la suma del motor', async () => {
    const context = await buildContext(createHibbelerStyleDiagramPractice());
    const broken: ReportContext = {
      ...context,
      // A reaction the solver never produced: the expansion no longer closes, so it is dropped
      // and only the engine's own closing value survives.
      analysis: {
        ...context.analysis,
        nodeResults: context.analysis.nodeResults.map((node) => ({ ...node, ry: node.ry + 5 })),
      },
    };
    const [, vertical] = equilibriumSums(broken);
    expect(vertical.equation).toBe('ΣF_y = 0 kN');
  });

  it('reporta la pendiente medida del diagrama, no la relación diferencial', async () => {
    const context = await buildContext(createHibbelerStyleDiagramPractice());
    const result = context.analysis.memberResults[0];
    expect(quantitySlopeEquation(context, 'shear', result)).toBe('dV/ds = -5 kN/m');
    expect(quantitySlopeEquation(context, 'moment', result)).toBe('dM/ds = 32.5 kN - 2 · 2.5 s');
    const steps = quantityConstructionSteps(context, 'shear', result);
    expect(steps[0]).toBe('Se parte de V(0) = 32.5 kN.');
    expect(steps[2]).toBe('Cierra en V(3 m) = 17.5 kN.');
    for (const step of steps) expect(step).not.toMatch(/q\(x\)|p\(x\)|V\(x\)/);
  });

  it('cierra el equilibrio de un nudo de armadura con las fuerzas y los cosenos reales', async () => {
    const context = await buildContext(createHibbelerStyleTrussPractice());
    // The bars meeting A, with the axial force the analysis itself reports for each.
    const bars = context.project.members
      .filter((member) => member.i === 'A' || member.j === 'A')
      .map((member) => ({
        memberId: member.id,
        nodeId: 'A',
        force: context.index.memberResult(member.id)?.diagram[0]?.axial ?? 0,
      }));
    const equations = freeBodyEquations(context, ['A'], bars);
    // Two sums, each ending on an exact zero, each term written as force x direction cosine.
    expect(equations).toHaveLength(2);
    expect(equations[0]).toMatch(/^ΣF_x = .*= 0 kN$/);
    expect(equations[1]).toMatch(/^ΣF_y = .*= 0 kN$/);
    expect(equations[0]).toMatch(/\)\(/);
    for (const equation of equations) expect(equation).not.toMatch(/ΣFx = 0|[A-Za-z]_i\b/);
  });

  it('no desarrolla un cuerpo libre que no puede integrar', async () => {
    // The beam carries member loads, whose distributed contribution this helper does not
    // integrate: it declines rather than print a sum missing a term.
    const context = await buildContext(createHibbelerStyleDiagramPractice());
    expect(freeBodyEquations(context, ['A'], [{ memberId: 'AB', nodeId: 'A', force: 0 }])).toEqual([]);
  });

  it('convierte cada operando al mismo sistema, también en unidades imperiales', async () => {
    // The tributary beam is reported in kip-ft. `EA/L` must stay a coherent product there:
    // E in kip/ft², A in ft², L in ft — never E in ksi beside A in in².
    const context = await buildContext(createHibbelerTributaryBeam());
    expect(context.project.settings.units).toBe('kip-ft');
    const stiffness = equations(context, 'stiffness');
    const axial = stiffness.find((equation) => equation.startsWith('EA/L'));
    expect(axial).toBeDefined();
    const [, left, right] = /EA\/L = (\S+) · (\S+) \/ (\S+) = (\S+) kip\/ft/.exec(axial ?? '') ?? [];
    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(axial).toMatch(/kip\/ft$/);
  });
});
