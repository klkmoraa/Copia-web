/// <reference types="node" />

/**
 * The drawing vocabulary the technical figures are built from.
 *
 * Every assertion here is on something that is either invisible in the PDF's structure or
 * indistinguishable from a plausible wrong answer by eye at a glance — which is exactly the
 * class of defect this file exists for. Three of the four were real, and two of them shipped
 * for a moment during the ReportLab migration:
 *
 * - a translucent area printed as a solid block of ink, because `setFillColor` ends by applying
 *   the colour's *own* alpha and wipes one set beforehand;
 * - a label's halo doubled the label in every text extractor, because a stroked copy of the
 *   glyphs is a second text-showing operator;
 * - an arrowhead drawn as two barb strokes rather than a closed triangle.
 */
import { describe, expect, it } from 'vitest';
import { MARGIN, PAGE_SIZE, PdfLayout } from './pdfBuilder';
import { arcOps } from './pdfSurface';
import { drawArrow, drawMomentArc } from './pdfScene';
import { renderReportDocument } from './reportlabRenderer';
import type { Block, ReportDocument, SceneMark } from './reportDocument';

/** The marks one drawing produced, without a document around it. */
const compose = (draw: (layout: PdfLayout) => void): readonly SceneMark[] => {
  const layout = new PdfLayout();
  layout.part('Prueba');
  layout.figure(120, () => draw(layout));
  const [block] = layout.build().parts[0].blocks;
  if (block.kind !== 'figure') throw new Error('expected a figure block');
  return block.marks;
};

const renderFigure = async (marks: readonly SceneMark[]): Promise<Uint8Array> => {
  const figure: Block = { kind: 'figure', number: 1, height: 120, marks };
  const document: ReportDocument = {
    version: 1,
    page: { width: PAGE_SIZE[0], height: PAGE_SIZE[1], margin: MARGIN },
    cover: { documentTitle: 'Memoria', projectName: 'Prueba', facts: [], noticeTitle: 'Aviso', notice: 'Aviso.' },
    contentsTitle: 'Contenido',
    runningTitle: 'Prueba',
    documentTitle: 'Memoria',
    parts: [{ title: 'Prueba', number: 1, blocks: [figure] }],
    metadata: {
      title: 'Prueba', author: 'structureCo', subject: '', keywords: [],
      producer: 'structureCo', creator: 'structureCo', language: 'es',
      stampedAt: '2026-08-29T12:00:00.000Z',
    },
  };
  return renderReportDocument(document);
};

const extractText = async (bytes: Uint8Array): Promise<string[]> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes.slice(), useWorkerFetch: false }).promise;
  const strings: string[] = [];
  for (let page = 1; page <= document.numPages; page += 1) {
    const content = await (await document.getPage(page)).getTextContent();
    for (const item of content.items) if ('str' in item && item.str.trim()) strings.push(item.str);
  }
  return strings;
};

describe('arcOps', () => {
  it('lands every control point of every segment on the circle it is approximating', () => {
    const centre = { x: 30, y: 40 };
    const radius = 15;
    const ops = arcOps(centre, radius, Math.PI * 0.25, Math.PI * 0.25 + Math.PI * 1.35);
    // A quarter turn per segment at most, so a 243° sweep needs three.
    expect(ops.filter((op) => op.o === 'c')).toHaveLength(3);

    // The anchors are exact; the curve between them is the standard `4/3·tan(Δ/4)` construction,
    // whose worst-case radial error over a quarter turn is ~2.7e-4 of the radius.
    const anchors = ops.flatMap((op) => op.o === 'm' || op.o === 'c' ? [{ x: op.x, y: op.y }] : []);
    for (const anchor of anchors) {
      expect(Math.hypot(anchor.x - centre.x, anchor.y - centre.y)).toBeCloseTo(radius, 9);
    }
    // And it turns the way it was asked to: the last anchor is at the end angle, not the start.
    const end = anchors[anchors.length - 1];
    expect(Math.atan2(end.y - centre.y, end.x - centre.x)).toBeCloseTo(Math.PI * 1.6 - Math.PI * 2, 6);
  });
});

describe('drawArrow', () => {
  it('closes its head into one filled triangle instead of two barb strokes', () => {
    const marks = compose((layout) => {
      drawArrow(layout, { x: 60, y: 40 }, 0, -1, 'load', 24);
    });
    const heads = marks.filter((mark) => mark.t === 'path');
    expect(heads).toHaveLength(1);
    const [head] = heads;
    if (head.t !== 'path') throw new Error('expected a path mark');
    expect(head.fill).toBe('load');
    // Three corners and a close, mitred so the point stays a point.
    expect(head.d.filter((op) => op.o === 'm' || op.o === 'l')).toHaveLength(3);
    expect(head.d.at(-1)?.o).toBe('z');
    expect(head.join).toBe(0);

    // One shaft, and it stops inside the head rather than running through its tip.
    const shafts = marks.filter((mark) => mark.t === 'line');
    expect(shafts).toHaveLength(1);
    if (shafts[0].t !== 'line') throw new Error('expected a line mark');
    expect(shafts[0].to.y).toBeGreaterThan(40);
  });
});

describe('drawMomentArc', () => {
  it('draws one curved stroke and one filled head, not a fan of chords', () => {
    const marks = compose((layout) => {
      drawMomentArc(layout, { x: 60, y: 60 }, 1, 15, 'moment');
    });
    expect(marks.filter((mark) => mark.t === 'line')).toHaveLength(0);
    const paths = marks.filter((mark) => mark.t === 'path');
    expect(paths).toHaveLength(2);
    const [arc, head] = paths;
    if (arc.t !== 'path' || head.t !== 'path') throw new Error('expected path marks');
    expect(arc.stroke).toBe('moment');
    expect(arc.fill).toBeUndefined();
    expect(arc.d.some((op) => op.o === 'c')).toBe(true);
    expect(head.fill).toBe('moment');
  });
});

describe('lo que el renderizador hace con una marca traslúcida y con un halo', () => {
  it('una figura traslúcida se imprime traslúcida, no como un bloque de tinta', async () => {
    // `setFillColor` applies the colour object's own alpha last, so an alpha set beforehand is
    // silently wiped — and a diagram area printed solid. This asserts the state the page really
    // carries, because the failure is invisible in the PDF's structure and obvious only on paper.
    const bytes = await renderFigure([
      { t: 'path', d: [{ o: 'm', x: 0, y: 0 }, { o: 'l', x: 80, y: 0 }, { o: 'l', x: 80, y: 40 }, { o: 'z' }], fill: 'moment', opacity: 0.18 },
    ]);
    const raw = Buffer.from(bytes).toString('latin1');
    expect(raw).toMatch(/\/ca \.?18/);
  }, 120_000);

  it('un rótulo con halo se extrae una sola vez', async () => {
    // The halo is a drawn plate, not a stroked copy of the glyphs: a stroked copy would be a
    // second text-showing operator, and every extractor would report the label twice — in the
    // report's own inspection, in a reader's copy-paste, and in the gates that read the PDF back.
    const bytes = await renderFigure([
      { t: 'text', at: { x: 10, y: 20 }, text: 'Ry 27.5 kN', size: 6.2, tone: 'reaction', face: 'bold', halo: 'paper' },
    ]);
    const strings = await extractText(bytes);
    expect(strings.filter((value) => value === 'Ry 27.5 kN')).toHaveLength(1);
  }, 120_000);
});
