/**
 * Vector artwork of the report: the global free-body diagram, the per-member N/V/M strips,
 * the full-page N, V or M diagram drawn over the structure, and the elastic curve.
 *
 * All three project the model onto the page with the same transform — bounding box, uniform
 * scale, centred offsets — so it lives in one place and each caller only declares its plot
 * padding.
 */
import type { AnalysisResult, DiagramQuantity, NodeModel } from '../../types';
import { toDisplay, unitLabel } from '../../engine/units';
import { readCanvasViewSettings } from '../../features/view/canvasViewSettings';
import {
  distributedIntensityAt,
  grossRatioFromFlexible,
  lerpPoint,
  memberAxis,
  modelBounds,
  toGlobalVector,
} from '../../graphics/structureGeometry';
import { pdfText } from './pdfGlyphs';
import {
  clearDisplay,
  clearNumber,
  display,
  number,
  quantitySymbol,
  quantityUnit,
} from './pdfFormat';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor, ReportContext } from './reportContext';

interface PlotBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

interface Projection {
  at(x: number, y: number): { x: number; y: number };
}

/** Uniform model -> page transform that centres the structure inside `plot`. */
const createProjection = (nodes: readonly NodeModel[], plot: PlotBox): Projection => {
  const { minX, maxX, minY, maxY } = modelBounds(nodes);
  const scale = Math.min(
    (plot.right - plot.left) / Math.max(maxX - minX, 1),
    (plot.top - plot.bottom) / Math.max(maxY - minY, 1),
  );
  const offsetX = (plot.left + plot.right - (maxX - minX) * scale) / 2;
  const offsetY = (plot.bottom + plot.top - (maxY - minY) * scale) / 2;
  return {
    at: (x, y) => ({ x: offsetX + (x - minX) * scale, y: offsetY + (y - minY) * scale }),
  };
};

/** Arrow head-first at `location`; returns the tail, where labels are anchored. */
const drawArrow = (
  layout: PdfLayout,
  location: { x: number; y: number },
  fx: number,
  fy: number,
  color: PdfColor,
  length: number,
): { x: number; y: number } | undefined => {
  const magnitude = Math.hypot(fx, fy);
  if (!(magnitude > 1e-12)) return undefined;
  const dx = fx / magnitude * length;
  const dy = fy / magnitude * length;
  const tail = { x: location.x - dx, y: location.y - dy };
  layout.page.drawLine({ start: tail, end: location, thickness: 1.15, color });
  layout.page.drawLine({ start: location, end: { x: location.x - dx * 0.30 - dy * 0.15, y: location.y - dy * 0.30 + dx * 0.15 }, thickness: 1, color });
  layout.page.drawLine({ start: location, end: { x: location.x - dx * 0.30 + dy * 0.15, y: location.y - dy * 0.30 - dx * 0.15 }, thickness: 1, color });
  return tail;
};

/** Framed free-body diagram: geometry, supports, applied actions and optional reactions. */
export const drawGlobalDcl = (context: ReportContext, height = 168, includeReactions = false): void => {
  const { layout, project, analysis, scenarioFactors, index } = context;
  const { rgb, fonts, palette, margin } = layout;
  if (!project.nodes.length) return;
  layout.ensure(height + 22);
  const page = layout.page;
  const top = layout.y;
  const left = margin;
  const right = layout.width - margin;
  const bottom = top - height;
  page.drawRectangle({ x: left, y: bottom, width: right - left, height, borderWidth: 0.7, borderColor: palette.rule, color: rgb(0.975, 0.985, 0.995) });
  page.drawText('DCL global - geometría, apoyos y acciones', { x: left + 10, y: top - 15, size: 8.5, font: fonts.bold, color: palette.forestDeep });
  const projection = createProjection(project.nodes, {
    left: left + 42,
    right: right - 42,
    bottom: bottom + 32,
    top: top - 34,
  });
  const point = (nodeId: string): { x: number; y: number } | undefined => {
    const node = index.node(nodeId);
    return node ? projection.at(node.x, node.y) : undefined;
  };
  for (const member of project.members) {
    const start = point(member.i); const end = point(member.j);
    if (!start || !end) continue;
    page.drawLine({ start, end, thickness: member.type === 'rigid' ? 3 : 2, color: rgb(0.12, 0.15, 0.19) });
    page.drawText(pdfText(member.id), { x: (start.x + end.x) / 2 + 3, y: (start.y + end.y) / 2 + 3, size: 6.5, font: fonts.bold, color: rgb(0.22, 0.26, 0.31) });
  }
  for (const node of project.nodes) {
    const location = point(node.id);
    if (!location) continue;
    page.drawCircle({ x: location.x, y: location.y, size: 3, color: rgb(1, 1, 1), borderColor: rgb(0.04, 0.40, 0.82), borderWidth: 1.1 });
    page.drawText(pdfText(node.id), { x: location.x + 5, y: location.y + 4, size: 6.5, font: fonts.regular, color: rgb(0.11, 0.17, 0.24) });
    if (node.support.type !== 'none') {
      const isRoller = node.support.type === 'roller';
      page.drawLine({ start: { x: location.x, y: location.y - 3 }, end: { x: location.x - 7, y: location.y - 13 }, thickness: 1, color: rgb(0.10, 0.48, 0.25) });
      page.drawLine({ start: { x: location.x, y: location.y - 3 }, end: { x: location.x + 7, y: location.y - 13 }, thickness: 1, color: rgb(0.10, 0.48, 0.25) });
      if (isRoller) {
        page.drawCircle({ x: location.x - 4, y: location.y - 15.5, size: 1.8, borderColor: rgb(0.10, 0.48, 0.25), borderWidth: 0.8 });
        page.drawCircle({ x: location.x + 4, y: location.y - 15.5, size: 1.8, borderColor: rgb(0.10, 0.48, 0.25), borderWidth: 0.8 });
        page.drawLine({ start: { x: location.x - 10, y: location.y - 19 }, end: { x: location.x + 10, y: location.y - 19 }, thickness: 1, color: rgb(0.10, 0.48, 0.25) });
      } else {
        page.drawLine({ start: { x: location.x - 9, y: location.y - 13 }, end: { x: location.x + 9, y: location.y - 13 }, thickness: 1, color: rgb(0.10, 0.48, 0.25) });
      }
    }
  }
  for (const load of project.nodalLoads) {
    const factor = scenarioFactors[load.caseId] ?? 0;
    const location = point(load.nodeId);
    if (!location || factor === 0 || (load.fx === 0 && load.fy === 0)) continue;
    drawArrow(layout, location, load.fx * factor, load.fy * factor, rgb(0.52, 0.18, 0.65), 24);
  }
  for (const load of project.memberLoads) {
    const factor = scenarioFactors[load.caseId] ?? 0;
    if (factor === 0) continue;
    const member = index.member(load.memberId);
    if (!member) continue;
    const startNode = index.node(member.i);
    const endNode = index.node(member.j);
    const screenStart = point(member.i);
    const screenEnd = point(member.j);
    if (!startNode || !endNode || !screenStart || !screenEnd) continue;
    const axis = memberAxis(member, startNode, endNode);
    if (!(axis.length > 0)) continue;
    if (!(axis.flexibleLength > 0)) continue;
    const atFlexibleRatio = (ratio: number) => lerpPoint(screenStart, screenEnd, grossRatioFromFlexible(axis, ratio));
    const globalVector = (x: number, y: number): [number, number] =>
      toGlobalVector(axis, load.coordinateSystem, x, y);
    const actionColor = rgb(0.05, 0.48, 0.23);
    if (load.type === 'distributed') {
      const startRatio = Math.min(load.start, load.end);
      const endRatio = Math.max(load.start, load.end);
      const arrowTails: Array<{ x: number; y: number }> = [];
      const count = 7;
      for (let arrowIndex = 0; arrowIndex < count; arrowIndex += 1) {
        const t = arrowIndex / (count - 1);
        const ratio = startRatio + (endRatio - startRatio) * t;
        const intensity = distributedIntensityAt(load, t);
        const [gx, gy] = globalVector(intensity.qx * factor, intensity.qy * factor);
        const tail = drawArrow(layout, atFlexibleRatio(ratio), gx, gy, actionColor, 16);
        if (tail) arrowTails.push(tail);
      }
      if (arrowTails.length > 1) page.drawLine({ start: arrowTails[0], end: arrowTails.at(-1)!, thickness: 0.9, color: actionColor });
      const label = atFlexibleRatio((startRatio + endRatio) / 2);
      page.drawText(pdfText(`${load.id} [${number(startRatio)}-${number(endRatio)}]`), { x: label.x + 3, y: label.y + 20, size: 6, font: fonts.bold, color: actionColor });
    } else if (load.type === 'point') {
      const [gx, gy] = globalVector((load.px ?? 0) * factor, (load.py ?? 0) * factor);
      const location = atFlexibleRatio(Math.min(1, Math.max(0, load.position ?? 0.5)));
      const tail = drawArrow(layout, location, gx, gy, actionColor, 22) ?? location;
      page.drawText(pdfText(load.id), { x: tail.x + 2, y: tail.y + 5, size: 6, font: fonts.bold, color: actionColor });
    } else {
      const location = atFlexibleRatio(Math.min(1, Math.max(0, load.position ?? 0.5)));
      page.drawText(pdfText(`${load.id}: M x ${number(factor)}`), { x: location.x + 4, y: location.y + 8, size: 6, font: fonts.bold, color: actionColor });
    }
  }
  if (includeReactions) {
    const reactionColor = rgb(0.04, 0.40, 0.72);
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
  layout.y = bottom - 12;
};

/** Three small N/V/M strips printed under a member in the technical annex. */
export const drawMemberDiagrams = (context: ReportContext, result: AnalysisResult['memberResults'][number]): void => {
  const { layout, project } = context;
  const { rgb, fonts, margin } = layout;
  if (result.diagram.length < 2 || result.length <= 0) return;
  const chartHeight = 58;
  const blockHeight = 86;
  layout.ensure(blockHeight + 8);
  const page = layout.page;
  const gap = 9;
  const chartWidth = (layout.contentWidth - gap * 2) / 3;
  const chartTop = layout.y - 14;
  const chartBottom = chartTop - chartHeight;
  const definitions = [
    { key: 'axial' as const, label: 'N axial', color: rgb(0.02, 0.40, 0.82) },
    { key: 'shear' as const, label: 'V cortante', color: rgb(0.08, 0.47, 0.20) },
    { key: 'moment' as const, label: 'M momento', color: rgb(0.79, 0.17, 0.15) },
  ];
  for (const [chartIndex, definition] of definitions.entries()) {
    const left = margin + chartIndex * (chartWidth + gap);
    const values = result.diagram.map((entry) => entry[definition.key]);
    const maximum = Math.max(1e-12, ...values.map((value) => Math.abs(value)));
    const baseline = chartBottom + chartHeight / 2;
    page.drawText(definition.label, { x: left, y: chartTop + 4, size: 7.3, font: fonts.bold, color: definition.color });
    page.drawRectangle({ x: left, y: chartBottom, width: chartWidth, height: chartHeight, borderColor: rgb(0.80, 0.83, 0.87), borderWidth: 0.5 });
    page.drawLine({ start: { x: left, y: baseline }, end: { x: left + chartWidth, y: baseline }, thickness: 0.45, color: rgb(0.55, 0.58, 0.62) });
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
    page.drawText(pdfText(legend), { x: left + 3, y: chartBottom + 3, size: 5.7, font: fonts.regular, color: rgb(0.34, 0.38, 0.43) });
  }
  layout.y = chartBottom - 14;
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
  const { page, rgb, fonts, palette } = layout;
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
    page.drawLine({ start, end, thickness: member.type === 'rigid' ? 3.2 : 2.2, color: rgb(0.42, 0.49, 0.45) });
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
    const location = modelPoint(node.x, node.y);
    page.drawCircle({ x: location.x, y: location.y, size: 3.2, color: rgb(1, 1, 1), borderColor: rgb(0.30, 0.38, 0.33), borderWidth: 1.1 });
    page.drawText(pdfText(node.id), { x: location.x + 5, y: location.y + 5, size: 6.4, font: fonts.bold, color: rgb(0.25, 0.31, 0.27) });
  }
  labelCandidates.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 6).forEach((candidate, labelIndex) => {
    const value = clearDisplay(project, candidate.value, quantityUnit(quantity), maximum);
    const station = display(project, candidate.station, 'length');
    const label = `${candidate.memberId}: ${value} @ ${station}`;
    const labelY = Math.min(bottom + height - 28, Math.max(bottom + 18, candidate.y + (labelIndex % 2 === 0 ? 8 : -12)));
    page.drawText(pdfText(label), { x: Math.min(left + width - 130, Math.max(left + 8, candidate.x + 5)), y: labelY, size: 6.2, font: fonts.bold, color });
  });
  page.drawLine({ start: { x: left + 14, y: bottom + 20 }, end: { x: left + 42, y: bottom + 20 }, thickness: 1.7, color });
  page.drawText(pdfText(`${quantitySymbol(quantity)} positivo según los ejes locales de cada miembro`), { x: left + 50, y: bottom + 17, size: 6.8, font: fonts.regular, color: rgb(0.32, 0.39, 0.35) });
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
  color: PdfColor,
): { peak: number; peakAt: number } => {
  const { page, rgb, fonts } = layout;
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
    color: rgb(0.42, 0.49, 0.45),
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
    color: rgb(0.38, 0.44, 0.40),
  });
  return { peak: peakSample.value, peakAt: peakSample.x };
};
