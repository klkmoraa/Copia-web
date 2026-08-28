/**
 * Headless math typesetting: LaTeX in, a size-independent tree of glyph paths and fraction-bar
 * rects out. Runs entirely offline via `mathjax-full`'s DOM-free `liteAdaptor` — no browser
 * canvas, no network font fetch, so it works identically in a Vitest run and in the exported
 * PWA. Sizing is deferred to the caller: every coordinate here is in TeX design units (1000 per
 * em), the same space the raw glyph paths are authored in, so one parse serves every font size
 * a formula is drawn at.
 */
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

export class MathTypesetError extends Error {}

export interface AffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export type FormulaOp =
  | { kind: 'path'; path: string; matrix: AffineMatrix }
  | { kind: 'rect'; matrix: AffineMatrix; x: number; y: number; width: number; height: number };

export interface ParsedFormula {
  ops: FormulaOp[];
  /** Natural width, in TeX design units (1000 per em). */
  widthUnits: number;
  /** Natural height above the baseline, in TeX design units. */
  heightUnits: number;
  /** Natural depth below the baseline, in TeX design units. */
  depthUnits: number;
}

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: AllPackages });
const svgOutput = new SVG({ fontCache: 'local' });
const html = mathjax.document('', { InputJax: tex, OutputJax: svgOutput });

const IDENTITY: AffineMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** `m1 ∘ m2`: applies `m2` first, then `m1` — the order nested SVG `<g>` transforms compose in. */
const multiply = (m1: AffineMatrix, m2: AffineMatrix): AffineMatrix => ({
  a: m1.a * m2.a + m1.c * m2.b,
  b: m1.b * m2.a + m1.d * m2.b,
  c: m1.a * m2.c + m1.c * m2.d,
  d: m1.b * m2.c + m1.d * m2.d,
  e: m1.a * m2.e + m1.c * m2.f + m1.e,
  f: m1.b * m2.e + m1.d * m2.f + m1.f,
});

/** MathJax's SVG output only ever nests `translate(x,y)` and `translate(x,y) scale(s)`. */
const parseTransform = (transform: string | undefined): AffineMatrix => {
  let matrix = IDENTITY;
  if (!transform) return matrix;
  const translateMatch = /translate\(([-\d.]+),([-\d.]+)\)/.exec(transform);
  if (translateMatch) {
    matrix = multiply(matrix, { a: 1, b: 0, c: 0, d: 1, e: parseFloat(translateMatch[1]), f: parseFloat(translateMatch[2]) });
  }
  const scaleMatch = /scale\(([-\d.]+)(?:,([-\d.]+))?\)/.exec(transform);
  if (scaleMatch) {
    const sx = parseFloat(scaleMatch[1]);
    const sy = scaleMatch[2] !== undefined ? parseFloat(scaleMatch[2]) : sx;
    matrix = multiply(matrix, { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
  }
  return matrix;
};

interface LiteElement {
  kind: string;
  attributes: Record<string, string>;
  children: LiteElement[];
}

const walk = (element: LiteElement, parentMatrix: AffineMatrix, paths: Map<string, string>, ops: FormulaOp[]): void => {
  if (element.kind === 'use') {
    const id = element.attributes['xlink:href'].slice(1);
    const path = paths.get(id);
    if (path !== undefined) ops.push({ kind: 'path', path, matrix: parentMatrix });
    return;
  }
  if (element.kind === 'rect') {
    ops.push({
      kind: 'rect',
      matrix: parentMatrix,
      x: parseFloat(element.attributes.x ?? '0'),
      y: parseFloat(element.attributes.y ?? '0'),
      width: parseFloat(element.attributes.width ?? '0'),
      height: parseFloat(element.attributes.height ?? '0'),
    });
    return;
  }
  const local = parseTransform(element.attributes?.transform);
  const next = multiply(parentMatrix, local);
  for (const child of element.children ?? []) walk(child, next, paths, ops);
};

const parseViewBox = (viewBox: string | undefined): { minY: number; width: number; height: number } => {
  const parts = (viewBox ?? '0 0 0 0').split(/\s+/).map(Number);
  const [, minY, width, height] = parts;
  return { minY, width, height };
};

const compute = (latex: string): ParsedFormula => {
  let node: LiteElement;
  try {
    node = html.convert(latex, { display: false }) as unknown as LiteElement;
  } catch (error) {
    throw new MathTypesetError(`No se pudo tipografiar «${latex}»: ${error instanceof Error ? error.message : String(error)}`);
  }
  const svgNode = node.children.find((child) => child.kind === 'svg');
  if (!svgNode) throw new MathTypesetError(`MathJax no produjo salida SVG para «${latex}».`);

  const paths = new Map<string, string>();
  const defsNode = svgNode.children.find((child) => child.kind === 'defs');
  for (const child of defsNode?.children ?? []) {
    if (child.kind === 'path') paths.set(child.attributes.id, child.attributes.d);
  }

  const ops: FormulaOp[] = [];
  const rootGroup = svgNode.children.find((child) => child.kind === 'g');
  if (rootGroup) walk(rootGroup, IDENTITY, paths, ops);

  const { minY, width, height } = parseViewBox(svgNode.attributes.viewBox);
  return { ops, widthUnits: width, heightUnits: -minY, depthUnits: minY + height };
};

const cache = new Map<string, ParsedFormula>();

export const typesetLatex = (latex: string): ParsedFormula => {
  const cached = cache.get(latex);
  if (cached) return cached;
  const parsed = compute(latex);
  cache.set(latex, parsed);
  return parsed;
};
