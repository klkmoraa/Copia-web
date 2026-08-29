/**
 * The arithmetic that decides how big a free-body figure is and where its labels land.
 *
 * These numbers are the ones that made the first version of the drawings look wrong, so they are
 * asserted directly rather than judged from a rendered page.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_SCENE_HEIGHT,
  MIN_PLOT_HEIGHT,
  MIN_SCENE_HEIGHT,
  SCENE_PADDING,
  placeLabelBox,
  sceneFigureHeight,
  sceneFrame,
  sceneMetrics,
  scenePlot,
  type LabelBox,
} from './pdfSceneLayout';

/** The measure a figure gets on an A4 page with the report's own margins. */
const FRAME_WIDTH = 595.28 - 50 * 2;

/** What fraction of its own frame the drawing ends up occupying. */
const occupancy = (spanX: number, spanY: number) => {
  const extent = { spanX, spanY };
  const height = sceneFigureHeight(extent, FRAME_WIDTH);
  const frame = sceneFrame({ x: 50, y: 0, width: FRAME_WIDTH, height }, extent);
  const plot = scenePlot(frame);
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.top - plot.bottom;
  const scale = Math.min(plotWidth / Math.max(spanX, 1e-9), spanY > 0 ? plotHeight / spanY : Infinity);
  return {
    height,
    frame,
    width: (spanX * scale) / plotWidth,
    tall: spanY > 0 ? (spanY * scale) / plotHeight : 0,
  };
};

describe('sceneFigureHeight', () => {
  it('hace coincidir la proporción del trazado con la del modelo', () => {
    // A 6x4 model is 1.5 times wider than tall; the plot it gets must be too, so `min()` has no
    // slack dimension left to leave empty.
    const extent = { spanX: 6, spanY: 4 };
    const height = sceneFigureHeight(extent, FRAME_WIDTH);
    const frame = sceneFrame({ x: 50, y: 0, width: FRAME_WIDTH, height }, extent);
    const plot = scenePlot(frame);
    expect((plot.right - plot.left) / (plot.top - plot.bottom)).toBeCloseTo(6 / 4, 5);
  });

  it('una viga de canto nulo pide el mínimo, no una figura con una banda muerta', () => {
    expect(sceneFigureHeight({ spanX: 12, spanY: 0 }, FRAME_WIDTH)).toBe(MIN_SCENE_HEIGHT);
  });

  it('un modelo muy esbelto se detiene en el techo en vez de crecer sin fin', () => {
    expect(sceneFigureHeight({ spanX: 1, spanY: 20 }, FRAME_WIDTH)).toBe(MAX_SCENE_HEIGHT);
  });

  it('el dibujo llena su figura donde antes ocupaba una cuarta parte', () => {
    // The measurements that motivated this work: a 6x4 truss used to fill 27.5 % of the width of
    // its own figure, and a beam 0.5 % of its height.
    const truss = occupancy(6, 4);
    expect(truss.width).toBeGreaterThan(0.6);
    expect(truss.tall).toBeGreaterThan(0.6);

    const beam = occupancy(12, 0);
    expect(beam.width).toBeGreaterThan(0.9);
    // And its frame is short, so the page is not paying for a band nothing is drawn in.
    expect(beam.height).toBeLessThan(MAX_SCENE_HEIGHT * 0.6);
  });
});

describe('sceneFrame', () => {
  it('abraza el dibujo en vez de bordear todo el hueco', () => {
    // A tall, narrow model inside a wide slot: the border must come in, not float around it.
    const extent = { spanX: 1, spanY: 1 };
    const rect = { x: 50, y: 0, width: FRAME_WIDTH, height: 200 };
    const frame = sceneFrame(rect, extent);
    expect(frame.width).toBeLessThan(rect.width);
    // Centred in what it was given.
    expect(frame.x + frame.width / 2).toBeCloseTo(rect.x + rect.width / 2, 6);
    expect(frame.y + frame.height / 2).toBeCloseTo(rect.y + rect.height / 2, 6);
  });

  it('nunca se sale del hueco que le dieron', () => {
    const rect = { x: 50, y: 0, width: FRAME_WIDTH, height: 140 };
    const frame = sceneFrame(rect, { spanX: 30, spanY: 1 });
    expect(frame.x).toBeGreaterThanOrEqual(rect.x - 1e-9);
    expect(frame.x + frame.width).toBeLessThanOrEqual(rect.x + rect.width + 1e-9);
    expect(frame.height).toBeLessThanOrEqual(rect.height + 1e-9);
  });

  it('nunca produce un trazado degenerado, ni con un modelo sin canto', () => {
    // A straight beam spans zero in y. Matching the plot's aspect to the model's would ask for a
    // plot of zero height, and every projection into it collapsed the beam onto a single point.
    const extent = { spanX: 6, spanY: 0 };
    const height = sceneFigureHeight(extent, FRAME_WIDTH);
    const plot = scenePlot(sceneFrame({ x: 50, y: 0, width: FRAME_WIDTH, height }, extent));
    expect(plot.top - plot.bottom).toBeGreaterThanOrEqual(MIN_PLOT_HEIGHT);
    expect(plot.right - plot.left).toBeGreaterThan(0);
  });

  it('deja sitio bajo el dibujo para el glifo de apoyo y la cota', () => {
    const frame = sceneFrame({ x: 50, y: 0, width: FRAME_WIDTH, height: 200 }, { spanX: 6, spanY: 4 });
    const plot = scenePlot(frame);
    expect(plot.bottom - frame.y).toBe(SCENE_PADDING.bottom);
  });
});

describe('sceneMetrics', () => {
  it('escala las marcas con el trazado, entre topes', () => {
    const small = sceneMetrics(120, 80);
    const large = sceneMetrics(440, 240);
    expect(large.arrow).toBeGreaterThan(small.arrow);
    expect(large.label).toBeGreaterThan(small.label);
    // But never so small it cannot be read, nor so large it swamps the drawing.
    expect(small.label).toBeGreaterThanOrEqual(5.6);
    expect(large.arrow).toBeLessThanOrEqual(34);
  });
});

describe('placeLabelBox', () => {
  const frame = { x: 0, y: 0, width: 400, height: 200 };
  const request = (anchor: { x: number; y: number }) => ({
    text: 'N(AB) = 22.5 kN', width: 60, height: 8, anchor, direction: { x: 1, y: 0 }, gap: 6,
  });

  it('separa dos rótulos que comparten ancla', () => {
    const taken: LabelBox[] = [];
    const first = placeLabelBox(request({ x: 200, y: 100 }), taken, frame);
    taken.push(first.box);
    const second = placeLabelBox(request({ x: 200, y: 100 }), taken, frame);
    const apart = second.box.y + second.box.height <= first.box.y
      || first.box.y + first.box.height <= second.box.y
      || second.box.x + second.box.width <= first.box.x
      || first.box.x + first.box.width <= second.box.x;
    expect(apart).toBe(true);
  });

  it('mantiene cada rótulo dentro del marco', () => {
    const placed = placeLabelBox(request({ x: 396, y: 198 }), [], frame);
    expect(placed.box.x).toBeGreaterThanOrEqual(frame.x);
    expect(placed.box.x + placed.box.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(placed.box.y + placed.box.height).toBeLessThanOrEqual(frame.y + frame.height);
  });

  it('cuando no queda hueco, aparca el rótulo y pide una guía', () => {
    // Every candidate position around the anchor is already occupied.
    const taken: LabelBox[] = [];
    for (let index = 0; index < 40; index += 1) {
      taken.push({ x: 40 + (index % 8) * 40, y: 20 + Math.floor(index / 8) * 30, width: 60, height: 26 });
    }
    const placed = placeLabelBox(request({ x: 200, y: 100 }), taken, frame);
    expect(placed.leader).toEqual({ x: 200, y: 100 });
  });
});
