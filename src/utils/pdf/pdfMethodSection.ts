/**
 * The chosen solution method, written out with this project's own numbers.
 *
 * Section 5 used to state the matrix method's generic relations and stop there: true, but not
 * a procedure anyone could follow to this beam. When a method is selected, this section takes
 * its place and develops it the way a textbook does — static classification, redundants,
 * moment per stretch, the two integrations, the conditions that close the system, the solved
 * constants, the reactions checked against the solver, and the elastic curve.
 *
 * Every figure printed here was solved by `src/analysis-methods/`, and every one of them is
 * required to agree with the analysis the rest of the document reports. The verification row
 * is not decoration: it is the reader's evidence that the two paths met.
 */
import { solveDoubleIntegration, type DoubleIntegrationResult } from '../../analysis-methods/doubleIntegration';
import { drawElasticCurve } from './pdfDiagrams';
import { clearNumber, displayCell, number, unitFor } from './pdfFormat';
import { pdfText } from './pdfGlyphs';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

/** `32.5 − 5x + 0.5x²` from coefficient array, in the global axis variable. */
const expression = (coefficients: readonly number[], variable = 'x'): string => {
  const reference = coefficients.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  const terms: string[] = [];
  coefficients.forEach((coefficient, power) => {
    if (Math.abs(coefficient) <= Math.max(reference, 1) * 1e-10) return;
    const magnitude = clearNumber(Math.abs(coefficient), Math.max(reference, 1), 5);
    const factor = power === 0 ? magnitude : power === 1 ? `${magnitude} ${variable}` : `${magnitude} ${variable}^${power}`;
    const sign = coefficient < 0 ? '−' : '+';
    terms.push(terms.length === 0 ? `${coefficient < 0 ? '−' : ''}${factor}` : `${sign} ${factor}`);
  });
  return terms.join(' ') || '0';
};

const drawDoubleIntegration = (context: ReportContext, solution: DoubleIntegrationResult): void => {
  const { layout, project } = context;
  const { fonts, rgb, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const scaleLabel = solution.uniformEI ? 'EI ' : '';

  layout.heading('5. Procedimiento: Método de la Doble Integración');
  layout.text(
    'La ecuación de la elástica, EI y″(x) = M(x), se integra dos veces. Cada integración deja una '
    + 'constante por tramo, y en una viga hiperestática las reacciones redundantes son incógnitas más: '
    + 'las condiciones de contorno y de continuidad las determinan todas a la vez.',
    8.7, fonts.regular, undefined, 8,
  );
  for (const relation of ['EI y″(x) = M(x)', 'EI θ(x) = ∫ M dx + C', 'EI y(x) = ∫∫ M dx dx + C x + C′']) {
    layout.ensure(layout.measureMathBlock(relation, 9, 16));
    layout.y -= layout.drawMathBlockAt(relation, 9, 16, rgb(0.24, 0.28, 0.34));
  }

  layout.heading('5.1 Clasificación estática', 2);
  const degree = solution.classification.indeterminacy;
  layout.text(
    degree === 0
      ? `La viga es isostática: las ${solution.classification.reactionCount} componentes de reacción quedan determinadas por la estática.`
      : `g = ${degree}: la viga es hiperestática de grado ${degree}, así que ${degree === 1 ? 'una reacción es incógnita' : `${degree} reacciones son incógnitas`} hasta imponer la compatibilidad.`,
    8.7, fonts.regular, undefined, 8,
  );

  if (solution.redundants.length) {
    layout.heading('5.2 Redundantes elegidas y verificadas', 2);
    layout.text(
      'Se liberan estos apoyos para dejar una estructura isostática cuyo diagrama de momentos se puede '
      + 'seguir; su reacción pasa a ser la incógnita. La última columna es lo que el análisis matricial '
      + 'obtiene en ese mismo apoyo: el método y el solver tienen que coincidir.',
      8.3, fonts.regular, undefined, 8,
    );
    layout.table(
      [
        { header: 'Redundante', width: 74, math: true },
        { header: 'Apoyo', width: 64 },
        { header: `Doble integración (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `Análisis matricial (${unitFor(project, 'force')})`, ...NUMERIC },
      ],
      solution.redundants.map((redundant) => [
        redundant.symbol,
        redundant.nodeId,
        displayCell(project, redundant.value, 'force'),
        displayCell(project, redundant.solverReaction, 'force'),
      ]),
      { size: 7.8 },
    );
  }

  layout.heading(`5.${solution.redundants.length ? 3 : 2} Momento, giro y flecha por tramos`, 2);
  layout.text(
    solution.uniformEI
      ? `Con EI = ${number(solution.EI, 6)} kN·m² constante, se factoriza y las expresiones se escriben como EI θ y EI y. La variable x se mide desde el extremo izquierdo de la viga.`
      : 'La rigidez cambia entre tramos, así que EI no se puede factorizar: las expresiones son directamente θ(x) e y(x). La variable x se mide desde el extremo izquierdo de la viga.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const [index, segment] of solution.segments.entries()) {
    layout.ensure(58);
    layout.text(
      `Tramo ${index + 1}: de x = ${number(segment.x0, 5)} a x = ${number(segment.x1, 5)} ${lengthUnit}`,
      8, fonts.bold, palette.forestDeep, 8,
    );
    for (const relation of [
      `M(x) = ${expression(segment.moment)}`,
      `${scaleLabel}θ(x) = ${expression(segment.slope)}`,
      `${scaleLabel}y(x) = ${expression(segment.deflection)}`,
    ]) {
      layout.ensure(layout.measureMathBlock(relation, 8.4, 20));
      layout.y -= layout.drawMathBlockAt(relation, 8.4, 20, rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
    }
  }

  layout.heading(`5.${solution.redundants.length ? 4 : 3} Condiciones y sistema resuelto`, 2);
  layout.text(
    `${solution.conditions.length} condiciones para ${solution.constants.length + solution.redundants.length} incógnitas: `
    + 'continuidad de giro y flecha en cada frontera entre tramos, flecha nula en cada apoyo y giro nulo '
    + 'en cada empotramiento. El sistema es cuadrado por construcción.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [{ header: 'Condición', flex: 2.2, math: true }, { header: 'Tipo', width: 84 }, { header: `x (${lengthUnit})`, ...NUMERIC, width: 58 }],
    solution.conditions.map((condition) => [
      condition.statement,
      condition.kind === 'continuity' ? 'continuidad' : condition.kind === 'slope' ? 'giro impuesto' : 'flecha impuesta',
      number(condition.x, 5),
    ]),
    { size: 7.4 },
  );
  layout.table(
    [{ header: 'Constante', width: 74, math: true }, { header: 'Valor', ...NUMERIC }],
    solution.constants.map((constant) => [constant.symbol, clearNumber(constant.value, Math.max(1, Math.abs(constant.value)))]),
    { size: 7.6 },
  );

  layout.heading(`5.${solution.redundants.length ? 5 : 4} Verificación contra el análisis matricial`, 2);
  layout.text(
    'Los dos caminos parten del mismo modelo y llegan por separado: si no coincidieran, el procedimiento '
    + 'de arriba estaría mal. Estas son las diferencias máximas medidas.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [{ header: 'Contraste', flex: 2 }, { header: 'Diferencia máxima', ...NUMERIC }, { header: 'Unidad', width: 74 }],
    [
      ['Reacciones redundantes', clearNumber(solution.reactionResidual, 1), unitFor(project, 'force')],
      ['Flecha a lo largo de la viga', clearNumber(solution.deflectionResidual, 1), unitFor(project, 'length')],
    ],
    { size: 7.8 },
  );

  const peakAbsolute = Math.abs(solution.maxDeflection.value);
  layout.text(
    `Flecha máxima ${displayCell(project, peakAbsolute, 'length')} ${lengthUnit} en x = ${number(solution.maxDeflection.x, 5)} ${lengthUnit}.`,
    8.7, fonts.bold, palette.forestDeep, 8,
  );

  layout.ensure(120);
  layout.y -= 8;
  drawElasticCurve(
    layout,
    solution.segments.map((segment) => ({
      x0: segment.x0,
      x1: segment.x1,
      deflection: segment.deflection,
    })),
    solution.axis.length,
    layout.margin,
    layout.y - 104,
    layout.contentWidth,
    104,
    palette.quantity.moment,
  );
  layout.y -= 112;
};

/**
 * Draws the selected method's section, or reports that it could not.
 *
 * Returns `false` when no method-specific section was written, so the caller can fall back to
 * the generic procedure rather than leaving the document with a hole where section 5 was.
 */
export const drawMethodSection = (context: ReportContext): boolean => {
  const { project, analysis } = context;
  if (project.settings.solutionMethod !== 'double-integration') return false;
  const solution = solveDoubleIntegration(project, analysis, null);
  if (!solution.applicable) {
    context.layout.text(
      pdfText('El método elegido no aplica a esta estructura; el procedimiento se reporta con el método matricial.'),
      8.3, context.layout.fonts.regular, undefined, 8,
    );
    return false;
  }
  drawDoubleIntegration(context, solution);
  return true;
};
