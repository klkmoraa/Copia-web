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
// Naming a package in `new TeX({ packages })` only *selects* it; the package registers itself
// as a side effect of being imported. Without this line the `'ams'` below was a no-op, and
// `\therefore` / `\varnothing` — both in `mathLatex.ts`'s symbol table — were undefined control
// sequences that MathJax silently rendered as an `merror` bar.
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';

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
const tex = new TeX({ packages: ['base', 'ams'] });
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

/**
 * SVG node kinds `walk` recurses through as pure containers, rather than drawing.
 *
 * `walk` used to treat *every* unrecognised kind as a container and recurse into its children,
 * which silently discarded any leaf that was neither `use` nor `rect` — no error, just a gap in
 * the drawing while the formula's reserved width still accounted for it. Anything outside this
 * set and outside `use`/`rect`/`text` is now an error instead.
 */
const CONTAINER_KINDS: ReadonlySet<string> = new Set(['g', 'svg', 'defs', 'clipPath', 'title', 'desc', 'style', 'metadata']);

/**
 * `<text>` (and the `#text` value node inside it) is MathJax's fallback for a character its TeX
 * fonts have no glyph for, so there is no path to draw and this renderer can only skip it.
 *
 * It is *not* treated as an error, however tempting: the concrete producers in this codebase are
 * accented Spanish letters — `deformación` typesets to eight `<use>` glyphs plus a `<text>` for
 * the `ó` — and any user-entered label that also carries a math symbol reaches here through
 * `pdfMath.ts`'s `needsMath` gate. Throwing would turn a dropped accent into a failed PDF
 * export, which is strictly worse. The other producer, an `merror`'s message text, never gets
 * this far: `compute` rejects error trees before `walk` runs.
 */
const UNDRAWABLE_KINDS: ReadonlySet<string> = new Set(['text', '#text']);

const walk = (element: LiteElement, parentMatrix: AffineMatrix, paths: Map<string, string>, ops: FormulaOp[]): void => {
  if (element.kind === 'use') {
    const id = element.attributes['xlink:href'].slice(1);
    const path = paths.get(id);
    const matrix = multiply(parentMatrix, parseTransform(element.attributes?.transform));
    if (path !== undefined) ops.push({ kind: 'path', path, matrix });
    return;
  }
  if (element.kind === 'rect') {
    const matrix = multiply(parentMatrix, parseTransform(element.attributes?.transform));
    ops.push({
      kind: 'rect',
      matrix,
      x: parseFloat(element.attributes.x ?? '0'),
      y: parseFloat(element.attributes.y ?? '0'),
      width: parseFloat(element.attributes.width ?? '0'),
      height: parseFloat(element.attributes.height ?? '0'),
    });
    return;
  }
  if (UNDRAWABLE_KINDS.has(element.kind)) return;
  if (!CONTAINER_KINDS.has(element.kind)) {
    throw new MathTypesetError(`Nodo «${element.kind}» inesperado en la salida SVG de MathJax: no se puede dibujar ni recorrer.`);
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

/**
 * MathJax never throws on unparseable LaTeX: it substitutes an `merror` node and carries on. In
 * the liteAdaptor's SVG tree that shows up as a `<g data-mml-node="merror">` carrying the
 * message in a `data-mjx-error` attribute, wrapping a full-width background `<rect>` plus a
 * `<text>` holding the message. Left undetected, that `<rect>` was picked up as ordinary ink —
 * `10\textasciicircum{}(-3)` produced a single 25800×950 rect, i.e. a ~201pt solid black bar at
 * a 7.8pt font size, with no error anywhere. Returns the message so `compute` can fail loudly.
 */
const findTypesetError = (element: LiteElement): string | undefined => {
  const message = element.attributes?.['data-mjx-error'];
  if (message !== undefined) return message;
  for (const child of element.children ?? []) {
    const found = findTypesetError(child);
    if (found !== undefined) return found;
  }
  return undefined;
};

const compute = (latex: string, display: boolean): ParsedFormula => {
  let node: LiteElement;
  try {
    node = html.convert(latex, { display }) as unknown as LiteElement;
  } catch (error) {
    throw new MathTypesetError(`No se pudo tipografiar «${latex}»: ${error instanceof Error ? error.message : String(error)}`);
  }
  const svgNode = node.children.find((child) => child.kind === 'svg');
  if (!svgNode) throw new MathTypesetError(`MathJax no produjo salida SVG para «${latex}».`);

  const parseError = findTypesetError(svgNode);
  if (parseError !== undefined) throw new MathTypesetError(`MathJax no pudo interpretar «${latex}»: ${parseError}`);

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

/**
 * Typesets `latex`, memoised by source.
 *
 * `display` is TeX's own distinction between a formula set inline and one set on its own line:
 * in display style a `\\sum` or an `\\int` carries its limits above and below rather than
 * beside, and a `\\frac` is set at full size. The report's numbered relations are display
 * equations, so they ask for it; a symbol inside a table cell does not. It is part of the cache
 * key because the two styles are genuinely different layouts of the same source.
 */
export const typesetLatex = (latex: string, display = false): ParsedFormula => {
  const key = `${display ? 'D' : 'I'}|${latex}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const parsed = compute(latex, display);
  cache.set(key, parsed);
  return parsed;
};
