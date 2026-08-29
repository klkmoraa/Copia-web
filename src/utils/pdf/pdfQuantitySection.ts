/**
 * One part per response quantity: the diagram over the whole structure, the slope it was
 * measured to have, and the exact segment function of *every* member.
 *
 * The page this replaces was a fixed 346-point artwork panel over a 270-point panel of
 * "operaciones", into which exactly two members fit — a limit the page then reported as if it
 * were an editorial choice ("se muestran los primeros 2"). The functions now flow into a
 * table that pages by itself, so a forty-member model prints forty members.
 *
 * The colours are no longer invented here either: axial is the product's teal, shear its
 * green, moment its orange (`pdfTheme.ts`), so a curve keeps its identity between the canvas
 * and the signed document.
 */
import type { DiagramQuantity } from '../../types';
import {
  clearCell,
  display,
  formatPolynomial,
  quantitySymbol,
  quantityTitle,
  quantityUnit,
  unitFor,
} from './pdfFormat';
import { drawFigureFrame, drawFigureTag } from './pdfChrome';
import { drawGlobalQuantityDiagram } from './pdfDiagrams';
import { quantityConstructionSteps, quantitySlopeEquation } from './pdfSubstitution';
import { TYPE } from './pdfTheme';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

const STANDFIRST: Record<DiagramQuantity, string> = {
  axial: 'Fuerza normal a lo largo de la estructura, con la función exacta de cada tramo.',
  shear: 'Fuerza cortante a lo largo de la estructura, con la función exacta de cada tramo.',
  moment: 'Momento flector a lo largo de la estructura, con la función exacta de cada tramo.',
};

export const drawQuantityPart = (context: ReportContext, quantity: DiagramQuantity): void => {
  const { layout, project, analysis } = context;
  const { palette } = layout;
  const color = palette.quantity[quantity];
  const symbol = quantitySymbol(quantity);
  const unit = quantityUnit(quantity);

  layout.part(quantityTitle(quantity), STANDFIRST[quantity]);

  layout.figure(
    272,
    (rect) => {
      drawFigureFrame(layout, rect);
      drawFigureTag(layout, rect.x + 10, rect.y + rect.height - 14, `diagrama ${symbol}`, color);
      drawGlobalQuantityDiagram(context, quantity, rect.x + 6, rect.y + 6, rect.width - 12, rect.height - 26);
    },
    `Diagrama ${symbol} dibujado normal a cada miembro; ${symbol} positivo según los ejes locales.`,
  );

  const governing = analysis.memberResults.find((result) => result.diagramSegments.length);
  const slope = governing ? quantitySlopeEquation(context, quantity, governing) : undefined;
  if (governing && slope) {
    layout.heading('Cómo se construye este diagrama');
    const first = governing.diagramSegments[0];
    layout.text(
      `Sobre el miembro ${governing.memberId}, en su primer tramo — de `
      + `${display(project, first.x0, 'length')} a ${display(project, first.x1, 'length')} — el diagrama `
      + 'parte de un valor, avanza con una pendiente medida y cierra en otro. Los tres son números de '
      + 'este análisis, no la relación diferencial que los gobierna en cualquier viga.',
    );
    layout.ensure(layout.measureMathBlock(slope, TYPE.section, 12));
    layout.drawMathBlockAt(slope, TYPE.section, 12, color, `(${layout.nextEquationNumber()})`);
    layout.gap();
    layout.bullets(quantityConstructionSteps(context, quantity, governing));
  }

  layout.heading('Extremos por miembro');
  const extremaScale = Math.max(
    1e-12,
    ...analysis.memberResults.flatMap((result) => [
      Math.abs(quantity === 'axial' ? result.minAxial : quantity === 'shear' ? result.minShear : result.minMoment),
      Math.abs(quantity === 'axial' ? result.maxAxial : quantity === 'shear' ? result.maxShear : result.maxMoment),
    ]),
  );
  layout.table(
    [
      { header: 'Miembro', width: 96 },
      { header: `${symbol} mínimo (${unitFor(project, unit)})`, ...NUMERIC },
      { header: `${symbol} máximo (${unitFor(project, unit)})`, ...NUMERIC },
      { header: 'Tramos', width: 62, ...NUMERIC },
    ],
    analysis.memberResults.map((result) => {
      const minimum = quantity === 'axial' ? result.minAxial : quantity === 'shear' ? result.minShear : result.minMoment;
      const maximum = quantity === 'axial' ? result.maxAxial : quantity === 'shear' ? result.maxShear : result.maxMoment;
      return [
        result.memberId,
        clearCell(project, minimum, unit, extremaScale),
        clearCell(project, maximum, unit, extremaScale),
        String(result.diagramSegments.length),
      ];
    }),
  );

  layout.heading(`Función ${symbol}(s) de cada tramo`);
  layout.text(
    'La variable s se mide desde el inicio del tramo. Los coeficientes son los del análisis: '
    + 'polinomios exactos, no una interpolación de puntos muestreados.',
  );
  const rows = analysis.memberResults.flatMap((result) => result.diagramSegments.map((segment, index) => [
    index === 0 ? result.memberId : '',
    String(index + 1),
    `${display(project, segment.x0, 'length')} → ${display(project, segment.x1, 'length')}`,
    `${symbol}(s) = ${formatPolynomial(project, quantity, segment[quantity])}`,
  ]));
  if (!rows.length) {
    layout.note('El análisis no produjo tramos para esta magnitud.');
    return;
  }
  layout.table(
    [
      { header: 'Miembro', width: 76 },
      { header: 'Tramo', width: 42, ...NUMERIC },
      { header: 'Estación', width: 128 },
      { header: 'Función exacta', flex: 3, math: true },
    ],
    rows,
  );
};
