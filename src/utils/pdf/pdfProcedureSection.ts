/**
 * Procedure page: the sequence from model to verification, one panel per stage, each with the
 * engine's own summary and — where this project has one — the stage's relation already carried
 * out with its real numbers, rather than the generic identity the engine publishes.
 */
import type { AnalysisResult } from '../../types';
import { pdfText, wrapText } from './pdfGlyphs';
import { clearNumber } from './pdfFormat';
import { drawPanel, drawSectionBand, drawVisualHeader } from './pdfChrome';
import { drawMathBlock } from './pdfMath';
import { leadSubstitution } from './pdfSubstitution';
import type { ReportContext } from './reportContext';

export const drawProcedureSummary = (context: ReportContext, band = '06'): void => {
  const { layout, project, analysis, payload } = context;
  const { rgb, fonts, palette, margin } = layout;
  const maxWidth = layout.contentWidth;
  layout.newPage();
  layout.page.drawRectangle({ x: 0, y: 0, width: layout.width, height: layout.height, color: rgb(0.965, 0.975, 0.968) });
  drawVisualHeader(layout, project.name, 'Procedimiento claro y verificable');
  drawSectionBand(layout, band, 'Procedimiento y cálculos', 'Secuencia resumida desde el modelo hasta la comprobación');
  const representative = (categories: Array<AnalysisResult['explanation'][number]['category']>) =>
    analysis.explanation.find((step) => categories.includes(step.category));
  const stages = [
    { title: 'Modelo y convenciones', fallback: `${project.nodes.length} nodos y ${project.members.length} miembros; ejes globales y locales definidos.`, step: representative(['geometry']) },
    { title: 'Cargas y resultantes', fallback: `${payload.metadata.loadCount} acciones activas transformadas a vectores nodales consistentes.`, step: representative(['loads']) },
    { title: 'Ensamblaje y restricciones', fallback: 'Se ensambla K global y se aplican apoyos, liberaciones y desplazamientos prescritos.', step: representative(['stiffness']) },
    { title: 'Recuperacion N-V-M', fallback: 'Las fuerzas de extremo y las cargas de miembro producen funciones exactas por tramo.', step: representative(['results']) },
    { title: 'Equilibrio y verificación', fallback: `Residuo normalizado ${clearNumber(analysis.equilibrium.normalizedResidual)}; condición estimada ${clearNumber(analysis.conditionEstimate)}.`, step: representative(['equilibrium', 'verification']) },
  ];
  let stageY = 676;
  stages.forEach((stage, stageIndex) => {
    drawPanel(layout, margin, stageY - 100, maxWidth, 91, stageIndex === stages.length - 1 ? rgb(0.93, 0.97, 0.94) : rgb(1, 1, 1));
    layout.page.drawCircle({ x: margin + 22, y: stageY - 31, size: 11, color: stageIndex === stages.length - 1 ? rgb(0.08, 0.47, 0.29) : palette.forest });
    layout.page.drawText(String(stageIndex + 1), { x: margin + 18.8, y: stageY - 34.5, size: 8, font: fonts.bold, color: rgb(1, 1, 1) });
    layout.page.drawText(pdfText(stage.title.toUpperCase()), { x: margin + 44, y: stageY - 27, size: 8, font: fonts.bold, color: palette.forestDeep });
    const summaryLines = wrapText(stage.step?.summary ?? stage.fallback, fonts.regular, 7.2, maxWidth - 68).slice(0, 2);
    summaryLines.forEach((entry, lineIndex) => layout.page.drawText(entry, { x: margin + 44, y: stageY - 43 - lineIndex * 11, size: 7.2, font: fonts.regular, color: rgb(0.23, 0.29, 0.25) }));
    // The engine's own `equations[0]` is the generic statement of the stage — `L = √(ΔX²+ΔY²)`,
    // `dM/dx = V(x)`. What goes in the box is that same relation already carried out with this
    // project's numbers; a stage with nothing to substitute simply shows no box.
    const equation = stage.step ? leadSubstitution(context, stage.step.id) : undefined;
    if (equation) {
      const formulaColor = stageIndex === stages.length - 1 ? rgb(0.08, 0.47, 0.29) : rgb(0.32, 0.38, 0.34);
      layout.page.drawRectangle({ x: margin + 44, y: stageY - 91, width: maxWidth - 62, height: 24, color: rgb(0.965, 0.98, 0.97), borderColor: rgb(0.82, 0.87, 0.84), borderWidth: 0.5 });
      layout.page.drawText('CÁLCULO REAL', { x: margin + 52, y: stageY - 76, size: 5.2, font: fonts.bold, color: formulaColor });
      // Folding beats clipping: this used to cut at 92 characters and append an ellipsis,
      // which lands mid-symbol as often as not.
      drawMathBlock(layout, equation, margin + 126, stageY - 71, maxWidth - 152, 8.6, formulaColor);
    }
    stageY -= 113;
  });
  layout.page.drawRectangle({ x: margin, y: 73, width: maxWidth, height: 40, color: rgb(0.91, 0.96, 0.93), borderColor: rgb(0.08, 0.47, 0.29), borderWidth: 0.8 });
  layout.page.drawText(analysis.success ? 'RESULTADO: ANÁLISIS RESUELTO Y TRAZABLE' : 'RESULTADO: EL MODELO REQUIERE CORRECCIONES', { x: margin + 14, y: 94, size: 8.5, font: fonts.bold, color: analysis.success ? rgb(0.08, 0.47, 0.29) : rgb(0.75, 0.20, 0.16) });
  layout.page.drawText('Las páginas siguientes conservan datos, auditoría, ecuaciones completas y matrices como anexo técnico.', { x: margin + 14, y: 81, size: 6.6, font: fonts.regular, color: rgb(0.30, 0.37, 0.32) });
};
