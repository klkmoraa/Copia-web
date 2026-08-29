/**
 * Executive page: the whole analysis in one reading — governing figures, free-body diagram,
 * the equilibrium operations and the reactions that close them.
 *
 * `layout.page` is read at every draw because the free-body diagram in the middle of the page
 * is allowed to break the page if it ever stops fitting.
 */
import type { DiagramQuantity } from '../../types';
import { resolveNumericQualityState } from '../../engine/reliability';
import { pdfText, wrapText } from './pdfGlyphs';
import { clearDisplay, clearNumber } from './pdfFormat';
import { drawKpi, drawPanel, drawSectionBand, drawVisualHeader } from './pdfChrome';
import { drawGlobalDcl } from './pdfDiagrams';
import { drawMathBlock } from './pdfMath';
import { equilibriumSums } from './pdfSubstitution';
import type { ReportContext } from './reportContext';

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

export const drawExecutivePage = (context: ReportContext): void => {
  const { layout, project, analysis, options } = context;
  const { rgb, fonts, palette, margin } = layout;
  const numericQuality = resolveNumericQualityState(analysis);
  const qualityLabel = {
    stable: 'ESTABLE',
    limited: 'LIMITADA',
    unreliable: 'NO CONFIABLE',
    failed: 'FALLIDA',
    unavailable: 'NO DISPONIBLE',
  }[numericQuality];
  const qualityColor = numericQuality === 'stable'
    ? rgb(0.08, 0.43, 0.27)
    : numericQuality === 'limited' ? rgb(0.72, 0.43, 0.05) : rgb(0.75, 0.20, 0.16);
  layout.page.drawRectangle({ x: 0, y: 0, width: layout.width, height: layout.height, color: rgb(0.965, 0.975, 0.968) });
  drawVisualHeader(layout, project.name, options.scenarioName ?? 'Análisis activo');
  drawSectionBand(layout, '01', 'DCL global y equilibrio', 'Cargas, reacciones y resultados gobernantes en una sola lectura');
  const axialExtreme = absoluteExtreme(context, 'axial');
  const shearExtreme = absoluteExtreme(context, 'shear');
  const momentExtreme = absoluteExtreme(context, 'moment');
  const reactionMaximum = analysis.nodeResults.reduce((best, result) => {
    const values = [result.rx, result.ry];
    return Math.max(best, ...values.map((value) => Math.abs(value)));
  }, 0);
  drawKpi(layout, margin, 'Reacción max.', clearDisplay(project, reactionMaximum, 'force', reactionMaximum), rgb(0.04, 0.40, 0.72));
  drawKpi(layout, margin + 126, '|N| max.', axialExtreme ? clearDisplay(project, Math.abs(axialExtreme.value), 'force', Math.abs(axialExtreme.value)) : 'n/d', palette.quantity.axial);
  drawKpi(layout, margin + 252, '|V| max.', shearExtreme ? clearDisplay(project, Math.abs(shearExtreme.value), 'force', Math.abs(shearExtreme.value)) : 'n/d', palette.quantity.shear);
  drawKpi(layout, margin + 378, '|M| max.', momentExtreme ? clearDisplay(project, Math.abs(momentExtreme.value), 'moment', Math.abs(momentExtreme.value)) : 'n/d', palette.quantity.moment);
  layout.y = 628;
  drawGlobalDcl(context, 262, true);
  drawPanel(layout, margin, 60, 242, 278);
  layout.page.drawText('OPERACIONES DE EQUILIBRIO', { x: margin + 12, y: 318, size: 8.5, font: fonts.bold, color: palette.forestDeep });
  // Each row used to read `ΣF_x = 0` — the condition, not the check. What goes here now is
  // the sum that was actually performed: every applied resultant and every reaction, written
  // out and added up, with the closing value beside it (`equilibriumSums` in
  // `pdfSubstitution.ts`, which refuses to expand a sum it cannot reproduce from the engine's
  // own figure). The value stays real PDF text so the page remains searchable; the expansion
  // is typeset as maths.
  const sums = equilibriumSums(context, 7);
  const equilibriumRows = [
    ...sums.map((sum, index) => ({
      title: ['Fuerzas horizontales', 'Fuerzas verticales', 'Momentos respecto al origen'][index],
      formula: sum.equation,
      result: sum.result,
    })),
    {
      title: 'Control numérico del cierre',
      formula: `r = ${clearNumber(analysis.equilibrium.normalizedResidual)}`,
      result: clearNumber(analysis.equilibrium.normalizedResidual),
    },
  ];
  let rowY = 283;
  equilibriumRows.forEach((entry, index) => {
    layout.page.drawCircle({ x: margin + 18, y: rowY + 3, size: 8, color: index === equilibriumRows.length - 1 ? rgb(0.12, 0.50, 0.34) : palette.forest });
    layout.page.drawText(String(index + 1), { x: margin + 15.5, y: rowY, size: 6.5, font: fonts.bold, color: rgb(1, 1, 1) });
    layout.page.drawText(pdfText(entry.title.toUpperCase()), { x: margin + 34, y: rowY + 11, size: 5.8, font: fonts.bold, color: rgb(0.34, 0.41, 0.36) });
    layout.page.drawText(pdfText(entry.result), { x: margin + 150, y: rowY + 11, size: 6.4, font: fonts.bold, color: rgb(0.10, 0.35, 0.22) });
    drawMathBlock(layout, entry.formula, margin + 34, rowY + 1, 196, 7.4, rgb(0.10, 0.15, 0.12));
    rowY -= 44;
  });
  layout.page.drawRectangle({ x: margin + 12, y: 80, width: 218, height: 52, color: rgb(0.91, 0.96, 0.93), borderColor: qualityColor, borderWidth: 0.8 });
  layout.page.drawText(pdfText(`CALIDAD NUMÉRICA: ${qualityLabel}`), { x: margin + 24, y: 111, size: 8.7, font: fonts.bold, color: qualityColor });
  layout.page.drawText(pdfText(`Condición k1 ${clearNumber(analysis.conditionEstimate)} | residuo ${clearNumber(analysis.linearResidual ?? analysis.residualNorm)} | error ${clearNumber(analysis.forwardErrorBound ?? Number.NaN)}`), { x: margin + 24, y: 97, size: 5.8, font: fonts.regular, color: rgb(0.20, 0.28, 0.23) });
  layout.page.drawText(pdfText('Diagnóstico numérico; no evalúa seguridad estructural.'), { x: margin + 24, y: 85, size: 5.8, font: fonts.bold, color: rgb(0.28, 0.35, 0.30) });

  drawPanel(layout, margin + 254, 60, 241, 278);
  layout.page.drawText('REACCIONES Y DATOS CLAVE', { x: margin + 266, y: 318, size: 8.5, font: fonts.bold, color: palette.forestDeep });
  rowY = 289;
  for (const result of analysis.nodeResults.filter((item) => Math.abs(item.rx) + Math.abs(item.ry) + Math.abs(item.rm) > 1e-10).slice(0, 5)) {
    layout.page.drawText(pdfText(`Nodo ${result.nodeId}`), { x: margin + 266, y: rowY, size: 7.5, font: fonts.bold, color: palette.forestDeep });
    layout.page.drawText(pdfText(`Rx ${clearDisplay(project, result.rx, 'force', reactionMaximum)}  |  Ry ${clearDisplay(project, result.ry, 'force', reactionMaximum)}`), { x: margin + 266, y: rowY - 14, size: 7, font: fonts.regular, color: rgb(0.20, 0.25, 0.22) });
    if (Math.abs(result.rm) > 1e-10) layout.page.drawText(pdfText(`M ${clearDisplay(project, result.rm, 'moment', momentExtreme ? Math.abs(momentExtreme.value) : 1)}`), { x: margin + 266, y: rowY - 26, size: 7, font: fonts.regular, color: rgb(0.20, 0.25, 0.22) });
    rowY -= 49;
  }
  layout.page.drawText('HIPÓTESIS', { x: margin + 266, y: 124, size: 7, font: fonts.bold, color: palette.forestDeep });
  const formulation = analysis.educationTrace?.formulation ?? 'análisis estático lineal 2D';
  const experimentalScope = analysis.pDelta?.experimental ? 'P-Delta experimental; ' : '';
  const hypothesis = wrapText(`${experimentalScope}${formulation}; pequeñas deformaciones; propiedades prismáticas por miembro.`, fonts.regular, 6.8, 213);
  hypothesis.slice(0, 3).forEach((entry, index) => layout.page.drawText(entry, { x: margin + 266, y: 109 - index * 11, size: 6.8, font: fonts.regular, color: rgb(0.30, 0.36, 0.32) }));
};
