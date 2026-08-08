/**
 * One full page per quantity: the N, V or M diagram over the structure, the differential
 * relation that governs it, and the exact segment functions of the first members.
 */
import type { DiagramQuantity } from '../../types';
import { pdfText, wrapText } from './pdfGlyphs';
import {
  clearDisplay,
  display,
  formatPolynomial,
  quantitySymbol,
  quantityTitle,
  quantityUnit,
} from './pdfFormat';
import { drawPanel, drawSectionBand, drawVisualHeader } from './pdfChrome';
import { drawGlobalQuantityDiagram } from './pdfDiagrams';
import { drawFormulaCard, drawMathFormula } from './pdfMath';
import type { ReportContext } from './reportContext';

export const drawQuantityPage = (context: ReportContext, quantity: DiagramQuantity, index: string): void => {
  const { layout, project, analysis } = context;
  const { rgb, fonts, palette, margin } = layout;
  const maxWidth = layout.contentWidth;
  const color = palette.quantity[quantity];
  layout.newPage();
  layout.page.drawRectangle({ x: 0, y: 0, width: layout.width, height: layout.height, color: rgb(0.965, 0.975, 0.968) });
  drawVisualHeader(layout, project.name, quantityTitle(quantity));
  drawSectionBand(layout, index, quantityTitle(quantity), 'Diagrama global, valores gobernantes y ecuaciones exactas por tramo');
  drawPanel(layout, margin, 352, maxWidth, 346);
  layout.page.drawRectangle({ x: margin + 12, y: 670, width: 78, height: 20, color });
  layout.page.drawText(pdfText(`DIAGRAMA ${quantitySymbol(quantity)}`), { x: margin + 23, y: 677, size: 7, font: fonts.bold, color: rgb(1, 1, 1) });
  drawGlobalQuantityDiagram(context, quantity, margin + 8, 365, maxWidth - 16, 300);
  drawPanel(layout, margin, 60, maxWidth, 270);
  layout.page.drawText('OPERACIONES CLARAS', { x: margin + 14, y: 307, size: 9, font: fonts.bold, color: palette.forestDeep });
  const relation = quantity === 'axial' ? 'dN/dx = -p(x)' : quantity === 'shear' ? 'dV/dx = q(x)' : 'dM/dx = V(x)';
  const relationExplanation = quantity === 'axial'
    ? 'La carga axial distribuida determina como cambia la fuerza normal N.'
    : quantity === 'shear'
      ? 'La carga transversal q determina la pendiente del diagrama de cortante V.'
      : 'El cortante V determina la pendiente del diagrama de momento M.';
  drawFormulaCard(layout, 'Relacion fundamental', relation, relationExplanation, margin + 14, 248, maxWidth - 28, color);
  let operationBottom = 174;
  const visibleResults = analysis.memberResults.filter((result) => result.diagramSegments.length).slice(0, 2);
  visibleResults.forEach((result, resultIndex) => {
    const segment = result.diagramSegments[0];
    const coefficients = segment[quantity];
    const formula = `${quantitySymbol(quantity)}(s) = ${formatPolynomial(project, quantity, coefficients)}`;
    const minValue = quantity === 'axial' ? result.minAxial : quantity === 'shear' ? result.minShear : result.minMoment;
    const maxValue = quantity === 'axial' ? result.maxAxial : quantity === 'shear' ? result.maxShear : result.maxMoment;
    const unit = quantityUnit(quantity);
    layout.page.drawRectangle({ x: margin + 14, y: operationBottom, width: maxWidth - 28, height: 63, color: rgb(1, 1, 1), borderColor: rgb(0.82, 0.87, 0.84), borderWidth: 0.6 });
    layout.page.drawCircle({ x: margin + 29, y: operationBottom + 45, size: 8, color: palette.forest });
    layout.page.drawText(String(resultIndex + 1), { x: margin + 26.5, y: operationBottom + 42.5, size: 6.5, font: fonts.bold, color: rgb(1, 1, 1) });
    layout.page.drawText(pdfText(`MIEMBRO ${result.memberId} | FUNCION DEL TRAMO`), { x: margin + 45, y: operationBottom + 46, size: 6.3, font: fonts.bold, color: palette.forestDeep });
    drawMathFormula(layout, formula, margin + 45, operationBottom + 27, 10.6, rgb(0.10, 0.15, 0.12), 300);
    layout.page.drawText(pdfText(`s = distancia local; valida de ${display(project, segment.x0, 'length')} a ${display(project, segment.x1, 'length')}.`), { x: margin + 45, y: operationBottom + 10, size: 6.2, font: fonts.regular, color: rgb(0.40, 0.46, 0.42) });
    const extremaReference = Math.max(1e-12, Math.abs(minValue), Math.abs(maxValue));
    layout.page.drawRectangle({ x: margin + 370, y: operationBottom + 12, width: 111, height: 39, color: rgb(0.95, 0.98, 0.96), borderColor: color, borderWidth: 0.7 });
    layout.page.drawText('RESULTADOS', { x: margin + 378, y: operationBottom + 40, size: 5.2, font: fonts.bold, color });
    layout.page.drawText(pdfText(`min: ${clearDisplay(project, minValue, unit, extremaReference)}`), { x: margin + 378, y: operationBottom + 27, size: 6.3, font: fonts.bold, color });
    layout.page.drawText(pdfText(`max: ${clearDisplay(project, maxValue, unit, extremaReference)}`), { x: margin + 378, y: operationBottom + 16, size: 6.3, font: fonts.bold, color });
    operationBottom -= 70;
  });
  if (visibleResults.length === 1) {
    layout.page.drawText('COMO SE CONSTRUYE', { x: margin + 14, y: 157, size: 7, font: fonts.bold, color: palette.forestDeep });
    const steps = quantity === 'axial'
      ? ['Partir de las fuerzas de extremo.', 'Aplicar dN/dx = -p(x).', 'Evaluar extremos, saltos y ceros.']
      : quantity === 'shear'
        ? ['Partir del cortante inicial.', 'Integrar la carga q(x).', 'Localizar cambios de signo y saltos.']
        : ['Partir del momento inicial.', 'Integrar V(x) por cada tramo.', 'Resolver V=0 para hallar extremos.'];
    const stepWidth = (maxWidth - 48) / 3;
    steps.forEach((step, stepIndex) => {
      const stepX = margin + 14 + stepIndex * (stepWidth + 10);
      layout.page.drawRectangle({ x: stepX, y: 78, width: stepWidth, height: 65, color: rgb(0.96, 0.98, 0.97), borderColor: rgb(0.82, 0.87, 0.84), borderWidth: 0.6 });
      layout.page.drawCircle({ x: stepX + 15, y: 124, size: 8, color });
      layout.page.drawText(String(stepIndex + 1), { x: stepX + 12.5, y: 121.5, size: 6.5, font: fonts.bold, color: rgb(1, 1, 1) });
      const lines = wrapText(step, fonts.regular, 6.8, stepWidth - 20).slice(0, 3);
      lines.forEach((entry, lineIndex) => layout.page.drawText(entry, { x: stepX + 10, y: 105 - lineIndex * 10, size: 6.8, font: fonts.regular, color: rgb(0.26, 0.33, 0.28) }));
    });
  }
  if (analysis.memberResults.length > visibleResults.length) {
    layout.page.drawText(pdfText(`Se muestran los primeros ${visibleResults.length}; el anexo conserva las ecuaciones y extremos de los ${analysis.memberResults.length} miembros.`), { x: margin + 14, y: 77, size: 6.4, font: fonts.bold, color: rgb(0.36, 0.43, 0.38) });
  }
};
