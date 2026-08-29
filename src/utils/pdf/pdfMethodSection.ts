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
import { solveCantileverMethod, type CantileverMethodResult } from '../../analysis-methods/cantileverMethod';
import { solveDoubleIntegration, type DoubleIntegrationResult } from '../../analysis-methods/doubleIntegration';
import { solveConjugateBeam, type ConjugateBeamResult, type ConjugateSupportKind } from '../../analysis-methods/conjugateBeam';
import { solveThreeMoment, type ThreeMomentResult } from '../../analysis-methods/threeMoment';
import { solveHardyCross, type HardyCrossResult } from '../../analysis-methods/hardyCross';
import { solveKaniFrame, type KaniResult } from '../../analysis-methods/kaniFrame';
import { solvePortalMethod, type PortalMethodResult } from '../../analysis-methods/portalMethod';
import { solveVirtualWork, type VirtualWorkResult } from '../../analysis-methods/virtualWork';
import { solveMethodOfSections, type MethodOfSectionsResult } from '../../analysis-methods/methodOfSections';
import { solveMethodOfJoints, type MethodOfJointsResult } from '../../analysis-methods/methodOfJoints';
import { solveCastiglianoTruss, type CastiglianoTrussResult } from '../../analysis-methods/castiglianoTruss';
import { drawElasticCurve } from './pdfDiagrams';
import { clearNumber, displayCell, number, unitFor } from './pdfFormat';
import {
  agrees,
  dimensionalFigure,
  dimensionalUnit,
  dimensionalValue,
  freeBodyEquations,
  signedSum,
} from './pdfSubstitution';
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

/**
 * A worked block: the caption naming what the arithmetic belongs to, then the numbered
 * display equations. Every method section reaches for this, so that "the real calculation"
 * looks the same wherever the reader finds it.
 */
const drawWorked = (context: ReportContext, caption: string | undefined, equations: readonly string[]): void => {
  if (!equations.length) return;
  const { layout } = context;
  if (caption) layout.text(caption, 7.9, layout.fonts.bold, layout.palette.ink, 12);
  for (const equation of equations) {
    layout.ensure(layout.measureMathBlock(equation, 8.4, 16));
    layout.y -= layout.drawMathBlockAt(equation, 8.4, 16, layout.rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
  }
};

/**
 * Both approximate frame methods close a beam the same way: the two end moments over the span.
 * The quotient is printed only where it really returns the shear the method reported, so a
 * beam whose ends were resolved by some other route never gets a made-up derivation.
 */
interface ApproximateBeam {
  readonly bayIndex: number;
  readonly story: number;
  readonly span: number;
  readonly moment: number;
  readonly shear: number;
}

const beamShearEquations = (
  context: ReportContext,
  beams: readonly ApproximateBeam[],
  lineLabel: (index: number) => string,
): string[] => {
  const { project } = context;
  const scale = Math.max(1, ...beams.map((beam) => Math.abs(beam.shear)));
  return beams.flatMap((beam) => {
    if (!(beam.span > 0)) return [];
    const derived = 2 * beam.moment / beam.span;
    if (!agrees(Math.abs(derived), Math.abs(beam.shear), scale)) return [];
    return [
      `V(${lineLabel(beam.bayIndex)}–${lineLabel(beam.bayIndex + 1)}, planta ${beam.story})`
      + ` = 2 · ${dimensionalFigure(project, Math.abs(beam.moment), 1, 1)}/${dimensionalFigure(project, beam.span, 0, 1)}`
      + ` = ${dimensionalFigure(project, Math.abs(beam.shear), 1, 0, scale)} ${unitFor(project, 'force')}`,
    ];
  });
};

const drawDoubleIntegration = (context: ReportContext, solution: DoubleIntegrationResult): void => {
  const { layout, project } = context;
  const { fonts, rgb, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const scaleLabel = solution.uniformEI ? 'EI ' : '';

  layout.heading('5. Procedimiento: Método de la Doble Integración');
  layout.text(
    'La ecuación de la elástica se integra dos veces: la primera integración del momento da el giro, '
    + 'la segunda la flecha. Cada integración deja una constante por tramo, y en una viga hiperestática '
    + 'las reacciones redundantes son incógnitas más: las condiciones de contorno y de continuidad las '
    + 'determinan todas a la vez. Todo lo que sigue son esas integrales ya resueltas, con los '
    + 'coeficientes reales de esta viga.',
    8.7, fonts.regular, undefined, 8,
  );
  // The three generic relations that used to sit here — `EI y″ = M`, and its two integrals —
  // are the method, not this beam. They are developed with real coefficients a few lines
  // below, one set per stretch, so printing them again as symbols only delayed the numbers.

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
      8, fonts.bold, palette.ink, 8,
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
    8.7, fonts.bold, palette.ink, 8,
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

const CONJUGATE_KIND_LABEL: Record<ConjugateSupportKind, string> = {
  fixed: 'empotramiento',
  simple: 'apoyo simple',
  guided: 'apoyo deslizante (guía)',
  free: 'extremo libre',
};

const drawConjugateBeam = (context: ReportContext, solution: ConjugateBeamResult): void => {
  const { layout, project } = context;
  const { fonts, rgb, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const scaleLabel = solution.uniformEI ? 'EI ' : '';

  layout.heading('5. Procedimiento: Método de la Viga Conjugada');
  layout.text(
    'La elástica se resuelve sin integrar a mano: se construye una segunda viga, la conjugada, '
    + 'cargada con el diagrama de momentos de la real dividido por su rigidez, y cada apoyo se '
    + 'convierte por una tabla fija '
    + '— un apoyo simple sigue siendo simple, un empotramiento pasa a extremo libre, un extremo libre '
    + 'pasa a empotramiento. El giro y la flecha de la viga real son entonces el cortante y el momento '
    + 'de esa viga ficticia, que se hallan por la misma estática de siempre.',
    8.7, fonts.regular, undefined, 8,
  );
  // `w* = M/EI`, `θ = V*`, `y = M*` state the correspondence; §5.3 below carries it out with
  // this beam's own coefficients, stretch by stretch, which is what the reader checks.

  layout.heading('5.1 Clasificación estática', 2);
  layout.text(
    `La viga es isostática: las ${solution.classification.reactionCount} componentes de reacción quedan `
    + 'determinadas por la estática, y no hay apoyo ni rótula entre los dos extremos — condición que '
    + 'la tabla de conversión de apoyos exige.',
    8.7, fonts.regular, undefined, 8,
  );

  layout.heading('5.2 Conversión de apoyos', 2);
  layout.text(
    'Cada extremo real se convierte en su contrapartida conjugada. Cuando el conjugado tiene una '
    + 'reacción de fuerza, su valor es el giro real en ese punto; cuando tiene una reacción de '
    + 'momento, su valor es la flecha real ahí.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Nudo', width: 60 },
      { header: 'Apoyo real', width: 96 },
      { header: 'Apoyo conjugado', width: 96 },
      { header: `Reacción·fuerza (${scaleLabel}θ)`, ...NUMERIC },
      { header: `Reacción·momento (${scaleLabel}y)`, ...NUMERIC },
    ],
    solution.ends.map((end) => [
      end.nodeId,
      CONJUGATE_KIND_LABEL[end.realKind],
      CONJUGATE_KIND_LABEL[end.conjugateKind],
      end.reactionForce === undefined ? '—' : clearNumber(end.reactionForce, Math.max(1, Math.abs(end.reactionForce))),
      end.reactionMoment === undefined ? '—' : clearNumber(end.reactionMoment, Math.max(1, Math.abs(end.reactionMoment))),
    ]),
    { size: 7.8 },
  );

  layout.heading('5.3 Carga ficticia, cortante y momento del conjugado por tramo', 2);
  layout.text(
    solution.uniformEI
      ? `Con EI = ${number(solution.EI, 6)} kN·m² constante, se factoriza y las expresiones se escriben como EI θ y EI y. La variable x se mide desde el extremo izquierdo de la viga.`
      : 'La rigidez cambia entre tramos, así que EI no se puede factorizar: las expresiones son directamente θ(x) e y(x). La variable x se mide desde el extremo izquierdo de la viga.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const [index, segment] of solution.segments.entries()) {
    layout.ensure(70);
    layout.text(
      `Tramo ${index + 1}: de x = ${number(segment.x0, 5)} a x = ${number(segment.x1, 5)} ${lengthUnit}`,
      8, fonts.bold, palette.ink, 8,
    );
    for (const relation of [
      `M(x) = ${expression(segment.moment)}`,
      `w*(x) = ${expression(segment.fictitiousLoad)}`,
      `${scaleLabel}θ(x) = V*(x) = ${expression(segment.conjugateShear)}`,
      `${scaleLabel}y(x) = M*(x) = ${expression(segment.conjugateMoment)}`,
    ]) {
      layout.ensure(layout.measureMathBlock(relation, 8.4, 20));
      layout.y -= layout.drawMathBlockAt(relation, 8.4, 20, rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
    }
  }

  layout.heading('5.4 Condiciones y sistema resuelto', 2);
  layout.text(
    `${solution.conditions.length} condiciones para ${solution.constants.length} incógnitas: continuidad de `
    + 'giro y flecha en cada frontera entre tramos, flecha nula en cada apoyo y giro nulo en cada '
    + 'empotramiento. El sistema es cuadrado por construcción.',
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

  layout.heading('5.5 Verificación contra el análisis matricial', 2);
  layout.text(
    'Los dos caminos parten del mismo modelo y llegan por separado: si no coincidieran, el procedimiento '
    + 'de arriba estaría mal. Estas son las diferencias máximas medidas.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [{ header: 'Contraste', flex: 2 }, { header: 'Diferencia máxima', ...NUMERIC }, { header: 'Unidad', width: 74 }],
    [
      ['Giro a lo largo de la viga', clearNumber(solution.slopeResidual, 1), 'rad'],
      ['Flecha a lo largo de la viga', clearNumber(solution.deflectionResidual, 1), unitFor(project, 'length')],
    ],
    { size: 7.8 },
  );

  const peakAbsolute = Math.abs(solution.maxDeflection.value);
  layout.text(
    `Flecha máxima ${displayCell(project, peakAbsolute, 'length')} ${lengthUnit} en x = ${number(solution.maxDeflection.x, 5)} ${lengthUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );

  layout.ensure(120);
  layout.y -= 8;
  drawElasticCurve(
    layout,
    solution.segments.map((segment) => ({
      x0: segment.x0,
      x1: segment.x1,
      deflection: segment.conjugateMoment,
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

const drawThreeMoment = (context: ReportContext, solution: ThreeMomentResult): void => {
  const { layout, project } = context;
  const { fonts, rgb, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');

  layout.heading('5. Procedimiento: Teorema de los Tres Momentos');
  layout.text(
    'La incógnita aquí no es una reacción, como en la doble integración, sino el momento en cada '
    + 'apoyo interior. Cada vano se resuelve primero como si fuera una viga simplemente apoyada '
    + 'bajo sus propias cargas — el «momento libre» — y la ecuación de Clapeyron impone, en cada '
    + 'apoyo interior, que la pendiente que ese momento libre produciría a cada lado, corregida '
    + 'por los momentos de apoyo todavía desconocidos, coincida entre ambos vanos.',
    8.7, fonts.regular, undefined, 8,
  );
  // Clapeyron's equation used to be printed as the identity and left there. What follows is
  // the same equation once, per interior support, with this beam's own spans, stiffnesses,
  // first moments and solved support moments substituted in — and it is only printed when
  // both sides really do close on the solved moments, so the memoir never shows an equality
  // that its own numbers do not satisfy.
  for (const [k, span] of solution.spans.slice(0, -1).entries()) {
    const right = solution.spans[k + 1];
    const left = span;
    const moments = solution.supportMoments;
    const [mPrev, mHere, mNext] = [moments[k]?.value ?? 0, moments[k + 1]?.value ?? 0, moments[k + 2]?.value ?? 0];
    const flexLeft = left.length / left.EI;
    const flexRight = right.length / right.EI;
    const lhs = flexLeft * mPrev + 2 * (flexLeft + flexRight) * mHere + flexRight * mNext;
    const rhs = -6 * (left.firstMomentLeft / (left.EI * left.length) + right.firstMomentRight / (right.EI * right.length));
    if (Math.abs(lhs - rhs) > 1e-6 * Math.max(1, Math.abs(rhs))) continue;
    const flex = (value: number) => dimensionalFigure(project, value, -1, -1, Math.max(flexLeft, flexRight));
    const moment = (value: number) => dimensionalFigure(project, value, 1, 1, Math.max(1, Math.abs(mPrev), Math.abs(mHere), Math.abs(mNext)));
    const equation = `${flex(flexLeft)}(${moment(mPrev)}) + 2(${flex(flexLeft)} + ${flex(flexRight)})(${moment(mHere)})`
      + ` + ${flex(flexRight)}(${moment(mNext)}) = ${number(lhs, 6)} = ${number(rhs, 6)}`
      + ` = −6(${dimensionalFigure(project, left.firstMomentLeft, 1, 3)}/${dimensionalFigure(project, left.EI * left.length, 1, 3)}`
      + ` + ${dimensionalFigure(project, right.firstMomentRight, 1, 3)}/${dimensionalFigure(project, right.EI * right.length, 1, 3)})`;
    layout.text(
      `Apoyo interior ${moments[k + 1]?.nodeId ?? k + 1}: los coeficientes van en 1/(${unitFor(project, 'force')}·${lengthUnit}) y los momentos en ${momentUnit}.`,
      7.9, fonts.bold, palette.ink, 12,
    );
    layout.ensure(layout.measureMathBlock(equation, 8.4, 16));
    layout.y -= layout.drawMathBlockAt(equation, 8.4, 16, rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
  }

  layout.heading('5.1 Clasificación estática', 2);
  const degree = solution.classification.indeterminacy;
  layout.text(
    `g = ${degree}: ${degree} apoyo${degree === 1 ? '' : 's'} interior${degree === 1 ? '' : 'es'}, y otras tantas ecuaciones de Clapeyron — una por cada pareja de vanos consecutivos.`,
    8.7, fonts.regular, undefined, 8,
  );

  layout.heading('5.2 Vanos y momento libre', 2);
  layout.text(
    'El vano n se resuelve como viga simplemente apoyada entre sus dos apoyos, bajo sus propias '
    + 'cargas. Aₙaₙ y Aₙbₙ son el primer momento de ese diagrama respecto de cada extremo — lo '
    + 'que la ecuación de Clapeyron necesita, no el área ni el centroide por separado.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Vano', width: 70 },
      { header: `L (${lengthUnit})`, ...NUMERIC },
      { header: 'EI (kN·m²)', ...NUMERIC },
      { header: `Aₙaₙ (kN·m³)`, ...NUMERIC, math: true },
      { header: `Aₙbₙ (kN·m³)`, ...NUMERIC, math: true },
    ],
    solution.spans.map((span) => [
      `${span.leftNodeId}–${span.rightNodeId}`,
      number(span.length, 5),
      number(span.EI, 6),
      clearNumber(span.firstMomentLeft, Math.max(1, Math.abs(span.firstMomentLeft))),
      clearNumber(span.firstMomentRight, Math.max(1, Math.abs(span.firstMomentRight))),
    ]),
    { size: 7.6 },
  );

  layout.heading('5.3 Momentos de apoyo resueltos', 2);
  layout.text(
    'La última columna es lo que el análisis matricial reporta en ese mismo apoyo: el método y '
    + 'el solver tienen que coincidir.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Apoyo', width: 90, math: true },
      { header: `Tres momentos (${momentUnit})`, ...NUMERIC },
      { header: `Análisis matricial (${momentUnit})`, ...NUMERIC },
    ],
    solution.supportMoments.map((entry) => [
      `${entry.symbol} — ${entry.nodeId}`,
      displayCell(project, entry.value, 'moment'),
      displayCell(project, entry.solverMoment, 'moment'),
    ]),
    { size: 7.8 },
  );

  layout.heading('5.4 Momento final por tramo', 2);
  layout.text(
    'El momento libre de cada vano, más la corrección lineal entre los momentos de apoyo que ya se '
    + 'resolvieron. La variable x se mide desde el extremo izquierdo de la viga, y los coeficientes '
    + 'de abajo son los de esta viga.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const [index, segment] of solution.segments.entries()) {
    layout.ensure(40);
    layout.text(
      `Tramo ${index + 1}: de x = ${number(segment.x0, 5)} a x = ${number(segment.x1, 5)} ${lengthUnit}`,
      8, fonts.bold, palette.ink, 8,
    );
    const expressionText = `M(x) = ${expression(segment.moment)}`;
    layout.ensure(layout.measureMathBlock(expressionText, 8.4, 20));
    layout.y -= layout.drawMathBlockAt(expressionText, 8.4, 20, rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
  }

  layout.heading('5.5 Verificación contra el análisis matricial', 2);
  layout.text(
    'Los dos caminos parten del mismo modelo y llegan por separado: si no coincidieran, el '
    + 'procedimiento de arriba estaría mal. Ésta es la diferencia máxima medida, entre el momento '
    + 'de apoyo que resuelve este método y el que reporta el análisis matricial en ese mismo punto.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.text(
    `Diferencia máxima: ${clearNumber(solution.momentResidual, 1)} ${momentUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const drawVirtualWork = (context: ReportContext, solution: VirtualWorkResult): void => {
  const { layout, project } = context;
  const { fonts, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const componentLabel = (component: 'ux' | 'uy') => (component === 'ux' ? 'horizontal' : 'vertical');

  layout.heading('5. Procedimiento: Trabajo Virtual (carga unitaria)');
  layout.text(
    'Para hallar el desplazamiento de un nudo se retira la carga real, se aplica una única carga '
    + 'virtual unitaria en ese nudo y en la dirección de interés, y se halla la fuerza que esa '
    + 'carga virtual produce en cada barra. El desplazamiento es la suma, en toda la armadura, de '
    + 'la fuerza real de cada barra por su fuerza virtual y su longitud, entre su rigidez axial:',
    8.7, fonts.regular, undefined, 8,
  );
  // The identity `Δ = Σ nNL/AE` is replaced by the sum this truss actually adds up: one
  // quotient per bar, with its own virtual force, real force, length and axial stiffness,
  // and the total that came out. The sum is checked against the value the method solved for
  // before it is printed, so what appears is arithmetic that closes.
  const contributions = solution.narrated.contributions;
  const contributionTotal = contributions.reduce((sum, entry) => sum + entry.contribution, 0);
  if (contributions.length && Math.abs(contributionTotal - solution.narrated.total) <= 1e-8 * Math.max(1, Math.abs(solution.narrated.total))) {
    const forceScale = Math.max(1, ...contributions.map((entry) => Math.abs(entry.axialForce)));
    const terms = contributions.slice(0, 8).map((entry) => (
      `(${number(entry.virtualForce, 5)})(${dimensionalFigure(project, entry.axialForce, 1, 0, forceScale)})`
      + `(${dimensionalFigure(project, entry.length, 0, 1)})/`
      + `((${dimensionalFigure(project, entry.A, 0, 2)})(${dimensionalFigure(project, entry.E, 1, -2)}))`
    ));
    const shown = contributions.length > 8 ? [...terms, '...'] : terms;
    const equation = `Δ = ${shown.join(' + ')} = ${dimensionalFigure(project, solution.narrated.total, 0, 1)} ${lengthUnit}`;
    layout.text(
      `Nudo ${solution.narrated.nodeId}, componente ${componentLabel(solution.narrated.component)}:`
      + ` fuerzas en ${forceUnit}, longitudes en ${lengthUnit}, áreas en ${dimensionalUnit(project, 0, 2)}, E en ${dimensionalUnit(project, 1, -2)}.`,
      7.9, fonts.bold, palette.ink, 12,
    );
    layout.ensure(layout.measureMathBlock(equation, 8.4, 16));
    layout.y -= layout.drawMathBlockAt(equation, 8.4, 16, layout.rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
  }

  layout.heading('5.1 Desplazamientos en cada nudo libre', 2);
  layout.text(
    'La última columna es lo que el análisis matricial reporta en ese mismo grado de libertad: '
    + 'el método y el solver tienen que coincidir.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Nudo', width: 60 },
      { header: 'Componente', width: 90 },
      { header: `Trabajo virtual (${lengthUnit})`, ...NUMERIC },
      { header: `Análisis matricial (${lengthUnit})`, ...NUMERIC },
    ],
    solution.displacements.map((entry) => [
      entry.nodeId,
      componentLabel(entry.component),
      displayCell(project, entry.value, 'length'),
      displayCell(project, entry.solverValue, 'length'),
    ]),
    { size: 7.8 },
  );

  layout.heading(`5.2 Detalle por barra: ${solution.narrated.nodeId}, componente ${componentLabel(solution.narrated.component)}`, 2);
  layout.text(
    'El nudo con mayor desplazamiento, desarrollado barra por barra: Nᵢ es la fuerza bajo la '
    + 'carga real, nᵢ la fuerza bajo la carga virtual unitaria.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Barra', width: 56 },
      { header: `L (${lengthUnit})`, ...NUMERIC },
      { header: `Nᵢ (${forceUnit})`, ...NUMERIC, math: true },
      { header: 'nᵢ', ...NUMERIC, math: true },
      { header: `Aporte (${lengthUnit})`, ...NUMERIC },
    ],
    solution.narrated.contributions.map((entry) => [
      entry.memberId,
      number(entry.length, 5),
      displayCell(project, entry.axialForce, 'force'),
      clearNumber(entry.virtualForce, Math.max(1, Math.abs(entry.virtualForce))),
      displayCell(project, entry.contribution, 'length'),
    ]),
    { size: 7.6 },
  );

  layout.heading('5.3 Verificación contra el análisis matricial', 2);
  layout.text(
    `Diferencia máxima entre este método y el análisis matricial, en cualquier grado de libertad: ${clearNumber(solution.residual, 1)} ${lengthUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const drawCastiglianoTruss = (context: ReportContext, solution: CastiglianoTrussResult): void => {
  const { layout, project } = context;
  const { fonts, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const componentLabel = (component: 'ux' | 'uy') => (component === 'ux' ? 'horizontal' : 'vertical');

  layout.heading('5. Procedimiento: Castigliano (teorema del trabajo mínimo)');
  layout.text(
    'La armadura tiene más reacciones de las que el equilibrio por sí solo puede fijar. El '
    + 'teorema del trabajo mínimo dice que la energía de deformación es estacionaria respecto de '
    + 'cada reacción redundante — y para una armadura articulada, esa condición es exactamente el '
    + 'trabajo virtual: el desplazamiento de la estructura liberada en la dirección de cada '
    + 'redundante, bajo las cargas reales y el resto de redundantes, tiene que ser cero, porque en '
    + 'la estructura real ese apoyo no se mueve.',
    8.7, fonts.regular, undefined, 8,
  );
  // The stationarity condition is stated in the paragraph above; printing `∂U/∂Xₖ = 0` again
  // as symbols added no figure. What each redundant actually came out as, and the force it
  // leaves in every bar, are the tables of §5.2 and §5.3 below — all of them real values,
  // each next to what the matrix analysis reports at the same place.

  layout.heading('5.1 Clasificación estática', 2);
  layout.text(
    `g = ${solution.classification.indeterminacy}: la armadura es externamente hiperestática de ese grado. Se liberan esas reacciones para dejar una armadura isostática —la estructura primaria— cuya fuerza de barra bajo las cargas reales se puede seguir.`,
    8.7, fonts.regular, undefined, 8,
  );

  layout.heading('5.2 Redundantes elegidas y verificadas', 2);
  layout.text(
    'La última columna es lo que el análisis matricial obtiene en ese mismo apoyo, sobre la '
    + 'estructura original: el método y el solver tienen que coincidir.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Redundante', width: 60, math: true },
      { header: 'Apoyo', width: 60 },
      { header: 'Dirección', width: 76 },
      { header: `Castigliano (${forceUnit})`, ...NUMERIC },
      { header: `Análisis matricial (${forceUnit})`, ...NUMERIC },
    ],
    solution.redundants.map((redundant) => [
      redundant.symbol,
      redundant.nodeId,
      componentLabel(redundant.component),
      displayCell(project, redundant.value, 'force'),
      displayCell(project, redundant.solverReaction, 'force'),
    ]),
    { size: 7.8 },
  );

  layout.heading('5.3 Fuerza final en cada barra', 2);
  layout.text(
    'Fuerza en la estructura primaria bajo las cargas reales, más la contribución de cada '
    + 'redundante ya resuelta — contrastada, barra por barra, contra el análisis matricial de la '
    + 'estructura original.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Barra', width: 56 },
      { header: `L (${lengthUnit})`, ...NUMERIC },
      { header: `Primaria N₀ (${forceUnit})`, ...NUMERIC, math: true },
      { header: `Final (${forceUnit})`, ...NUMERIC },
      { header: `Análisis matricial (${forceUnit})`, ...NUMERIC },
    ],
    solution.members.map((member) => [
      member.memberId,
      number(member.length, 5),
      displayCell(project, member.primaryForce, 'force'),
      displayCell(project, member.force, 'force'),
      displayCell(project, member.solverForce, 'force'),
    ]),
    { size: 7.4 },
  );

  // The final force of every bar, as the sum that produced it. With a single redundant the
  // influence coefficient is recoverable exactly — it is the change per unit of X — so the
  // product is written out; with several redundants only their combined contribution is
  // separable, and that is what gets printed rather than a factor nobody could check.
  const single = solution.redundants.length === 1 ? solution.redundants[0] : undefined;
  const forceScale = Math.max(1, ...solution.members.map((member) => Math.abs(member.force)));
  drawWorked(
    context,
    single
      ? `Fuerza final de cada barra: la primaria más la contribución de ${single.symbol} = ${displayCell(project, single.value, 'force')} ${forceUnit}.`
      : `Fuerza final de cada barra: la primaria más la contribución conjunta de las ${solution.redundants.length} redundantes, en ${forceUnit}.`,
    solution.members.slice(0, 10).map((member) => {
      const contribution = member.force - member.primaryForce;
      const primary = dimensionalFigure(project, member.primaryForce, 1, 0, forceScale);
      const total = dimensionalFigure(project, member.force, 1, 0, forceScale);
      if (single && Math.abs(single.value) > 1e-9) {
        const influence = contribution / single.value;
        return `N(${member.memberId}) = ${primary} + (${number(influence, 6)})(${dimensionalFigure(project, single.value, 1, 0, forceScale)}) = ${total} ${forceUnit}`;
      }
      return `N(${member.memberId}) = ${primary} + ${dimensionalFigure(project, contribution, 1, 0, forceScale)} = ${total} ${forceUnit}`;
    }),
  );

  layout.heading('5.4 Verificación contra el análisis matricial', 2);
  layout.text(
    `Diferencia máxima: ${clearNumber(solution.reactionResidual, 1)} ${forceUnit} en las reacciones redundantes, `
    + `${clearNumber(solution.forceResidual, 1)} ${forceUnit} en la fuerza de barra.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const drawHardyCross = (context: ReportContext, solution: HardyCrossResult): void => {
  const { layout, project } = context;
  const { fonts, rgb, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');

  layout.heading('5. Procedimiento: Hardy Cross (distribución de momentos)');
  layout.text(
    'Cada vano se empotra en imaginación en sus dos extremos y se calcula el momento que '
    + 'desarrollaría así, bajo sus propias cargas — el momento de empotramiento perfecto. Cada '
    + 'apoyo interior reparte ese desequilibrio entre sus vanos, en proporción a la rigidez '
    + 'relativa de cada uno, y transmite la mitad de lo repartido al extremo lejano de ese vano. '
    + 'Repitiendo esto apoyo por apoyo, el desequilibrio se hace cada vez más pequeño hasta '
    + 'desaparecer — sin resolver ningún sistema de ecuaciones.',
    8.7, fonts.regular, undefined, 8,
  );
  layout.text(
    'En los dos extremos simples de la viga, el momento de empotramiento perfecto se libera de '
    + 'una vez: se transmite la mitad al apoyo vecino y ese extremo no vuelve a tocarse, y la '
    + 'rigidez de ese vano baja una cuarta parte para reflejarlo. Las rigideces que la tabla de '
    + 'abajo lista son ya las usadas en el reparto.',
    8.3, fonts.regular, undefined, 8,
  );

  layout.heading('5.1 Momentos de empotramiento perfecto y rigidez por vano', 2);
  layout.table(
    [
      { header: 'Vano', width: 70 },
      { header: `L (${lengthUnit})`, ...NUMERIC },
      { header: `FEM izq. (${momentUnit})`, ...NUMERIC },
      { header: `FEM der. (${momentUnit})`, ...NUMERIC },
      { header: 'Rigidez izq.', ...NUMERIC },
      { header: 'Rigidez der.', ...NUMERIC },
    ],
    solution.spans.map((span) => [
      `${span.leftNodeId}–${span.rightNodeId}`,
      number(span.length, 5),
      displayCell(project, span.fixedEndMomentLeft, 'moment'),
      displayCell(project, span.fixedEndMomentRight, 'moment'),
      clearNumber(span.stiffnessLeft, Math.max(1, Math.abs(span.stiffnessLeft))),
      clearNumber(span.stiffnessRight, Math.max(1, Math.abs(span.stiffnessRight))),
    ]),
    { size: 7.6 },
  );

  // The distribution factor is the whole method, and it is a quotient of two numbers that are
  // already in the table above. Written out per joint, the reader can repeat the split by hand.
  for (const [k, span] of solution.spans.slice(0, -1).entries()) {
    const right = solution.spans[k + 1];
    const kLeft = span.stiffnessRight;
    const kRight = right.stiffnessLeft;
    const total = kLeft + kRight;
    if (!(total > 0)) continue;
    const stiffness = (value: number) => dimensionalFigure(project, value, 1, 2, total);
    drawWorked(context, `Apoyo interior ${span.rightNodeId}: rigideces en ${dimensionalUnit(project, 1, 2)}.`, [
      `ΣK(${span.rightNodeId}) = ${stiffness(kLeft)} + ${stiffness(kRight)} = ${stiffness(total)}`,
      `D(${span.leftNodeId}–${span.rightNodeId}) = ${stiffness(kLeft)}/${stiffness(total)} = ${number(kLeft / total, 6)}`,
      `D(${right.leftNodeId}–${right.rightNodeId}) = ${stiffness(kRight)}/${stiffness(total)} = ${number(kRight / total, 6)}`,
    ]);
  }

  layout.heading('5.2 Momentos de apoyo tras converger', 2);
  layout.text(
    `El reparto convergió en ${solution.iterationCount} pasada${solution.iterationCount === 1 ? '' : 's'} `
    + '(ningún apoyo quedó con desequilibrio medible). La última columna es lo que el análisis '
    + 'matricial obtiene en ese mismo apoyo: el método y el solver tienen que coincidir.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Apoyo', width: 90 },
      { header: `Hardy Cross (${momentUnit})`, ...NUMERIC },
      { header: `Análisis matricial (${momentUnit})`, ...NUMERIC },
    ],
    solution.joints.map((joint) => [
      joint.nodeId,
      displayCell(project, joint.value, 'moment'),
      displayCell(project, joint.solverMoment, 'moment'),
    ]),
    { size: 7.8 },
  );

  layout.heading('5.3 Momento final por tramo', 2);
  layout.text(
    'El momento libre de cada vano —el que tendría como viga simplemente apoyada bajo sus '
    + 'propias cargas— más la corrección lineal entre los momentos de apoyo ya convergidos. La '
    + 'variable x se mide desde el extremo izquierdo de la viga.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const [index, segment] of solution.segments.entries()) {
    layout.ensure(40);
    layout.text(
      `Tramo ${index + 1}: de x = ${number(segment.x0, 5)} a x = ${number(segment.x1, 5)} ${lengthUnit}`,
      8, fonts.bold, palette.ink, 8,
    );
    const expressionText = `M(x) = ${expression(segment.moment)}`;
    layout.ensure(layout.measureMathBlock(expressionText, 8.4, 20));
    layout.y -= layout.drawMathBlockAt(expressionText, 8.4, 20, rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
  }

  layout.heading('5.4 Verificación contra el análisis matricial', 2);
  layout.text(
    'Los dos caminos parten del mismo modelo y llegan por separado: si no coincidieran, el '
    + 'procedimiento de arriba estaría mal. Ésta es la diferencia máxima medida, entre el momento '
    + 'de apoyo que resuelve este método y el que reporta el análisis matricial en ese mismo punto.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.text(
    `Diferencia máxima: ${clearNumber(solution.momentResidual, 1)} ${momentUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const drawKaniFrame = (context: ReportContext, solution: KaniResult): void => {
  const { layout, project } = context;
  const { fonts, rgb, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const momentUnit = unitFor(project, 'moment');

  layout.heading('5. Procedimiento: Kani (rotación de nudos)');
  layout.text(
    'Cada barra se empotra en imaginación en sus dos extremos y se calcula el momento que '
    + 'desarrollaría así bajo sus propias cargas — el momento de empotramiento perfecto, igual '
    + 'que en Hardy Cross. Pero en vez de repartir y acarrear, cada nudo lleva un único «momento '
    + 'de rotación» por barra que se recalcula en cada pasada a partir de los momentos de '
    + 'rotación actuales en el otro extremo de cada barra que concurre en él. Repetido nudo por '
    + 'nudo, converge sin resolver ningún sistema de ecuaciones — y, a diferencia de Hardy Cross, '
    + 'trabaja de una vez sobre un nudo con más de dos barras, como cualquier nudo real de un '
    + 'pórtico.',
    8.7, fonts.regular, undefined, 8,
  );
  // `μᵢⱼ = −½(Kᵢⱼ/ΣKᵢ)` is the rule; below it is carried out on the busiest joint of this
  // frame, with each bar's own EI/L, the sum they add up to, and the factor that came out.
  const jointStiffness = new Map<string, { memberId: string; k: number }[]>();
  for (const member of solution.members) {
    const k = member.EI / member.length;
    for (const nodeId of [member.nodeI, member.nodeJ]) {
      jointStiffness.set(nodeId, [...(jointStiffness.get(nodeId) ?? []), { memberId: member.memberId, k }]);
    }
  }
  const busiest = [...jointStiffness.entries()].reduce<[string, { memberId: string; k: number }[]] | undefined>(
    (best, entry) => !best || entry[1].length > best[1].length ? entry : best,
    undefined,
  );
  if (busiest && busiest[1].length > 1) {
    const [nodeId, bars] = busiest;
    const total = bars.reduce((sum, bar) => sum + bar.k, 0);
    const stiffness = (value: number) => dimensionalFigure(project, value, 1, 2, total);
    layout.text(
      `Nudo ${nodeId}: rigideces K = EI/L en ${dimensionalUnit(project, 1, 2)}.`,
      7.9, fonts.bold, palette.ink, 12,
    );
    const sumEquation = `ΣK(${nodeId}) = ${bars.map((bar) => stiffness(bar.k)).join(' + ')} = ${stiffness(total)}`;
    layout.ensure(layout.measureMathBlock(sumEquation, 8.4, 16));
    layout.y -= layout.drawMathBlockAt(sumEquation, 8.4, 16, rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
    for (const bar of bars) {
      const factor = -0.5 * (bar.k / total);
      const equation = `μ(${bar.memberId}) = −½ · ${stiffness(bar.k)}/${stiffness(total)} = ${number(factor, 6)}`;
      layout.ensure(layout.measureMathBlock(equation, 8.4, 16));
      layout.y -= layout.drawMathBlockAt(equation, 8.4, 16, rgb(0.24, 0.28, 0.34), `(${layout.nextEquationNumber()})`);
    }
  }
  layout.text(
    'El método no lleva término de bamboleo lateral: sólo es exacto si el pórtico no se '
    + 'desplaza lateralmente bajo esta carga. Eso no se supone por la geometría — se comprueba '
    + 'contrastando el resultado contra el análisis matricial, y si la brecha no es del tamaño '
    + 'del ruido numérico, el método se retira en vez de narrar una aproximación sin decirlo.',
    8.3, fonts.regular, palette.ink, 8,
  );

  layout.heading('5.1 Momento de empotramiento perfecto y momento final por barra', 2);
  layout.text(
    `El reparto convergió en ${solution.iterationCount} pasada${solution.iterationCount === 1 ? '' : 's'}. `
    + 'Las dos últimas columnas son lo que el análisis matricial obtiene en esos mismos extremos: '
    + 'el método y el solver tienen que coincidir.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Barra', width: 60 },
      { header: `L (${lengthUnit})`, ...NUMERIC },
      { header: `FEM i (${momentUnit})`, ...NUMERIC },
      { header: `FEM j (${momentUnit})`, ...NUMERIC },
      { header: `M final i (${momentUnit})`, ...NUMERIC },
      { header: `M final j (${momentUnit})`, ...NUMERIC },
      { header: `Matricial i (${momentUnit})`, ...NUMERIC },
      { header: `Matricial j (${momentUnit})`, ...NUMERIC },
    ],
    solution.members.map((member) => [
      `${member.nodeI}–${member.nodeJ}`,
      number(member.length, 5),
      displayCell(project, member.fixedEndMomentI, 'moment'),
      displayCell(project, member.fixedEndMomentJ, 'moment'),
      displayCell(project, member.finalMomentI, 'moment'),
      displayCell(project, member.finalMomentJ, 'moment'),
      displayCell(project, member.solverMomentI, 'moment'),
      displayCell(project, member.solverMomentJ, 'moment'),
    ]),
    { size: 7 },
  );

  layout.heading('5.2 Verificación contra el análisis matricial', 2);
  layout.text(
    `Diferencia máxima, en cualquier extremo de cualquier barra: ${clearNumber(solution.momentResidual, 1)} ${momentUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const drawMethodOfSections = (context: ReportContext, solution: MethodOfSectionsResult): void => {
  const { layout, project, index } = context;
  const { fonts, palette } = layout;
  const forceUnit = unitFor(project, 'force');

  layout.heading('5. Procedimiento: Método de los Cortes');
  layout.text(
    'Un corte imaginario divide la armadura en dos, atravesando como mucho tres barras. El '
    + 'equilibrio del lado que se conserva —las dos sumas de fuerzas y la de momentos, con las '
    + 'reacciones y cargas ya conocidas de ese lado— basta para hallar las tres fuerzas de barra '
    + 'que el corte dejó como incógnitas, sin recorrer la armadura nudo por nudo. Debajo de cada '
    + 'corte van esas sumas ya efectuadas, con las fuerzas y los cosenos directores reales.',
    8.7, fonts.regular, undefined, 8,
  );

  layout.heading('5.1 Cortes y fuerzas de barra', 2);
  layout.text(
    'La última columna es lo que el análisis matricial obtiene para esa misma barra: el método '
    + 'y el solver tienen que coincidir.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const [cutIndex, cut] of solution.cuts.entries()) {
    layout.ensure(40);
    layout.text(
      `Corte ${cutIndex + 1}: lado conservado {${cut.keptNodeIds.join(', ')}}`,
      8, fonts.bold, palette.ink, 8,
    );
    layout.table(
      [
        { header: 'Barra', width: 70 },
        { header: `Método de cortes (${forceUnit})`, ...NUMERIC },
        { header: `Análisis matricial (${forceUnit})`, ...NUMERIC },
      ],
      cut.members.map((member) => [
        member.memberId,
        displayCell(project, member.value, 'force'),
        displayCell(project, member.solverValue, 'force'),
      ]),
      { size: 7.6 },
    );
    // The same equilibrium the cut was solved with, added up: each severed bar's force times
    // its own direction cosine, plus the reactions and loads of the retained nodes.
    const kept = new Set(cut.keptNodeIds);
    const bars = cut.members.flatMap((member) => {
      const model = index.member(member.memberId);
      if (!model) return [];
      const nodeId = kept.has(model.i) ? model.i : kept.has(model.j) ? model.j : undefined;
      return nodeId ? [{ memberId: member.memberId, nodeId, force: member.value }] : [];
    });
    drawWorked(context, undefined, freeBodyEquations(context, cut.keptNodeIds, bars));
  }
  if (solution.unresolvedMemberIds.length) {
    layout.text(
      `Sin un corte de tres barras o menos que las aísle: ${solution.unresolvedMemberIds.join(', ')}.`,
      7.8, fonts.regular, undefined, 8,
    );
  }

  layout.heading('5.2 Verificación contra el análisis matricial', 2);
  layout.text(
    `Diferencia máxima, en cualquier barra resuelta: ${clearNumber(solution.residual, 1)} ${forceUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const drawMethodOfJoints = (context: ReportContext, solution: MethodOfJointsResult): void => {
  const { layout, project } = context;
  const { fonts, palette } = layout;
  const forceUnit = unitFor(project, 'force');

  layout.heading('5. Procedimiento: Método de los Nudos');
  layout.text(
    'Cada nudo de la armadura tiene sólo dos ecuaciones de equilibrio —la suma horizontal y la '
    + 'vertical de las fuerzas que concurren en él—, así que '
    + 'un nudo sólo se resuelve de una vez cuando le quedan como mucho dos fuerzas de barra por '
    + 'conocer. El procedimiento recorre los nudos en el orden en que esa condición se va '
    + 'cumpliendo —normalmente empezando en un apoyo o un extremo libre— resolviendo en cada uno '
    + 'las fuerzas que aún faltan a partir de las reacciones, las cargas y las barras ya resueltas '
    + 'que concurren ahí, y repite hasta agotar la armadura.',
    8.7, fonts.regular, undefined, 8,
  );

  layout.heading('5.1 Nudos y fuerzas de barra', 2);
  layout.text(
    'La última columna es lo que el análisis matricial obtiene para esa misma barra: el método y '
    + 'el solver tienen que coincidir. El orden de los nudos es el orden en que el procedimiento '
    + 'pudo resolverlos, no el orden en que aparecen en el modelo.',
    8.3, fonts.regular, undefined, 8,
  );
  for (const [stepIndex, step] of solution.steps.entries()) {
    layout.ensure(40);
    layout.text(`Nudo ${stepIndex + 1}: ${step.nodeId}`, 8, fonts.bold, palette.ink, 8);
    layout.table(
      [
        { header: 'Barra', width: 70 },
        { header: `Método de los nudos (${forceUnit})`, ...NUMERIC },
        { header: `Análisis matricial (${forceUnit})`, ...NUMERIC },
      ],
      step.members.map((member) => [
        member.memberId,
        displayCell(project, member.value, 'force'),
        displayCell(project, member.solverValue, 'force'),
      ]),
      { size: 7.6 },
    );
    // Every bar meeting this joint — the ones just solved and the ones already known — times
    // its direction cosine, plus the reaction and the load applied there: the two sums the
    // reader would write by hand, closed on zero.
    const meeting = project.members
      .filter((member) => member.i === step.nodeId || member.j === step.nodeId)
      .flatMap((member) => {
        const force = solution.steps
          .flatMap((entry) => entry.members)
          .find((entry) => entry.memberId === member.id);
        return force ? [{ memberId: member.id, nodeId: step.nodeId, force: force.value }] : [];
      });
    drawWorked(context, undefined, freeBodyEquations(context, [step.nodeId], meeting));
  }
  if (solution.unresolvedMemberIds.length) {
    layout.text(
      `Ningún nudo llegó a tener dos o menos incógnitas para resolver: ${solution.unresolvedMemberIds.join(', ')}.`,
      7.8, fonts.regular, undefined, 8,
    );
  }

  layout.heading('5.2 Verificación contra el análisis matricial', 2);
  layout.text(
    `Diferencia máxima, en cualquier barra resuelta: ${clearNumber(solution.residual, 1)} ${forceUnit}.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const REJECTION_MESSAGE = 'El método elegido no aplica a esta estructura; el procedimiento se reporta con el método matricial.';

const drawPortalMethod = (context: ReportContext, solution: PortalMethodResult): void => {
  const { layout, project } = context;
  const { fonts, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const momentUnit = unitFor(project, 'moment');
  const lineLabel = (index: number) => String.fromCharCode(65 + index);

  layout.heading('5. Procedimiento: Método del Portal');
  layout.text(
    'Método aproximado para carga lateral sobre un pórtico rectangular. Se apoya en tres '
    + 'hipótesis: el momento se anula a media altura de cada columna y a media luz de cada viga '
    + '(salvo en el primer piso, donde un apoyo que no restringe el giro fuerza el punto de '
    + 'inflexión en el propio apoyo); el cortante de cada planta se reparte entre sus columnas '
    + 'según el ancho tributario de piso que cada una soporta; y con esos cortantes la estructura '
    + 'queda estáticamente determinada: el equilibrio de momento en cada nudo da el momento de '
    + 'cada viga, y el equilibrio vertical, recorrido desde la cubierta hacia abajo, da la axial '
    + 'de cada columna.',
    8.7, fonts.regular, undefined, 8,
  );
  layout.text(
    'A diferencia de un método exacto, éste no tiene por qué coincidir con el análisis matricial: '
    + 'es una simplificación deliberada. Por eso esta sección no exige que las reacciones '
    + 'coincidan — las contrasta, y declara la brecha, para que nadie firme una aproximación '
    + 'creyéndola exacta.',
    8.3, fonts.regular, palette.ink, 8,
  );

  layout.heading('5.1 Retícula y cortante por planta', 2);
  const stories = solution.grid.storyLevels.length - 1;
  layout.text(
    `${solution.grid.columnLines.length} ejes de columna (${solution.grid.columnLines.map((_, index) => lineLabel(index)).join(', ')}) `
    + `y ${stories} planta${stories === 1 ? '' : 's'}. El cortante de cada planta es la carga lateral acumulada de esa `
    + 'planta hacia arriba.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Planta', width: 60 },
      { header: `Cortante de planta (${forceUnit})`, ...NUMERIC },
    ],
    solution.storyShear.map((shear, index) => [String(index + 1), displayCell(project, shear, 'force')]),
    { size: 7.8 },
  );

  // The storey shear is an accumulation, so it is written as one: the lateral load of this
  // storey plus everything already carried down from above.
  const storyLoads = solution.storyShear.map((shear, position) => shear - (solution.storyShear[position + 1] ?? 0));
  const shearScale = Math.max(1, ...solution.storyShear.map((value) => Math.abs(value)));
  drawWorked(
    context,
    `Cortante acumulado de cada planta, en ${forceUnit}.`,
    solution.storyShear.map((shear, position) => {
      const above = storyLoads.slice(position);
      return `V(planta ${position + 1}) = ${signedSum(above.map((value) => dimensionalFigure(project, value, 1, 0, shearScale)))}`
        + ` = ${dimensionalFigure(project, shear, 1, 0, shearScale)} ${forceUnit}`;
    }),
  );

  layout.heading('5.2 Columnas: cortante, momento y axial', 2);
  layout.table(
    [
      { header: 'Columna', width: 56 },
      { header: 'Planta', width: 44 },
      { header: `Ancho trib. (${lengthUnit})`, ...NUMERIC },
      { header: `Cortante (${forceUnit})`, ...NUMERIC },
      { header: `M inferior (${momentUnit})`, ...NUMERIC },
      { header: `M superior (${momentUnit})`, ...NUMERIC },
      { header: `Axial (${forceUnit})`, ...NUMERIC },
    ],
    solution.columns.map((column) => [
      lineLabel(column.columnIndex),
      String(column.story),
      number(column.tributaryWidth, 4),
      displayCell(project, column.shear, 'force'),
      displayCell(project, column.bottomMoment, 'moment'),
      displayCell(project, column.topMoment, 'moment'),
      displayCell(project, column.axial, 'force'),
    ]),
    { size: 7.4 },
  );
  // Every column's shear is its own tributary share of the storey shear, and its two end
  // moments are that shear times the distance to the point of inflection. Both are written as
  // the product that produced them, and only where that product really gives the figure the
  // table above lists.
  for (const story of [...new Set(solution.columns.map((column) => column.story))]) {
    const columns = solution.columns.filter((column) => column.story === story);
    const widthTotal = columns.reduce((sum, column) => sum + column.tributaryWidth, 0);
    const storyShear = solution.storyShear[story - 1] ?? 0;
    if (!(widthTotal > 0)) continue;
    const equations: string[] = [];
    for (const column of columns) {
      const share = storyShear * column.tributaryWidth / widthTotal;
      if (agrees(share, column.shear, storyShear)) {
        equations.push(
          `V(${lineLabel(column.columnIndex)}, planta ${story}) = ${displayCell(project, storyShear, 'force')}`
          + ` · ${number(column.tributaryWidth, 6)}/${number(widthTotal, 6)}`
          + ` = ${displayCell(project, column.shear, 'force')} ${forceUnit}`,
        );
      }
      const lever = column.height * column.inflectionFraction;
      if (Math.abs(column.bottomMoment) > 1e-9 && agrees(Math.abs(column.bottomMoment), Math.abs(column.shear * lever), Math.abs(column.bottomMoment))) {
        equations.push(
          `M_inf(${lineLabel(column.columnIndex)}, planta ${story}) = ${displayCell(project, Math.abs(column.shear), 'force')}`
          + ` · ${number(column.height, 6)} · ${number(column.inflectionFraction, 6)}`
          + ` = ${displayCell(project, Math.abs(column.bottomMoment), 'moment')} ${momentUnit}`,
        );
      }
    }
    drawWorked(context, `Planta ${story}: ancho tributario total ${number(widthTotal, 6)} ${lengthUnit}.`, equations);
  }
  layout.text(
    'Axial positiva es tracción: en carga lateral unidireccional, las columnas de un lado del '
    + 'pórtico entran en tracción y las del lado contrario en compresión — es la pareja de '
    + 'fuerzas que resiste el vuelco.',
    7.8, fonts.regular, undefined, 8,
  );

  layout.heading('5.3 Vigas: momento y cortante', 2);
  layout.table(
    [
      { header: 'Vano', width: 70 },
      { header: 'Planta', width: 44 },
      { header: `Luz (${lengthUnit})`, ...NUMERIC },
      { header: `Momento (${momentUnit})`, ...NUMERIC },
      { header: `Cortante (${forceUnit})`, ...NUMERIC },
    ],
    solution.beams.map((beam) => [
      `${lineLabel(beam.bayIndex)}–${lineLabel(beam.bayIndex + 1)}`,
      String(beam.story),
      number(beam.span, 4),
      displayCell(project, beam.moment, 'moment'),
      displayCell(project, beam.shear, 'force'),
    ]),
    { size: 7.4 },
  );
  drawWorked(context, `Cortante de cada viga, desde los dos momentos de sus extremos (${momentUnit} y ${forceUnit}).`, beamShearEquations(context, solution.beams, lineLabel));

  layout.heading('5.4 Contraste en la base: método aproximado frente al modelo lateral exacto', 2);
  layout.text(
    'Se aísla un modelo con únicamente la carga lateral de este proyecto y se resuelve con el '
    + 'análisis matricial: es la comparación honesta, porque el Método del Portal tampoco '
    + 'pretende explicar la carga vertical. Las columnas «matricial» son ese resultado exacto; '
    + 'las «Portal», el de esta sección.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Columna', width: 54 },
      { header: `Rx Portal (${forceUnit})`, ...NUMERIC },
      { header: `Rx matricial (${forceUnit})`, ...NUMERIC },
      { header: `Ry Portal (${forceUnit})`, ...NUMERIC },
      { header: `Ry matricial (${forceUnit})`, ...NUMERIC },
      { header: `M Portal (${momentUnit})`, ...NUMERIC },
      { header: `M matricial (${momentUnit})`, ...NUMERIC },
    ],
    solution.baseChecks.map((check) => [
      lineLabel(check.columnIndex),
      displayCell(project, check.approxRx, 'force'),
      displayCell(project, check.solverRx, 'force'),
      displayCell(project, check.approxRy, 'force'),
      displayCell(project, check.solverRy, 'force'),
      displayCell(project, check.approxRm, 'moment'),
      displayCell(project, check.solverRm, 'moment'),
    ]),
    { size: 7.4 },
  );
  layout.text(
    `Mayor diferencia: ${clearNumber(solution.reactionGap.force, 1)} ${forceUnit} en fuerza, `
    + `${clearNumber(solution.reactionGap.moment, 1)} ${momentUnit} en momento — el precio de la aproximación, a la vista.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

const drawCantileverMethod = (context: ReportContext, solution: CantileverMethodResult): void => {
  const { layout, project, index } = context;
  const { fonts, palette } = layout;
  const lengthUnit = unitFor(project, 'length');
  const forceUnit = unitFor(project, 'force');
  const momentUnit = unitFor(project, 'moment');
  const lineLabel = (index: number) => String.fromCharCode(65 + index);

  layout.heading('5. Procedimiento: Método del Voladizo');
  layout.text(
    'Método aproximado para carga lateral sobre un pórtico rectangular. Comparte con el Método '
    + 'del Portal el punto de inflexión a media altura de cada columna y a media luz de cada viga '
    + '(salvo en el primer piso, donde un apoyo que no restringe el giro fuerza el punto de '
    + 'inflexión en el propio apoyo), pero sustituye su segunda hipótesis: en vez de repartir el '
    + 'cortante de planta por ancho tributario, trata la fila de columnas de cada planta como la '
    + 'sección de un voladizo vertical que resiste el momento de vuelco — la axial de cada columna '
    + 'es proporcional a su área y a su distancia al centroide de áreas de esa planta, la fórmula '
    + 'de flexión aplicada a columnas discretas en vez de a una sección continua. Conocida esa '
    + 'axial, el equilibrio vertical de cada nudo da el momento de cada viga, y el equilibrio de '
    + 'momento en cada nudo —recorrido desde la cubierta hacia abajo— da el cortante de cada '
    + 'columna.',
    8.7, fonts.regular, undefined, 8,
  );
  layout.text(
    'Como el Método del Portal, no tiene por qué coincidir con el análisis matricial: es una '
    + 'simplificación deliberada, y esta sección contrasta sus reacciones en la base contra el '
    + 'modelo lateral exacto en vez de exigir que coincidan.',
    8.3, fonts.regular, palette.ink, 8,
  );

  layout.heading('5.1 Columnas: axial por flexión, cortante y momento', 2);
  layout.text(
    'La axial es la incógnita que este método resuelve primero, no la última: positiva es '
    + 'tracción, y las columnas más alejadas del centroide de áreas son las que más trabajan.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Columna', width: 56 },
      { header: 'Planta', width: 44 },
      { header: `Dist. al centroide (${lengthUnit})`, ...NUMERIC },
      { header: `Axial (${forceUnit})`, ...NUMERIC },
      { header: `Cortante (${forceUnit})`, ...NUMERIC },
      { header: `M inferior (${momentUnit})`, ...NUMERIC },
      { header: `M superior (${momentUnit})`, ...NUMERIC },
    ],
    solution.columns.map((column) => [
      lineLabel(column.columnIndex),
      String(column.story),
      number(column.centroidDistance, 4),
      displayCell(project, column.axial, 'force'),
      displayCell(project, column.shear, 'force'),
      displayCell(project, column.bottomMoment, 'moment'),
      displayCell(project, column.topMoment, 'moment'),
    ]),
    { size: 7.4 },
  );
  // The hypothesis of the method is that the axial force of a column is proportional to its
  // own area times its distance to the storey's centroid. Instead of restating that as a
  // formula, each column's quotient is divided out: if the hypothesis holds — and it does,
  // because it is how the solution was built — every column of a storey lands on the same
  // number, and the reader can see it land.
  for (const story of [...new Set(solution.columns.map((column) => column.story))]) {
    const columns = solution.columns.filter((column) => column.story === story);
    const quotients = columns.flatMap((column) => {
      const member = index.member(column.memberId);
      const denominator = member ? member.A * column.centroidDistance : 0;
      if (!member || Math.abs(denominator) < 1e-12) return [];
      return [{ column, area: member.A, quotient: column.axial / denominator }];
    });
    if (quotients.length < 2) continue;
    drawWorked(
      context,
      `Planta ${story}: la axial dividida por el área y la distancia al centroide da el mismo número en cada columna — la hipótesis del método, comprobada sobre este pórtico.`,
      quotients.map(({ column, area, quotient }) => (
        `N(${lineLabel(column.columnIndex)})/(A · d) = ${displayCell(project, column.axial, 'force')}`
        + `/((${number(dimensionalValue(project, area, 0, 2), 6)})(${number(column.centroidDistance, 6)}))`
        + ` = ${number(dimensionalValue(project, quotient, 1, -3), 6)} ${dimensionalUnit(project, 1, -3)}`
      )),
    );
  }
  // And the two end moments of every column, as the shear times the distance to its own
  // inflection point.
  drawWorked(
    context,
    `Momento de extremo de cada columna, desde su cortante y su punto de inflexión (${momentUnit}).`,
    solution.columns.flatMap((column) => {
      const lever = column.height * column.inflectionFraction;
      if (Math.abs(column.bottomMoment) <= 1e-9) return [];
      if (!agrees(Math.abs(column.bottomMoment), Math.abs(column.shear * lever), Math.abs(column.bottomMoment))) return [];
      return [
        `M_inf(${lineLabel(column.columnIndex)}, planta ${column.story}) = ${displayCell(project, Math.abs(column.shear), 'force')}`
        + ` · ${number(column.height, 6)} · ${number(column.inflectionFraction, 6)}`
        + ` = ${displayCell(project, Math.abs(column.bottomMoment), 'moment')} ${momentUnit}`,
      ];
    }),
  );

  layout.heading('5.2 Vigas: momento y cortante', 2);
  layout.table(
    [
      { header: 'Vano', width: 70 },
      { header: 'Planta', width: 44 },
      { header: `Luz (${lengthUnit})`, ...NUMERIC },
      { header: `Momento (${momentUnit})`, ...NUMERIC },
      { header: `Cortante (${forceUnit})`, ...NUMERIC },
    ],
    solution.beams.map((beam) => [
      `${lineLabel(beam.bayIndex)}–${lineLabel(beam.bayIndex + 1)}`,
      String(beam.story),
      number(beam.span, 4),
      displayCell(project, beam.moment, 'moment'),
      displayCell(project, beam.shear, 'force'),
    ]),
    { size: 7.4 },
  );
  drawWorked(context, `Cortante de cada viga, desde los dos momentos de sus extremos (${momentUnit} y ${forceUnit}).`, beamShearEquations(context, solution.beams, lineLabel));

  layout.heading('5.3 Contraste en la base: método aproximado frente al modelo lateral exacto', 2);
  layout.text(
    'Se aísla un modelo con únicamente la carga lateral de este proyecto y se resuelve con el '
    + 'análisis matricial: es la comparación honesta, porque el Método del Voladizo tampoco '
    + 'pretende explicar la carga vertical. Las columnas «matricial» son ese resultado exacto; '
    + 'las «Voladizo», el de esta sección.',
    8.3, fonts.regular, undefined, 8,
  );
  layout.table(
    [
      { header: 'Columna', width: 54 },
      { header: `Rx Voladizo (${forceUnit})`, ...NUMERIC },
      { header: `Rx matricial (${forceUnit})`, ...NUMERIC },
      { header: `Ry Voladizo (${forceUnit})`, ...NUMERIC },
      { header: `Ry matricial (${forceUnit})`, ...NUMERIC },
      { header: `M Voladizo (${momentUnit})`, ...NUMERIC },
      { header: `M matricial (${momentUnit})`, ...NUMERIC },
    ],
    solution.baseChecks.map((check) => [
      lineLabel(check.columnIndex),
      displayCell(project, check.approxRx, 'force'),
      displayCell(project, check.solverRx, 'force'),
      displayCell(project, check.approxRy, 'force'),
      displayCell(project, check.solverRy, 'force'),
      displayCell(project, check.approxRm, 'moment'),
      displayCell(project, check.solverRm, 'moment'),
    ]),
    { size: 7.4 },
  );
  layout.text(
    `Mayor diferencia: ${clearNumber(solution.reactionGap.force, 1)} ${forceUnit} en fuerza, `
    + `${clearNumber(solution.reactionGap.moment, 1)} ${momentUnit} en momento — el precio de la aproximación, a la vista.`,
    8.7, fonts.bold, palette.ink, 8,
  );
};

/**
 * Draws the selected method's section, or reports that it could not.
 *
 * Returns `false` when no method-specific section was written, so the caller can fall back to
 * the generic procedure rather than leaving the document with a hole where section 5 was.
 */
export const drawMethodSection = (context: ReportContext): boolean => {
  const { project, analysis } = context;
  if (project.settings.solutionMethod === 'double-integration') {
    const solution = solveDoubleIntegration(project, analysis, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawDoubleIntegration(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'conjugate-beam') {
    const solution = solveConjugateBeam(project, analysis, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawConjugateBeam(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'portal-method') {
    const solution = solvePortalMethod(project, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawPortalMethod(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'cantilever-method') {
    const solution = solveCantileverMethod(project, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawCantileverMethod(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'three-moment') {
    const solution = solveThreeMoment(project, analysis, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawThreeMoment(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'hardy-cross') {
    const solution = solveHardyCross(project, analysis, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawHardyCross(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'kani-frame') {
    const solution = solveKaniFrame(project, analysis, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawKaniFrame(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'virtual-work') {
    const solution = solveVirtualWork(project, analysis, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawVirtualWork(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'method-of-sections') {
    const solution = solveMethodOfSections(project, analysis, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawMethodOfSections(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'method-of-joints') {
    const solution = solveMethodOfJoints(project, analysis, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawMethodOfJoints(context, solution);
    return true;
  }
  if (project.settings.solutionMethod === 'castigliano-truss') {
    const solution = solveCastiglianoTruss(project, analysis, null);
    if (!solution.applicable) {
      context.layout.text(pdfText(REJECTION_MESSAGE), 8.3, context.layout.fonts.regular, undefined, 8);
      return false;
    }
    drawCastiglianoTruss(context, solution);
    return true;
  }
  return false;
};
