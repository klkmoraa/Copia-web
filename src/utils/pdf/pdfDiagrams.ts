/**
 * Vector artwork of the report: the global free-body diagram, the per-member N/V/M strips,
 * the full-page N, V or M diagram drawn over the structure, and the elastic curve.
 *
 * All three project the model onto the page with the same transform — bounding box, uniform
 * scale, centred offsets. That transform, the arrow, the node dot and the support glyph now
 * live in `pdfScene.ts`, because the free-body scenes of the method sections draw the same
 * structure with the same marks and must not reinvent any of them.
 */
import type { AnalysisResult, DiagramQuantity } from '../../types';
import { toDisplay, unitLabel } from '../../engine/units';
import { readCanvasViewSettings } from '../../features/view/canvasViewSettings';
import { lerpPoint, memberAxis } from '../../graphics/structureGeometry';
import {
  createProjection,
  drawArrow,
  drawMemberLoads,
  drawNodeDot,
  drawSupportGlyph,
  type Point,
} from './pdfScene';
import { pdfText } from './pdfGlyphs';
import {
  clearDisplay,
  clearNumber,
  display,
  quantitySymbol,
  quantityUnit,
} from './pdfFormat';
import type { PdfLayout } from './pdfBuilder';
import type { ReportContext } from './reportContext';
import type { Tone } from './reportDocument';

/** Framed free-body diagram: geometry, supports, applied actions and optional reactions. */
export const drawGlobalDcl = (
  context: ReportContext,
  rect: { x: number; y: number; width: number; height: number },
  includeReactions = false,
): void => {
  const { layout, project, analysis, scenarioFactors, index } = context;
  const { fonts, palette } = layout;
  if (!project.nodes.length) return;
  // Rect-based rather than cursor-based: the caller reserves the space through
  // `layout.figure`, which is also what numbers and captions the drawing.
  const page = layout.surface;
  const left = rect.x;
  const right = rect.x + rect.width;
  const bottom = rect.y;
  const top = rect.y + rect.height;
  page.drawRectangle({ x: left, y: bottom, width: rect.width, height: rect.height, borderWidth: 0.5, borderColor: palette.rule, color: palette.paper });
  const projection = createProjection(project.nodes, {
    left: left + 42,
    right: right - 42,
    bottom: bottom + 30,
    top: top - 22,
  });
  const point = (nodeId: string): Point | undefined => {
    const node = index.node(nodeId);
    return node ? projection.at(node.x, node.y) : undefined;
  };
  for (const member of project.members) {
    const start = point(member.i); const end = point(member.j);
    if (!start || !end) continue;
    page.drawLine({ start, end, thickness: member.type === 'rigid' ? 3 : 2, color: palette.ink });
    page.drawText(pdfText(member.id), { x: (start.x + end.x) / 2 + 3, y: (start.y + end.y) / 2 + 3, size: 6.5, font: fonts.bold, color: palette.inkSoft });
  }
  for (const node of project.nodes) {
    const location = point(node.id);
    if (!location) continue;
    drawNodeDot(layout, location, node.id, palette.ink);
    drawSupportGlyph(layout, location, node.support, palette.inkSoft);
  }
  for (const load of project.nodalLoads) {
    const factor = scenarioFactors[load.caseId] ?? 0;
    const location = point(load.nodeId);
    if (!location || factor === 0 || (load.fx === 0 && load.fy === 0)) continue;
    drawArrow(layout, location, load.fx * factor, load.fy * factor, palette.load, 24);
  }
  drawMemberLoads(context, projection);
  if (includeReactions) {
    const reactionColor = palette.reaction;
    const reactionReference = Math.max(1, ...analysis.nodeResults.flatMap((result) => [Math.abs(result.rx), Math.abs(result.ry)]));
    for (const result of analysis.nodeResults) {
      const location = point(result.nodeId);
      if (!location) continue;
      const components: Array<{ value: number; fx: number; fy: number; label: string }> = [
        { value: result.rx, fx: result.rx, fy: 0, label: 'Rx' },
        { value: result.ry, fx: 0, fy: result.ry, label: 'Ry' },
      ];
      for (const component of components) {
        if (Math.abs(component.value) <= reactionReference * 1e-9) continue;
        const tail = drawArrow(layout, location, component.fx, component.fy, reactionColor, 25);
        if (!tail) continue;
        const value = clearDisplay(project, component.value, 'force', reactionReference);
        const labelX = component.fx === 0 ? tail.x + 4 : Math.min(location.x, tail.x) - 2;
        const labelY = component.fy === 0 ? tail.y + 5 : tail.y + (component.value < 0 ? -8 : 4);
        page.drawText(pdfText(`${component.label} ${value}`), {
          x: labelX,
          y: labelY,
          size: 6.2,
          font: fonts.bold,
          color: reactionColor,
        });
      }
    }
  }
};

/** Three small N/V/M strips, side by side inside the rectangle the caller reserved. */
export const drawMemberDiagrams = (
  context: ReportContext,
  result: AnalysisResult['memberResults'][number],
  rect: { x: number; y: number; width: number; height: number },
): void => {
  const { layout, project } = context;
  const { fonts, palette } = layout;
  if (result.diagram.length < 2 || result.length <= 0) return;
  const page = layout.surface;
  const gap = 9;
  const chartWidth = (rect.width - gap * 2) / 3;
  const chartTop = rect.y + rect.height - 12;
  const chartHeight = rect.height - 16;
  const chartBottom = chartTop - chartHeight;
  const definitions = [
    { key: 'axial' as const, label: 'N axial', color: palette.quantity.axial },
    { key: 'shear' as const, label: 'V cortante', color: palette.quantity.shear },
    { key: 'moment' as const, label: 'M momento', color: palette.quantity.moment },
  ];
  for (const [chartIndex, definition] of definitions.entries()) {
    const left = rect.x + chartIndex * (chartWidth + gap);
    const values = result.diagram.map((entry) => entry[definition.key]);
    const maximum = Math.max(1e-12, ...values.map((value) => Math.abs(value)));
    const baseline = chartBottom + chartHeight / 2;
    page.drawText(definition.label, { x: left, y: chartTop + 4, size: 7.3, font: fonts.bold, color: definition.color });
    page.drawRectangle({ x: left, y: chartBottom, width: chartWidth, height: chartHeight, borderColor: palette.rule, borderWidth: 0.5 });
    page.drawLine({ start: { x: left, y: baseline }, end: { x: left + chartWidth, y: baseline }, thickness: 0.45, color: palette.inkFaint });
    for (let pointIndex = 1; pointIndex < result.diagram.length; pointIndex += 1) {
      const previous = result.diagram[pointIndex - 1];
      const current = result.diagram[pointIndex];
      page.drawLine({
        start: { x: left + previous.x / result.length * chartWidth, y: baseline + previous[definition.key] / maximum * (chartHeight * 0.40) },
        end: { x: left + current.x / result.length * chartWidth, y: baseline + current[definition.key] / maximum * (chartHeight * 0.40) },
        thickness: 1.2,
        color: definition.color,
      });
    }
    // These legends printed raw base-unit numbers with no label, next to tables stating
    // the same quantities in the project's display units. Convert, collapse the noise
    // against the curve's own magnitude, and name the unit.
    const quantityUnitKey = quantityUnit(definition.key);
    const scale = Math.max(...values.map((value) => Math.abs(toDisplay(value, project.settings.units, quantityUnitKey))), 1e-12);
    const legendValue = (value: number) =>
      clearNumber(toDisplay(value, project.settings.units, quantityUnitKey), scale, 3);
    const legend = `min ${legendValue(Math.min(...values))} | max ${legendValue(Math.max(...values))} ${unitLabel(project.settings.units, quantityUnitKey)}`;
    page.drawText(pdfText(legend), { x: left + 3, y: chartBottom + 3, size: 5.7, font: fonts.regular, color: palette.inkSoft });
  }
};

/** Full-page diagram of one quantity drawn normal to every member. */
export const drawGlobalQuantityDiagram = (
  context: ReportContext,
  quantity: DiagramQuantity,
  left: number,
  bottom: number,
  width: number,
  height: number,
): void => {
  const { layout, project, analysis, index } = context;
  const { surface: page, fonts, palette } = layout;
  if (!project.nodes.length) return;
  const color = palette.quantity[quantity];
  const projection = createProjection(project.nodes, {
    left: left + 58,
    right: left + width - 58,
    bottom: bottom + 52,
    top: bottom + height - 48,
  });
  const modelPoint = (xValue: number, yValue: number) => projection.at(xValue, yValue);
  const maximum = Math.max(1e-12, ...analysis.memberResults.flatMap((result) => result.diagram.map((entry) => Math.abs(entry[quantity]))));
  const amplitude = Math.min(62, Math.max(34, Math.min(width, height) * 0.18));
  const side = readCanvasViewSettings(project).diagramSide === 'negative' ? -1 : 1;
  const labelCandidates: Array<{ value: number; x: number; y: number; memberId: string; station: number }> = [];
  for (const member of project.members) {
    const ni = index.node(member.i);
    const nj = index.node(member.j);
    if (!ni || !nj) continue;
    const start = modelPoint(ni.x, ni.y); const end = modelPoint(nj.x, nj.y);
    page.drawLine({ start, end, thickness: member.type === 'rigid' ? 3.2 : 2.2, color: palette.inkSoft });
    const result = index.memberResult(member.id);
    const axis = memberAxis(member, ni, nj);
    const totalLength = axis.length;
    if (!result || result.diagram.length < 2 || totalLength <= 0 || member.type === 'rigid') continue;
    const normal = axis.normal;
    const startOffset = result.startOffset ?? member.rigidOffsetI ?? 0;
    const diagramPoints = result.diagram.map((entry) => {
      const ratio = Math.min(1, Math.max(0, (startOffset + entry.x) / totalLength));
      const base = lerpPoint(start, end, ratio);
      const diagramOffset = side * entry[quantity] / maximum * amplitude;
      return { entry, base, curve: { x: base.x + normal.x * diagramOffset, y: base.y + normal.y * diagramOffset } };
    });
    const stride = Math.max(1, Math.floor(diagramPoints.length / 18));
    diagramPoints.forEach((item, pointIndex) => {
      if (pointIndex % stride === 0 || pointIndex === diagramPoints.length - 1) {
        page.drawLine({ start: item.base, end: item.curve, thickness: 0.45, color, opacity: 0.48 });
      }
      if (pointIndex > 0) page.drawLine({ start: diagramPoints[pointIndex - 1].curve, end: item.curve, thickness: 1.55, color });
    });
    const critical = result.criticalPoints.filter((point) => point.quantity === quantity).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
    if (critical) {
      const ratio = Math.min(1, Math.max(0, (startOffset + critical.x) / totalLength));
      const base = lerpPoint(start, end, ratio);
      const diagramOffset = side * critical.value / maximum * amplitude;
      labelCandidates.push({ value: critical.value, x: base.x + normal.x * diagramOffset, y: base.y + normal.y * diagramOffset, memberId: member.id, station: critical.x });
    }
  }
  for (const node of project.nodes) {
    drawNodeDot(layout, modelPoint(node.x, node.y), node.id, palette.ink, 3.2, 6.4);
  }
  labelCandidates.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 6).forEach((candidate, labelIndex) => {
    const value = clearDisplay(project, candidate.value, quantityUnit(quantity), maximum);
    const station = display(project, candidate.station, 'length');
    const label = `${candidate.memberId}: ${value} @ ${station}`;
    const labelY = Math.min(bottom + height - 28, Math.max(bottom + 18, candidate.y + (labelIndex % 2 === 0 ? 8 : -12)));
    page.drawText(pdfText(label), { x: Math.min(left + width - 130, Math.max(left + 8, candidate.x + 5)), y: labelY, size: 6.2, font: fonts.bold, color });
  });
  page.drawLine({ start: { x: left + 14, y: bottom + 20 }, end: { x: left + 42, y: bottom + 20 }, thickness: 1.7, color });
  page.drawText(pdfText(`${quantitySymbol(quantity)} positivo según los ejes locales de cada miembro`), { x: left + 50, y: bottom + 17, size: 6.8, font: fonts.regular, color: palette.inkSoft });
};

/**
 * The elastic curve of a straight beam, drawn over its undeformed axis.
 *
 * A deflection is a number nobody can picture, so a report that computes one and never draws
 * it has done half the work. The vertical scale is exaggerated on purpose and said so in the
 * caption: at true scale the curve would be indistinguishable from the axis.
 *
 * The shape comes from the deflection polynomials the method solved, not from a re-reading of
 * the model — this is the picture of the answer the page just derived.
 */
export const drawElasticCurve = (
  layout: PdfLayout,
  segments: readonly { x0: number; x1: number; deflection: readonly number[] }[],
  span: number,
  left: number,
  bottom: number,
  width: number,
  height: number,
  color: Tone,
): { peak: number; peakAt: number } => {
  const { surface: page, fonts } = layout;
  const baseline = bottom + height / 2;
  const plotLeft = left + 26;
  const plotWidth = Math.max(1, width - 52);
  const evaluate = (coefficients: readonly number[], x: number): number => {
    let value = 0;
    for (let power = coefficients.length - 1; power >= 0; power -= 1) value = value * x + coefficients[power];
    return value;
  };
  const sampleAt = (x: number): number => {
    const segment = segments.find((entry) => x >= entry.x0 - 1e-9 && x <= entry.x1 + 1e-9) ?? segments[segments.length - 1];
    return segment ? evaluate(segment.deflection, x) : 0;
  };

  const steps = 120;
  const samples: { x: number; value: number }[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const x = (span * step) / steps;
    samples.push({ x, value: sampleAt(x) });
  }
  const peakSample = samples.reduce((largest, sample) => (Math.abs(sample.value) > Math.abs(largest.value) ? sample : largest), samples[0]);
  const peak = Math.abs(peakSample.value);
  const amplitude = Math.min(height / 2 - 12, 34);
  const toPoint = (sample: { x: number; value: number }) => ({
    x: plotLeft + (sample.x / Math.max(span, 1e-9)) * plotWidth,
    // Positive deflection is upward in the model; on the page +y is up too, so the sign
    // carries straight through and a sagging beam reads as sagging.
    y: baseline + (peak > 0 ? (sample.value / peak) * amplitude : 0),
  });

  page.drawLine({
    start: { x: plotLeft, y: baseline },
    end: { x: plotLeft + plotWidth, y: baseline },
    thickness: 1.1,
    color: layout.palette.inkSoft,
  });
  let previous = toPoint(samples[0]);
  for (const sample of samples.slice(1)) {
    const point = toPoint(sample);
    page.drawLine({ start: previous, end: point, thickness: 1.35, color });
    previous = point;
  }

  const peakPoint = toPoint(peakSample);
  page.drawCircle({ x: peakPoint.x, y: peakPoint.y, size: 2.2, color });
  page.drawText(pdfText('Curva elástica (escala vertical exagerada)'), {
    x: plotLeft,
    y: bottom + 4,
    size: 6.2,
    font: fonts.regular,
    color: layout.palette.inkSoft,
  });
  return { peak: peakSample.value, peakAt: peakSample.x };
};
