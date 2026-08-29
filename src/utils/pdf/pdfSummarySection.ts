/**
 * Part 1 — the analysis in one reading: governing figures, the free-body diagram, the
 * equilibrium sums carried out, the reactions, and the numeric quality of the solve.
 *
 * The page this replaces was built at absolute coordinates: four KPI cards at a fixed `y`, a
 * 242-point panel of equilibrium rows on the left and another of reactions on the right, both
 * of which silently stopped at five entries because that was all the box held. A model with
 * nine supports simply lost four of them.
 *
 * Everything flows now. The reactions table prints every restrained node, the equilibrium
 * sums print in full, and the page breaks by itself when the model is large.
 */
import type { DiagramQuantity } from '../../types';
import { resolveNumericQualityState } from '../../engine/reliability';
import { clearCell, clearDisplay, clearNumber, display, unitFor } from './pdfFormat';
import { drawGlobalDcl } from './pdfDiagrams';
import { equilibriumSums } from './pdfSubstitution';
import { TYPE } from './pdfTheme';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

/** Largest |value| of a quantity across the model, preferring the engine's critical points. */
const absoluteExtreme = (
  context: ReportContext,
  quantity: DiagramQuantity,
): { value: number; memberId: string; x: number } | undefined => {
  let best: { value: number; memberId: string; x: number } | undefined;
  for (const result of context.analysis.memberResults) {
    const critical = result.criticalPoints.filter((point) => point.quantity === quantity);
    const candidates = critical.length
      ? critical.map((point) => ({ value: point.value, memberId: result.memberId, x: point.x }))
      : result.diagram.map((point) => ({ value: point[quantity], memberId: result.memberId, x: point.x }));
    for (const candidate of candidates) {
      if (!best || Math.abs(candidate.value) > Math.abs(best.value)) best = candidate;
    }
  }
  return best;
};

export const drawSummaryPart = (context: ReportContext): void => {
  const { layout, project, analysis } = context;
  const { palette, fonts } = layout;

  layout.part('Resumen del análisis', 'Cifras gobernantes, diagrama de cuerpo libre, equilibrio y calidad numérica.');

  const axial = absoluteExtreme(context, 'axial');
  const shear = absoluteExtreme(context, 'shear');
  const moment = absoluteExtreme(context, 'moment');
  const reactionMaximum = analysis.nodeResults.reduce(
    (best, result) => Math.max(best, Math.abs(result.rx), Math.abs(result.ry)),
    0,
  );

  const station = (entry: typeof axial): string | undefined =>
    entry ? `${entry.memberId} · x = ${display(project, entry.x, 'length')}` : undefined;

  layout.metrics([
    {
      label: 'Reacción máxima',
      value: clearDisplay(project, reactionMaximum, 'force', reactionMaximum),
      detail: `${analysis.nodeResults.filter((node) => Math.abs(node.rx) + Math.abs(node.ry) + Math.abs(node.rm) > 0).length} apoyos con reacción`,
      color: palette.reaction,
    },
    {
      label: '|N| máximo',
      value: axial ? clearDisplay(project, Math.abs(axial.value), 'force', Math.abs(axial.value)) : 'n/d',
      detail: station(axial),
      color: palette.quantity.axial,
    },
    {
      label: '|V| máximo',
      value: shear ? clearDisplay(project, Math.abs(shear.value), 'force', Math.abs(shear.value)) : 'n/d',
      detail: station(shear),
      color: palette.quantity.shear,
    },
    {
      label: '|M| máximo',
      value: moment ? clearDisplay(project, Math.abs(moment.value), 'moment', Math.abs(moment.value)) : 'n/d',
      detail: station(moment),
      color: palette.quantity.moment,
    },
  ]);

  layout.figure(
    206,
    (rect) => drawGlobalDcl(context, rect, true),
    'Diagrama de cuerpo libre: geometría, apoyos, acciones aplicadas y reacciones obtenidas.',
  );

  layout.heading('Equilibrio global');
  layout.text(
    'Las tres sumas que cierran el modelo, escritas con los números que se sumaron: la resultante '
    + 'de las acciones aplicadas y, término a término, la reacción de cada apoyo.',
  );
  for (const sum of equilibriumSums(context)) {
    layout.ensure(layout.measureMathBlock(sum.equation, TYPE.body, 12));
    layout.y -= layout.drawMathBlockAt(sum.equation, TYPE.body, 12, palette.ink, `(${layout.nextEquationNumber()})`);
  }
  layout.gap();
  layout.keyValues([
    ['Residuo normalizado del cierre', clearNumber(analysis.equilibrium.normalizedResidual)],
    ['Residuo algebraico del sistema', clearNumber(analysis.residualNorm)],
    ['Número de condición estimado', clearNumber(analysis.conditionEstimate)],
  ]);

  layout.heading('Reacciones en los apoyos');
  const supported = analysis.nodeResults.filter((node) => Math.abs(node.rx) + Math.abs(node.ry) + Math.abs(node.rm) > 1e-10);
  if (!supported.length) {
    layout.note('El modelo no reporta ninguna reacción distinta de cero.');
  } else {
    layout.table(
      [
        { header: 'Nodo', width: 90 },
        { header: `Rx (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `Ry (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M (${unitFor(project, 'moment')})`, ...NUMERIC },
      ],
      supported.map((node) => [
        node.nodeId,
        clearCell(project, node.rx, 'force', reactionMaximum),
        clearCell(project, node.ry, 'force', reactionMaximum),
        clearCell(project, node.rm, 'moment', moment ? Math.abs(moment.value) : 1),
      ]),
    );
  }

  const quality = resolveNumericQualityState(analysis);
  const qualityLabel = {
    stable: 'estable',
    limited: 'limitada',
    unreliable: 'no confiable',
    failed: 'fallida',
    unavailable: 'no disponible',
  }[quality];
  const tone = quality === 'stable' ? 'ok' : quality === 'limited' ? 'warn' : 'danger';
  layout.callout(
    tone,
    `Calidad numérica: ${qualityLabel}`,
    `Número de condición estimado ${clearNumber(analysis.conditionEstimate)}; residuo lineal `
    + `${clearNumber(analysis.linearResidual ?? analysis.residualNorm)}; cota de error `
    + `${clearNumber(analysis.forwardErrorBound ?? Number.NaN)}. Es un diagnóstico del solver: `
    + 'mide cuánto puede confiarse en la aritmética, no si la estructura es segura.',
  );

  const formulation = analysis.educationTrace?.formulation ?? 'análisis estático lineal 2D';
  layout.heading('Hipótesis de esta corrida', 2);
  layout.text(
    `${analysis.pDelta?.experimental ? 'P-Delta experimental; ' : ''}${formulation}; pequeñas deformaciones; `
    + 'propiedades prismáticas por miembro.',
    TYPE.small,
    fonts.regular,
    palette.inkSoft,
  );
};
