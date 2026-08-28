# PDF Formulas via MathJax Vector Embedding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-drawn glyph typesetter in `src/utils/pdf/pdfMath.ts`/`pdfGlyphs.ts` with real math typesetting — MathJax renders each formula to an SVG glyph/path tree, which is embedded into the PDF as true vector paths via `pdf-lib`, all fully offline and client-side.

**Architecture:** A pure `mathLatex.ts` module translates the solver's existing math DSL (Unicode Greek/operators, `^`/`_` scripts, implicit `a/b` fractions, `√(...)` radicals) into LaTeX source. A `mathTypeset.ts` module runs MathJax in headless mode (`liteAdaptor`, no DOM, no canvas) to turn that LaTeX into a parsed, size-independent glyph/path tree, cached by LaTeX string. A `mathVector.ts` module draws that tree into a `pdf-lib` `PDFPage` as real vector paths, using a manually-composed affine transform per glyph (validated below — `pdf-lib`'s `drawSvgPath` cannot take an arbitrary transform on its own). `pdfMath.ts` keeps its exact current exported API (`mathWidth`, `needsMath`, `hasFraction`, `drawMathFormula`, `drawMathBlock`, `drawFormulaCard`) so none of the nine call-site files (`pdfMethodSection.ts`, `pdfAnnexSection.ts`, `pdfCover.ts`, `pdfQuantitySection.ts`, `pdfProcedureSection.ts`, `pdfBuilder.ts`, …) need to change — only its internals are replaced.

**Tech Stack:** `mathjax-full` (new dependency, TeX input + SVG output + `liteAdaptor`, no DOM), `pdf-lib` (already a dependency), TypeScript, Vitest.

**Font decision:** MathJax's bundled default SVG font (Latin Modern-derived, TeX-authentic) — not a Times-matching alternative. `mathjax-termes-font` (a Times-metric clone, the obvious pick to match the report's existing Times body) and `mathjax-stix2-font` were both checked against the npm registry and neither has ever shipped past a `beta` version (`mathjax-termes-font` tops out at `1.0.0-beta.1`, with no published `dependencies`/`peerDependencies` even), which is too immature a dependency for a document engineers sign. The default font ships inside `mathjax-full` itself (zero extra dependency, the version this plan already pins), is what the validated spike in "Validated groundwork" was rendered with, and reads as unambiguously real mathematical typesetting rather than the flat glyph-by-glyph look it replaces — that matters more here than exact family-matching with the Times/Helvetica prose. Revisit only if `mathjax-termes-font` reaches a stable release later.

## Global Constraints

- `src/engine/**` is INTOCABLE — this plan touches nothing under `src/engine/`. `src/engine/solver.ts:1120` is read-only source of one of the fixture expressions (`√(ΔX² + ΔY²)`), never edited.
- No network access at runtime. `mathjax-full` ships as an npm package (already vendored into `node_modules` once installed) and must be bundled, never fetched from a CDN.
- `pdf-lib` and now `mathjax-full` must stay out of the app's entry chunk — both are dynamic-`import()`ed only from `src/utils/calculationPdf.ts`, exactly like `pdf-lib` is today (see `calculationPdf.ts:50`). Verify with `npm run build && node scripts/measure-performance.mjs` after the work lands (Task 7).
- `pdfMath.ts`'s five exports (`mathWidth`, `needsMath`, `hasFraction`, `drawMathFormula`, `drawMathBlock`, `drawFormulaCard`) keep their exact current signatures — nine other files call them directly or via `PdfLayout`.
- `pdfGlyphs.ts`'s `pdfText`/`wrapText` are used by prose rendering across the whole `pdf/` tree (confirmed: `pdfFrontMatter.ts`, `pdfChrome.ts`, `pdfDiagrams.ts`, `pdfCover.ts`, `pdfProcedureSection.ts`, `pdfMethodSection.ts`, `pdfQuantitySection.ts`, `pdfBuilder.ts`) and must be left untouched. `mathText`, `hasScriptGlyph`, `SYMBOL_GLYPHS` have **no** consumers outside `pdfMath.ts`/`pdfGlyphs.ts` themselves (verified by grep) and are fair game to delete.
- `npm run verify` (lint, docs check, protected-baseline check, full test suite, build, perf report, entry-chunk check) must pass before this is considered done.

---

## Validated groundwork (read before Task 1)

This plan's riskiest unknown — "can MathJax output become a correctly-oriented, correctly-positioned vector drawing in `pdf-lib`?" — was spiked and empirically verified (rendered to a real PDF, rasterized with PyMuPDF, visually confirmed) before writing this plan. The results below are given as fact, not hypothesis:

1. **MathJax runs fully headless and synchronously.** `mathjax-full/js/adaptors/liteAdaptor.js` needs no DOM, no canvas, no `Image`. `html.convert(latex, { display: false })` returns a `LiteElement` tree synchronously in both Node and the browser. This means the whole formula pipeline (`translate → typeset → measure → draw`) can stay **synchronous**, exactly matching the existing measure-then-draw pagination pattern in `pdfMethodSection.ts` etc. No async ripple through the nine call-site files is needed.

2. **MathJax's SVG output structure** (`fontCache: 'local'`), confirmed by direct inspection: an outer `<svg viewBox="minX minY width height">` containing a `<defs>` of `<path id="…" d="…">` glyph outlines (in TeX font-design units, 1000 per em) and a `<g transform="scale(1,-1)">` wrapping nested `<g transform="translate(x,y)">`/`<g transform="translate(x,y) scale(s)">` groups that eventually hit `<use xlink:href="#id">` (one per glyph) or `<rect width height x y>` (fraction bars/rules). Only `translate` and uniform `scale` appear — never `rotate` or `skew` — so every node's cumulative transform is representable as `{a, b:0, c:0, d, e, f}`.

3. **`pdf-lib`'s `page.drawSvgPath(d, {x, y, scale, color})` hard-codes `scale(options.scale, -options.scale)` internally** (confirmed by reading `node_modules/pdf-lib/es/api/operations.js`) — it cannot apply an independent transform per axis, which is required here since MathJax's own composed matrix has independent (and possibly differently-signed) `a` and `d`. The fix, verified working: wrap the call in a manually pushed `concatTransformationMatrix`, then call `drawSvgPath(d, { x: 0, y: 0, scale: 1, color })` so the *outer* concat carries the real transform and cancels `drawSvgPath`'s own internal flip. Both `concatTransformationMatrix` (top-level export) and `page.pushOperators` (public method) are available in the installed `pdf-lib` version.

4. **The exact working formula**, for a glyph whose cumulative MathJax matrix (composed depth-first, starting from `<g transform="scale(1,-1)">` at the root, down through every nested `<g>`) is `m = {a, b:0, c:0, d, e, f}`, placed at `(baselineX, baselineY)` in PDF points at `unitScale = fontSizePt / 1000`:

   ```
   sx = m.a * unitScale
   sy = m.d * unitScale
   tx = baselineX + m.e * unitScale
   ty = baselineY - m.f * unitScale        // note the minus sign on f
   page.pushOperators(pushGraphicsState(), concatTransformationMatrix(sx, 0, 0, sy, tx, ty));
   page.drawSvgPath(pathD, { x: 0, y: 0, scale: 1, color });
   page.pushOperators(popGraphicsState());
   ```

   For any other local point `(px, py)` in that same glyph's/rect's local coordinate system (used below for fraction-bar `<rect>` corners, which `drawRectangle` places directly with no `pdf-lib`-side flip to cancel):

   ```
   pdfX(px, py) = baselineX + unitScale * (m.a * px + m.e)
   pdfY(px, py) = baselineY + unitScale * (-m.d * py - m.f)
   ```

5. **Natural box metrics come straight from the outer `<svg>`'s `viewBox="minX minY width height"`**, in the same 1000-units-per-em space as the path data — no unit conversion from MathJax's `ex`-based `width`/`height` attributes is needed. `widthUnits = width`; `heightUnits` (ascent, above baseline) `= -minY`; `depthUnits` (descent, below baseline) `= minY + height`.

6. **The real DSL has a case word-splitting alone cannot handle**: `src/engine/solver.ts:1120` emits `'L = √(ΔX² + ΔY²)'` as a single equation string, and the radical's argument (`ΔX² + ΔY²`) contains a space. `mathLatex.ts`'s translator (Task 2) must scan for `√(` / matching `)` **before** word-splitting, not per-word.

---

### Task 1: `mathTypeset.ts` — headless MathJax singleton and SVG-tree parser

**Files:**
- Create: `src/utils/pdf/mathTypeset.ts`
- Test: `src/utils/pdf/mathTypeset.test.ts`
- Modify: `package.json` (add `mathjax-full` dependency)

**Interfaces:**
- Produces: `export interface AffineMatrix { a: number; b: number; c: number; d: number; e: number; f: number }`
- Produces: `export type FormulaOp = { kind: 'path'; path: string; matrix: AffineMatrix } | { kind: 'rect'; matrix: AffineMatrix; x: number; y: number; width: number; height: number }`
- Produces: `export interface ParsedFormula { ops: FormulaOp[]; widthUnits: number; heightUnits: number; depthUnits: number }`
- Produces: `export const typesetLatex = (latex: string): ParsedFormula` — pure, synchronous, memoized by `latex`. Throws `MathTypesetError` (exported) on a LaTeX string MathJax cannot parse.

- [ ] **Step 1: Add the dependency**

```bash
npm install mathjax-full
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/utils/pdf/mathTypeset.test.ts
import { describe, expect, it } from 'vitest';
import { typesetLatex } from './mathTypeset';

describe('typesetLatex', () => {
  it('parses a simple relation into glyph paths with a positive natural width', () => {
    const formula = typesetLatex('M(x) = 12.5x^{2}');
    expect(formula.ops.length).toBeGreaterThan(0);
    expect(formula.ops.every((op) => op.kind === 'path')).toBe(true);
    expect(formula.widthUnits).toBeGreaterThan(0);
    expect(formula.heightUnits).toBeGreaterThan(0);
  });

  it('emits a rect op for a fraction bar', () => {
    const formula = typesetLatex('\\frac{d\\theta}{dx}');
    expect(formula.ops.some((op) => op.kind === 'rect')).toBe(true);
  });

  it('caches by latex string: same input returns the same parsed object', () => {
    const first = typesetLatex('\\Sigma F_{x}');
    const second = typesetLatex('\\Sigma F_{x}');
    expect(first).toBe(second);
  });

  it('every path op carries a d attribute and a matrix with no rotation/skew', () => {
    const formula = typesetLatex('\\le \\Sigma \\sqrt{2}');
    for (const op of formula.ops) {
      expect(op.matrix.b).toBe(0);
      expect(op.matrix.c).toBe(0);
      if (op.kind === 'path') expect(op.path.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/utils/pdf/mathTypeset.test.ts`
Expected: FAIL — `mathTypeset.ts` does not exist yet.

- [ ] **Step 4: Write the implementation**

```typescript
// src/utils/pdf/mathTypeset.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/utils/pdf/mathTypeset.test.ts`
Expected: PASS (all four cases)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/utils/pdf/mathTypeset.ts src/utils/pdf/mathTypeset.test.ts
git commit -m "feat(pdf): add headless MathJax SVG typesetting for formulas"
```

---

### Task 2: `mathLatex.ts` — solver DSL → LaTeX translator

**Files:**
- Create: `src/utils/pdf/mathLatex.ts`
- Test: `src/utils/pdf/mathLatex.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (pure string transform, no MathJax dependency — keeps this module cheap to statically import everywhere `pdfMath.ts` needs it).
- Produces: `export const translateExpression = (expression: string): string` — full-expression DSL → LaTeX, radical-aware.
- Produces: `export const atomize = (expression: string): string[]` — splits an expression into line-wrap units: plain space-delimited words, except a whole `√(...)` span (which may itself contain spaces) is kept as a single atom. `pdfMath.ts`'s line packer (Task 4) uses this instead of a bare `.split(' ')`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/pdf/mathLatex.test.ts
import { describe, expect, it } from 'vitest';
import { atomize, translateExpression } from './mathLatex';

describe('translateExpression', () => {
  it('passes plain relations through unchanged', () => {
    expect(translateExpression('M(x) = 12.5x^2 - 3.2x + 1')).toBe('M(x) = 12.5x^{2} - 3.2x + 1');
  });

  it('maps Greek letters and operators to their LaTeX commands', () => {
    expect(translateExpression('ΔX ≤ Σ λ ± ∂ω')).toBe('\\Delta X \\le \\Sigma \\lambda \\pm \\partial \\omega');
  });

  it('stacks an implicit a/b word as \\frac, leaving a spaced division alone', () => {
    expect(translateExpression('dθ/dx = M/EI')).toBe('\\frac{d\\theta}{dx} = \\frac{M}{EI}');
    expect(translateExpression('||r|| / max(1, ||F||)')).toBe('||r|| / max(1, ||F||)');
  });

  it('wraps a radical whose argument spans a space, matching the engine\'s own equation', () => {
    expect(translateExpression('L = √(ΔX² + ΔY²)')).toBe('L = \\sqrt{\\Delta X^{2} + \\Delta Y^{2}}');
  });

  it('lowers a full alphanumeric run after ^/_, not just the first character', () => {
    expect(translateExpression('d_local')).toBe('d_{local}');
    expect(translateExpression('N_theta^T')).toBe('N_{theta}^{T}');
  });

  it('leaves a caret with nothing alphanumeric after it as a literal', () => {
    expect(translateExpression('10^(-3)')).toBe('10\\textasciicircum{}(-3)');
  });
});

describe('atomize', () => {
  it('splits on spaces outside any radical', () => {
    expect(atomize('M(x) = 12.5x^2')).toEqual(['M(x)', '=', '12.5x^2']);
  });

  it('keeps a radical whose argument spans a space as one atom', () => {
    expect(atomize('L = √(ΔX² + ΔY²)')).toEqual(['L', '=', '√(ΔX² + ΔY²)']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/pdf/mathLatex.test.ts`
Expected: FAIL — `mathLatex.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/pdf/mathLatex.ts
/**
 * Translates the solver's own math notation — literal Unicode Greek/operators, `^`/`_` markers
 * for scripts, an implicit `a/b` word for a fraction, `√(...)` for a radical — into LaTeX source
 * MathJax can typeset. This is the one place that mapping lives: everything downstream draws
 * whatever MathJax lays out, so unlike the old `pdfGlyphs.ts` there is no per-glyph font choice
 * to get right here, only vocabulary.
 */

const SYMBOLS: ReadonlyMap<string, string> = new Map([
  ['α', '\\alpha'], ['β', '\\beta'], ['γ', '\\gamma'], ['Γ', '\\Gamma'], ['δ', '\\delta'], ['Δ', '\\Delta'],
  ['ε', '\\varepsilon'], ['ζ', '\\zeta'], ['η', '\\eta'], ['θ', '\\theta'], ['Θ', '\\Theta'], ['ϑ', '\\vartheta'],
  ['κ', '\\kappa'], ['λ', '\\lambda'], ['Λ', '\\Lambda'], ['μ', '\\mu'], ['ν', '\\nu'], ['ξ', '\\xi'], ['Ξ', '\\Xi'],
  ['π', '\\pi'], ['Π', '\\Pi'], ['ρ', '\\rho'], ['σ', '\\sigma'], ['ς', '\\varsigma'], ['Σ', '\\Sigma'], ['τ', '\\tau'],
  ['φ', '\\varphi'], ['Φ', '\\Phi'], ['ϕ', '\\phi'], ['χ', '\\chi'], ['ψ', '\\psi'], ['Ψ', '\\Psi'], ['ω', '\\omega'], ['Ω', '\\Omega'],
  ['∫', '\\int'], ['∑', '\\sum'], ['∏', '\\prod'], ['∂', '\\partial'], ['∇', '\\nabla'], ['∞', '\\infty'],
  ['∝', '\\propto'], ['∠', '\\angle'], ['∴', '\\therefore'], ['≈', '\\approx'], ['≡', '\\equiv'], ['∼', '\\sim'],
  ['≤', '\\le'], ['≥', '\\ge'], ['≠', '\\ne'], ['±', '\\pm'], ['×', '\\times'], ['÷', '\\div'], ['−', '-'],
  ['⋅', '\\cdot'], ['·', '\\cdot'], ['→', '\\rightarrow'], ['←', '\\leftarrow'], ['↑', '\\uparrow'], ['↓', '\\downarrow'],
  ['↔', '\\leftrightarrow'], ['⇒', '\\Rightarrow'], ['⇐', '\\Leftarrow'], ['⊗', '\\otimes'], ['⊕', '\\oplus'],
  ['∈', '\\in'], ['∉', '\\notin'], ['∅', '\\varnothing'], ['⊂', '\\subset'], ['⊃', '\\supset'], ['∩', '\\cap'],
  ['∪', '\\cup'], ['∀', '\\forall'], ['∃', '\\exists'], ['¬', '\\neg'], ['∧', '\\wedge'], ['∨', '\\vee'],
  ['′', "'"], ['″', "''"], ['ƒ', 'f'], ['°', '^\\circ'], ['∥', '\\parallel'], ['⟨', '\\langle'], ['⟩', '\\rangle'],
]);

/** LaTeX's own reserved characters, escaped when they reach the output as literal text. */
const escapeLiteral = (character: string): string => {
  if (character === '\\') return '\\textbackslash{}';
  if (character === '~') return '\\textasciitilde{}';
  if (character === '^') return '\\textasciicircum{}';
  if ('#$%&{}'.includes(character)) return `\\${character}`;
  return character;
};

const translateChar = (character: string): string => SYMBOLS.get(character) ?? escapeLiteral(character);

/** Splits a run into baseline text and its `^`/`_` scripts — mirrors the old `pdfMath.ts` segmenter. */
const segments = (source: string): Array<{ text: string; level: 'base' | 'super' | 'sub' }> => {
  const parts: Array<{ text: string; level: 'base' | 'super' | 'sub' }> = [];
  let base = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '^' || character === '_') {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9]/.test(source[end])) end += 1;
      if (end > index + 1) {
        if (base) parts.push({ text: base, level: 'base' });
        base = '';
        parts.push({ text: source.slice(index + 1, end), level: character === '^' ? 'super' : 'sub' });
        index = end - 1;
        continue;
      }
    }
    base += character;
  }
  if (base) parts.push({ text: base, level: 'base' });
  return parts;
};

const translateRun = (text: string): string =>
  segments(text)
    .map((segment) => {
      const body = Array.from(segment.text).map(translateChar).join('');
      if (segment.level === 'super') return `^{${body}}`;
      if (segment.level === 'sub') return `_{${body}}`;
      return body;
    })
    .join('');

/** A word is an implicit fraction when it holds exactly one `/` between two non-empty, bracket-free operands. */
const asFraction = (word: string): { numerator: string; denominator: string } | undefined => {
  const parts = word.split('/');
  if (parts.length !== 2) return undefined;
  const [numerator, denominator] = parts;
  if (!numerator || !denominator) return undefined;
  if (/[()[\]]/.test(word)) return undefined;
  return { numerator, denominator };
};

const translateWord = (word: string): string => {
  const fraction = asFraction(word);
  if (fraction) return `\\frac{${translateRun(fraction.numerator)}}{${translateRun(fraction.denominator)}}`;
  return translateRun(word);
};

/** Index just past the `)` matching the `(` at `openIndex`, or -1 if the expression never closes it. */
const matchParen = (expression: string, openIndex: number): number => {
  let depth = 0;
  for (let index = openIndex; index < expression.length; index += 1) {
    if (expression[index] === '(') depth += 1;
    else if (expression[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const translateRunOfWords = (run: string): string => run.split(' ').filter((word) => word.length > 0).map(translateWord).join(' ');

export const translateExpression = (expression: string): string => {
  let result = '';
  let index = 0;
  while (index < expression.length) {
    if (expression[index] === '√' && expression[index + 1] === '(') {
      const close = matchParen(expression, index + 1);
      if (close !== -1) {
        const inner = expression.slice(index + 2, close);
        result += `\\sqrt{${translateExpression(inner)}}`;
        index = close + 1;
        continue;
      }
    }
    let next = expression.indexOf('√(', index);
    if (next === -1) next = expression.length;
    result += translateRunOfWords(expression.slice(index, next));
    index = next;
  }
  return result;
};

/** Line-wrap units for `pdfMath.ts`'s packer: plain words, except a whole `√(...)` span stays atomic. */
export const atomize = (expression: string): string[] => {
  const atoms: string[] = [];
  let index = 0;
  while (index < expression.length) {
    if (expression[index] === '√' && expression[index + 1] === '(') {
      const close = matchParen(expression, index + 1);
      if (close !== -1) {
        atoms.push(expression.slice(index, close + 1));
        index = close + 1;
        continue;
      }
    }
    let next = expression.indexOf('√(', index);
    if (next === -1) next = expression.length;
    atoms.push(...expression.slice(index, next).split(' ').filter((word) => word.length > 0));
    index = next;
  }
  return atoms;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/pdf/mathLatex.test.ts`
Expected: PASS. If the Greek/operator mapping test disagrees with the actual MathJax command names (e.g. a package boundary), fix the `SYMBOLS` table entry, not the test's intent.

- [ ] **Step 5: Commit**

```bash
git add src/utils/pdf/mathLatex.ts src/utils/pdf/mathLatex.test.ts
git commit -m "feat(pdf): translate the solver's math DSL into LaTeX"
```

---

### Task 3: `mathVector.ts` — draw a parsed formula into a `PDFPage`

**Files:**
- Create: `src/utils/pdf/mathVector.ts`
- Test: `src/utils/pdf/mathVector.test.ts`

**Interfaces:**
- Consumes: `ParsedFormula`, `FormulaOp`, `AffineMatrix` from `./mathTypeset`.
- Produces: `export interface FormulaBox { widthPt: number; heightPt: number; depthPt: number }`
- Produces: `export const measureFormula = (parsed: ParsedFormula, fontSizePt: number): FormulaBox`
- Produces: `export const drawFormula = (page: PDFPage, parsed: ParsedFormula, x: number, baseline: number, fontSizePt: number, color: PdfColor) => number` — draws, returns `widthPt` consumed (matches the return convention `drawMathFormula`/`drawWord` already use in `pdfMath.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/pdf/mathVector.test.ts
import { describe, expect, it } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import { typesetLatex } from './mathTypeset';
import { drawFormula, measureFormula } from './mathVector';

describe('measureFormula', () => {
  it('scales the parsed formula\'s natural box linearly with font size', () => {
    const parsed = typesetLatex('M(x)');
    const small = measureFormula(parsed, 10);
    const large = measureFormula(parsed, 20);
    expect(large.widthPt).toBeCloseTo(small.widthPt * 2, 5);
    expect(large.heightPt).toBeCloseTo(small.heightPt * 2, 5);
  });
});

describe('drawFormula', () => {
  it('draws without throwing and returns a positive consumed width', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 200]);
    const parsed = typesetLatex('M(x) = \\frac{d\\theta}{dx} \\le \\Sigma F_{x}^{2}');
    const width = drawFormula(page, parsed, 40, 100, 11, rgb(0, 0, 0));
    expect(width).toBeGreaterThan(0);
    expect(width).toBeCloseTo(measureFormula(parsed, 11).widthPt, 5);
  });

  it('emits one filled path per glyph op and one rectangle per fraction bar', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 200]);
    const parsed = typesetLatex('\\frac{a}{b}');
    drawFormula(page, parsed, 40, 100, 11, rgb(0, 0, 0));
    const contentStream = page.node.normalizedEntries().Contents;
    expect(contentStream).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/pdf/mathVector.test.ts`
Expected: FAIL — `mathVector.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/pdf/mathVector.ts
/**
 * Draws a `ParsedFormula` (see `mathTypeset.ts`) into a `pdf-lib` page as real vector paths.
 *
 * `pdf-lib`'s `drawSvgPath(d, {x,y,scale})` hard-codes an internal `scale(s,-s)`, so it cannot
 * take an independent transform per axis on its own. Every glyph here is drawn by concatenating
 * the formula's own composed matrix as an *outer* transform (via `pushOperators` +
 * `concatTransformationMatrix`) and then calling `drawSvgPath` with the identity — the outer
 * concat supplies the real placement, and `drawSvgPath`'s own flip is folded into that
 * derivation rather than fought after the fact. See the plan this module was built from
 * (`docs/superpowers/plans/2026-08-28-pdf-formulas-mathjax-vector.md`) for the worked-through
 * derivation and the rendered proof it was checked against.
 */
import type { PDFPage } from 'pdf-lib';
import { concatTransformationMatrix } from 'pdf-lib';
import { popGraphicsState, pushGraphicsState } from 'pdf-lib/cjs/api/operators.js';
import type { AffineMatrix, FormulaOp, ParsedFormula } from './mathTypeset';
import type { PdfColor } from './reportContext';

export interface FormulaBox {
  widthPt: number;
  heightPt: number;
  depthPt: number;
}

export const measureFormula = (parsed: ParsedFormula, fontSizePt: number): FormulaBox => {
  const unitScale = fontSizePt / 1000;
  return {
    widthPt: parsed.widthUnits * unitScale,
    heightPt: parsed.heightUnits * unitScale,
    depthPt: parsed.depthUnits * unitScale,
  };
};

const pdfPoint = (matrix: AffineMatrix, localX: number, localY: number, unitScale: number, baselineX: number, baselineY: number) => ({
  x: baselineX + unitScale * (matrix.a * localX + matrix.e),
  y: baselineY + unitScale * (-matrix.d * localY - matrix.f),
});

const drawPathOp = (
  page: PDFPage,
  op: Extract<FormulaOp, { kind: 'path' }>,
  unitScale: number,
  baselineX: number,
  baselineY: number,
  color: PdfColor,
): void => {
  const sx = op.matrix.a * unitScale;
  const sy = op.matrix.d * unitScale;
  const tx = baselineX + op.matrix.e * unitScale;
  const ty = baselineY - op.matrix.f * unitScale;
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(sx, 0, 0, sy, tx, ty));
  page.drawSvgPath(op.path, { x: 0, y: 0, scale: 1, color });
  page.pushOperators(popGraphicsState());
};

const drawRectOp = (
  page: PDFPage,
  op: Extract<FormulaOp, { kind: 'rect' }>,
  unitScale: number,
  baselineX: number,
  baselineY: number,
  color: PdfColor,
): void => {
  const corner1 = pdfPoint(op.matrix, op.x, op.y, unitScale, baselineX, baselineY);
  const corner2 = pdfPoint(op.matrix, op.x + op.width, op.y + op.height, unitScale, baselineX, baselineY);
  page.drawRectangle({
    x: Math.min(corner1.x, corner2.x),
    y: Math.min(corner1.y, corner2.y),
    width: Math.abs(corner2.x - corner1.x),
    height: Math.abs(corner2.y - corner1.y),
    color,
  });
};

/** Draws `parsed` with its baseline at `(x, baseline)` and returns the width consumed, in points. */
export const drawFormula = (
  page: PDFPage,
  parsed: ParsedFormula,
  x: number,
  baseline: number,
  fontSizePt: number,
  color: PdfColor,
): number => {
  const unitScale = fontSizePt / 1000;
  for (const op of parsed.ops) {
    if (op.kind === 'path') drawPathOp(page, op, unitScale, x, baseline, color);
    else drawRectOp(page, op, unitScale, x, baseline, color);
  }
  return parsed.widthUnits * unitScale;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/pdf/mathVector.test.ts`
Expected: PASS. If `pdf-lib/cjs/api/operators.js` is not resolvable as a deep import from this Vite/TS setup, fall back to importing `pushGraphicsState`/`popGraphicsState` from `pdf-lib/es/api/operators.js` (both ship in the package; match whichever specifier the project's other deep `pdf-lib` usage, if any, already uses — there is none today, so pick `cjs` first since that's what the Task-1 spike validated against, and switch only if the build step complains).

- [ ] **Step 5: Commit**

```bash
git add src/utils/pdf/mathVector.ts src/utils/pdf/mathVector.test.ts
git commit -m "feat(pdf): draw typeset formulas into pdf-lib as vector paths"
```

---

### Task 4: Rewire `pdfMath.ts`, `PdfLayout`, and `calculationPdf.ts`

**Files:**
- Modify: `src/utils/pdf/pdfMath.ts` (full rewrite of internals; same exports)
- Modify: `src/utils/pdf/pdfBuilder.ts:67-` (`PdfLayout` class — no new constructor param needed, since `mathLatex.ts`/`mathTypeset.ts`/`mathVector.ts` are statically imported like today's `pdfGlyphs.ts`; only `pdf-lib`'s own JS needs to stay dynamic, and it already does)
- Modify: `src/utils/pdf/pdfMath.test.ts` (replace pixel-drawing assumptions with the new contract)

**Interfaces:**
- Consumes: `translateExpression`, `atomize` from `./mathLatex`; `typesetLatex` from `./mathTypeset`; `measureFormula`, `drawFormula` from `./mathVector`.
- Produces: unchanged — `mathWidth`, `needsMath`, `hasFraction`, `drawMathFormula`, `drawMathBlock`, `drawFormulaCard`, all with their exact current signatures from `pdfMath.ts` today.

Why no new dynamic-import boundary is needed here even though `mathjax-full` is a real dependency: `mathTypeset.ts` imports `mathjax-full` statically, and `pdfMath.ts` imports `mathTypeset.ts` statically — but `pdfMath.ts` itself is only ever reached through `calculationPdf.ts`, and `calculationPdf.ts:14` already does `import { PdfLayout } from './pdf/pdfBuilder'` **statically** today, with `pdfBuilder.ts` in turn statically importing `pdfMath.ts`. Check `calculationPdf.ts` once more before assuming this is fine:

- [ ] **Step 1: Confirm `pdf-lib`'s dynamic-import boundary is what actually keeps things lazy, not any particular file's import graph**

Read `src/utils/calculationPdf.ts:1-31` again: `PdfLayout`, `drawExecutivePage`, etc. are all statically imported at the top of `calculationPdf.ts` *already*, i.e. that whole `pdf/` subtree (including today's `pdfMath.ts`/`pdfGlyphs.ts`) is already one static module graph. What keeps `pdf-lib` itself out of the entry chunk is that `calculationPdf.ts` is a module Vite can chunk independently — nothing imports `calculationPdf.ts` eagerly from the app's entry point (verify: `grep -rn "from.*calculationPdf'" src --include='*.tsx' --include='*.ts' | grep -v test`; every hit should be inside a lazy code path, e.g. an event handler or a dynamically-imported feature module). Since `mathjax-full` only enters the graph via `pdfMath.ts` → `mathTypeset.ts`, and that whole subtree is already downstream of `calculationPdf.ts`, it inherits the same laziness for free — no new `import()` boundary is needed. **Confirm this explicitly** by running Task 7's bundle check after Task 6, not by assuming it here.

- [ ] **Step 2: Rewrite `pdfMath.ts`**

```typescript
// src/utils/pdf/pdfMath.ts
/**
 * Fórmula typesetting over MathJax's SVG output.
 *
 * The solver's math DSL (`mathLatex.ts`) becomes LaTeX, MathJax lays it out headlessly
 * (`mathTypeset.ts`), and the result is drawn as real vector paths (`mathVector.ts`). This
 * module is now just the seam: it turns a DSL expression and a font size into a width or a
 * drawn box, exactly as it always has, so none of its nine call sites needed to change.
 */
import { atomize, translateExpression } from './mathLatex';
import { typesetLatex } from './mathTypeset';
import { drawFormula, measureFormula } from './mathVector';
import { pdfText } from './pdfGlyphs';
import type { PdfLayout } from './pdfBuilder';
import type { PdfColor } from './reportContext';

/** True when the text carries something plain WinAnsi prose can't spell out: Greek, operators, scripts. */
export const needsMath = (value: string): boolean => translateExpression(value) !== pdfText(value);

/** True when the expression will stack something above and below its baseline. */
export const hasFraction = (expression: string): boolean => /\\frac\{/.test(translateExpression(expression));

export const mathWidth = (layout: PdfLayout, expression: string, size: number): number => {
  const parsed = typesetLatex(translateExpression(expression));
  return measureFormula(parsed, size).widthPt;
};

/** Draws the expression on one line at `x`/`baseline` and returns the width it consumed. */
export const drawMathFormula = (
  layout: PdfLayout,
  expression: string,
  x: number,
  baseline: number,
  requestedSize: number,
  color: PdfColor,
  maxFormulaWidth = Number.POSITIVE_INFINITY,
): number => {
  const parsed = typesetLatex(translateExpression(expression));
  let size = requestedSize;
  while (size > 7.5 && measureFormula(parsed, size).widthPt > maxFormulaWidth) size -= 0.4;
  return drawFormula(layout.page, parsed, x, baseline, size, color);
};

export interface MathBlockOptions {
  /** Extra left offset applied to every line after the first. */
  continuationIndent?: number;
  /** Right-aligned tag, typically an equation number such as `(4)`. */
  tag?: string;
}

const atomWidth = (size: number, atom: string): number => measureFormula(typesetLatex(translateExpression(atom)), size).widthPt;

/**
 * Draws a relation across as many lines as it needs, starting at `top` and growing downward.
 * Returns the height consumed so the caller can advance its own cursor.
 *
 * Packs at atom boundaries (`mathLatex.ts`'s `atomize`, not a bare space split) so a `√(...)`
 * whose argument spans a space never gets its radical bar cut across a line break. Each packed
 * line is re-typeset as one LaTeX string at draw time, so inter-symbol spacing within a line
 * comes from MathJax's own spacing rules rather than a fixed-width space glyph.
 */
export const drawMathBlock = (
  layout: PdfLayout,
  expression: string,
  x: number,
  top: number,
  width: number,
  size: number,
  color: PdfColor,
  options: MathBlockOptions = {},
): number => {
  const atoms = atomize(expression);
  if (!atoms.length) return 0;
  const indent = options.continuationIndent ?? size * 1.6;
  const spaceWidth = atomWidth(size, 'x') * 0.35;

  const lines: string[][] = [];
  let current: string[] = [];
  let currentWidth = 0;
  for (const atom of atoms) {
    const available = width - (lines.length === 0 ? 0 : indent);
    const advance = (current.length ? spaceWidth : 0) + atomWidth(size, atom);
    if (current.length && currentWidth + advance > available) {
      lines.push(current);
      current = [atom];
      currentWidth = atomWidth(size, atom);
      continue;
    }
    current.push(atom);
    currentWidth += advance;
  }
  if (current.length) lines.push(current);

  let consumed = 0;
  for (const [index, line] of lines.entries()) {
    const lineExpression = line.join(' ');
    const parsed = typesetLatex(translateExpression(lineExpression));
    const box = measureFormula(parsed, size);
    const stacked = hasFraction(lineExpression);
    const lineHeight = size * (stacked ? 2.05 : 1.45);
    const baseline = top - consumed - Math.max(size, box.heightPt);
    const cursor = x + (index === 0 ? 0 : indent);
    drawFormula(layout.page, parsed, cursor, baseline, size, color);
    if (options.tag && index === lines.length - 1) {
      const tag = pdfText(options.tag);
      const tagWidth = layout.fonts.mathRegular.widthOfTextAtSize(tag, size * 0.9);
      layout.page.drawText(tag, {
        x: x + width - tagWidth,
        y: baseline,
        size: size * 0.9,
        font: layout.fonts.mathRegular,
        color,
      });
    }
    consumed += lineHeight;
  }
  return consumed;
};

/** Titled card holding one governing relation and its plain-language reading. */
export const drawFormulaCard = (
  layout: PdfLayout,
  label: string,
  expression: string,
  explanation: string,
  x: number,
  bottom: number,
  width: number,
  color: PdfColor,
): void => {
  const { page, rgb, fonts } = layout;
  page.drawRectangle({ x, y: bottom, width, height: 54, color: rgb(0.975, 0.985, 0.98), borderColor: color, borderWidth: 0.65 });
  page.drawText(pdfText(label.toUpperCase()), { x: x + 10, y: bottom + 39, size: 6.3, font: fonts.bold, color });
  drawMathFormula(layout, expression, x + 10, bottom + 21, 11.2, rgb(0.10, 0.15, 0.12), width - 20);
  page.drawText(pdfText(explanation), { x: x + 10, y: bottom + 7, size: 6.2, font: fonts.regular, color: rgb(0.37, 0.43, 0.39) });
};
```

Note the removed pieces relative to the current file: `faceFor`, `SCRIPT_SCALE`, `textWidth`, `runWidth`, `drawRun`, `FRACTION_SCALE`, `wordWidth`, `drawWord`, `words` — all superseded by MathJax's own layout. `layout.fonts.mathSymbol`/`mathItalic` are no longer read by this file (still fine to keep embedding them in `calculationPdf.ts` for now; see Task 5 for whether anything else still needs them).

- [ ] **Step 3: Replace `pdfMath.test.ts`**

The old suite asserted on hand-rolled glyph/fraction/wrapping internals that no longer exist. Replace it with a contract-level suite (mirrors the "no lanza" spirit of the one existing case, extended to check real geometry):

```typescript
// src/utils/pdf/pdfMath.test.ts
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PdfLayout } from './pdfBuilder';
import { drawFormulaCard, drawMathBlock, drawMathFormula, hasFraction, mathWidth, needsMath } from './pdfMath';

const INK = rgb(0.1, 0.1, 0.1);

const layout = async () => {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    mathRegular: await pdf.embedFont(StandardFonts.TimesRoman),
    mathItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    mathSymbol: await pdf.embedFont(StandardFonts.Symbol),
  };
  return new PdfLayout(pdf, fonts, { forest: rgb(0, 0, 0) } as never, rgb);
};

describe('needsMath', () => {
  it('is true for an expression carrying Greek or operators', () => {
    expect(needsMath('ΔX = Xⱼ − Xᵢ')).toBe(true);
  });
  it('is false for plain prose', () => {
    expect(needsMath('Resultado del paso 3')).toBe(false);
  });
});

describe('hasFraction', () => {
  it('is true for an implicit-slash word', () => {
    expect(hasFraction('dθ/dx = M/EI')).toBe(true);
  });
  it('is false when the slash sits inside a bracketed expression', () => {
    expect(hasFraction('||r|| / max(1, ||F||)')).toBe(false);
  });
});

describe('mathWidth / drawMathFormula', () => {
  it('grows with font size and matches what gets drawn', async () => {
    const page = await layout();
    const small = mathWidth(page, 'M(x) = 12.5x^2', 8);
    const large = mathWidth(page, 'M(x) = 12.5x^2', 16);
    expect(large).toBeGreaterThan(small);
    const drawn = drawMathFormula(page, 'M(x) = 12.5x^2', 40, 100, 11, INK);
    expect(drawn).toBeCloseTo(mathWidth(page, 'M(x) = 12.5x^2', 11), 3);
  });

  it('shrinks to fit a maxFormulaWidth rather than overflowing it', async () => {
    const page = await layout();
    const drawn = drawMathFormula(page, 'M(x) = 12.5x^2 - 3.2x + 1', 40, 100, 20, INK, 60);
    expect(drawn).toBeLessThanOrEqual(60.01);
  });
});

describe('drawMathBlock', () => {
  it('does not throw on Greek, radicals and operators, radical argument included', async () => {
    const page = await layout();
    expect(() => drawMathBlock(page, 'L = √(ΔX² + ΔY²) ≤ Σ λ ± ∂ω', 50, 700, 400, 9, INK)).not.toThrow();
  });

  it('wraps a long relation onto more than one line inside a narrow column', async () => {
    const page = await layout();
    const consumed = drawMathBlock(
      page,
      'M(x) = 12.5x^2 - 3.2x + 1 + Σ F_x - Δθ/dx + κ_1 λ_2 ± ε',
      50, 700, 120, 9, INK,
    );
    // One line at this size/width would be far shorter than two lines' worth of height.
    expect(consumed).toBeGreaterThan(9 * 1.45 * 1.5);
  });

  it('keeps a radical argument that spans a space on one line, unsplit', async () => {
    const page = await layout();
    // A width that comfortably fits "L = √(ΔX² + ΔY²)" as one atom but would have split
    // a naive space-based packer between "√(ΔX²" and "+".
    expect(() => drawMathBlock(page, 'L = √(ΔX² + ΔY²)', 50, 700, 200, 9, INK)).not.toThrow();
  });
});

describe('drawFormulaCard', () => {
  it('draws without throwing', async () => {
    const page = await layout();
    expect(() => drawFormulaCard(page, 'Cortante', 'V = ΔM/Δx', 'Cambio de momento por unidad de longitud.', 40, 600, 200, INK)).not.toThrow();
  });
});
```

- [ ] **Step 4: Run the full pdf test slice**

Run: `npx vitest run src/utils/pdf`
Expected: PASS. If `mathWidth`/`drawMathFormula` disagree (drawn width not close to measured width), the bug is almost always the `size` the shrink-loop settled on vs. the `size` passed to `drawFormula` — re-read Task 4 Step 2's `drawMathFormula` and confirm both use the *same* `size` variable after the `while` loop.

- [ ] **Step 5: Run the whole suite once, to catch any other file that snapshotted old formula geometry**

Run: `npx vitest run`
Expected: PASS. `calculationPdf.test.ts` and `calculationPdfEditorial.test.ts` (seen earlier to reference `√(ΔX² + ΔY²)` in comments) extract *text*, not pixels, via `pdfjs-dist`, so they should be unaffected — but MathJax's vector paths carry **no text content**, meaning any assertion in those two files that matches formula text via `getTextContent()` will now find nothing where a formula used to be. If either fails this way, that is Task 4's real finding, not a bug: those assertions were relying on formulas being real PDF text, which they no longer are. Read the failing assertion, confirm it's checking prose *around* a formula (still text) rather than the formula's own characters, and adjust the assertion to check the label/explanation text instead. If an assertion truly needs the formula's own characters (e.g. checking a specific equation number tag drawn via `pdfText`, which still is real text), leave it — those still pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/pdf/pdfMath.ts src/utils/pdf/pdfMath.test.ts
git commit -m "feat(pdf): rewire formula drawing through MathJax vector typesetting"
```

---

### Task 5: Retire the dead glyph-drawing exports in `pdfGlyphs.ts`

**Files:**
- Modify: `src/utils/pdf/pdfGlyphs.ts`
- Modify: `src/utils/pdf/pdfGlyphs.test.ts`

**Interfaces:**
- Produces: unchanged `pdfText`, `wrapText` (still used across the `pdf/` tree — do not touch their behavior).
- Removes: `SYMBOL_GLYPHS`, `mathText`, `hasScriptGlyph` (confirmed zero consumers outside `pdfMath.ts`/`pdfGlyphs.ts` in the Global Constraints grep — re-run that grep once more here before deleting, since Tasks 1-4 may have added a new reference by accident).

- [ ] **Step 1: Re-confirm no one else reaches for the exports being removed**

Run:
```bash
grep -rn "SYMBOL_GLYPHS\|mathText\|hasScriptGlyph" src --include="*.ts" --include="*.tsx" | grep -v "pdf/pdfGlyphs.ts\|pdf/pdfGlyphs.test.ts"
```
Expected: no output. If anything shows up, stop and re-check whether Task 4's rewrite still needs it (it shouldn't) before proceeding.

- [ ] **Step 2: Remove the dead exports and their now-unused `SCRIPT_GLYPHS`/`PDF_GLYPHS` entries that existed only to feed them**

`SCRIPT_GLYPHS` and `PDF_GLYPHS` still back `pdfText`/`wrapText` (prose transliteration) — keep both maps as-is. Only delete the `SYMBOL_GLYPHS` set, the `mathText` function, and the `hasScriptGlyph` function, plus the file-header docstring paragraphs that describe them (the "Both share the script table" paragraph and the `mathText`-specific parts of the top comment). Leave `pdfText`, `transliterate`, `isWinAnsi`, `wrapText`, `PDF_GLYPHS`, `SCRIPT_GLYPHS` untouched.

- [ ] **Step 3: Update `pdfGlyphs.test.ts`**

Remove the `describe('mathText', …)` block (the export is gone). Keep every `pdfText`/`wrapText` test as-is — they cover a still-live contract.

- [ ] **Step 4: Run the test slice**

Run: `npx vitest run src/utils/pdf/pdfGlyphs.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck the whole project**

Run: `npm run typecheck`
Expected: PASS — this is the step that actually proves nothing else referenced the removed exports; the grep in Step 1 is a fast pre-check, not a substitute.

- [ ] **Step 6: Commit**

```bash
git add src/utils/pdf/pdfGlyphs.ts src/utils/pdf/pdfGlyphs.test.ts
git commit -m "chore(pdf): drop the hand-rolled math glyph tables superseded by MathJax"
```

---

### Task 6: Trim the MathJax package set and verify the bundle stays lazy

**Files:**
- Modify: `src/utils/pdf/mathTypeset.ts` (swap `AllPackages` for a named list)

**Interfaces:** unchanged — this task only changes which LaTeX macros are available, verified against every fixture already in `mathLatex.test.ts` and every real solver equation.

- [ ] **Step 1: Collect every LaTeX macro the translator can currently emit**

Run `npx vitest run src/utils/pdf/mathLatex.test.ts src/utils/pdf/mathTypeset.test.ts src/utils/pdf/pdfMath.test.ts` once with `AllPackages` (Task 1-4's baseline) to confirm the green baseline, then grep the `SYMBOLS` table in `mathLatex.ts` for every `\command` it can produce (`\alpha`, `\Delta`, `\frac`, `\sqrt`, `\le`, `\Sigma`, `\therefore`, `\varnothing`, `\parallel`, `\langle`, `\rangle`, …).

- [ ] **Step 2: Swap `AllPackages` for `['base', 'ams']`**

```typescript
// in mathTypeset.ts, replace:
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
// ...
const tex = new TeX({ packages: AllPackages });

// with:
const tex = new TeX({ packages: ['base', 'ams'] });
```

Delete the now-unused `AllPackages` import.

- [ ] **Step 3: Run the full formula test slice again**

Run: `npx vitest run src/utils/pdf/mathLatex.test.ts src/utils/pdf/mathTypeset.test.ts src/utils/pdf/mathVector.test.ts src/utils/pdf/pdfMath.test.ts`
Expected: PASS, unchanged from Step 1's baseline. If a `MathTypesetError` appears for an "undefined control sequence" (e.g. `\varnothing`, `\therefore`, `\propto` if they turn out to live in a package not in `['base','ams']`), add exactly the missing package (check MathJax's own package-to-macro documentation for which one) rather than reverting to `AllPackages`.

- [ ] **Step 4: Build and measure**

Run: `npm run build && node scripts/measure-performance.mjs`
Expected: the report's eager (entry-chunk) bytes/gzip are unchanged from `main`'s current baseline — `mathjax-full` must not appear there. Then run `node scripts/check-entry-chunk.mjs` and `node scripts/check-performance-budget.mjs` (both already part of `npm run verify`, run standalone here for a fast first look) to double check.

- [ ] **Step 5: Commit**

```bash
git add src/utils/pdf/mathTypeset.ts
git commit -m "perf(pdf): trim MathJax to the base+ams packages the translator actually emits"
```

---

### Task 7: Full verification and one manual visual check

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run verify`
Expected: PASS (lint, docs check, protected-baseline check, full test suite, build, perf report, entry-chunk check).

- [ ] **Step 2: Generate one real report and inspect it with the project's own tooling**

```bash
node --experimental-vm-modules -e "
import('./src/utils/calculationPdf.ts');
" 2>&1 | head -5   # placeholder check only — actually generating a report needs a ProjectModel/AnalysisResult fixture
```

In practice, drive this from an existing fixture-backed test path instead of a throwaway script: temporarily add `console.log` output of the generated `bytes` length inside `calculationPdf.test.ts`'s existing report-building test, or — simpler — write the artifact from that test to a scratch file with `await writeFile('/tmp/sample-report.pdf', artifact.bytes)` for one local run, then:

```bash
node scripts/inspect-pdf.mjs /tmp/sample-report.pdf
```

Expected: no new "glyph loss" or margin-overflow findings versus a pre-change baseline run of the same command (formulas are now images-as-vector-paths from `inspect-pdf.mjs`'s point of view — i.e. invisible to its text-based checks — so the meaningful comparison is that everything *else* it checks, headers/footers/blank pages/orphan headings, is unaffected). Remove the temporary `writeFile` call before committing anything from this step — it is a one-time manual check, not a new test.

- [ ] **Step 3: Visually confirm formula fidelity once, by hand**

There is no PDF rasterizer in this project's toolchain (no `canvas` npm dependency, no bundled `pdftoppm`/`mutool`), and adding one is out of scope for this plan — do not add a Python dependency or a `canvas` binding to get pixel-diffing here. Instead: open `/tmp/sample-report.pdf` from Step 2 in any PDF viewer (or, in an agentic session, follow the same spike recipe this plan's groundwork used — `PDFDocument` → save → any available renderer — as a one-off, not as code that lands in the repo) and confirm by eye that a fraction, a Greek letter, and a superscript/subscript in the generated report look like real typeset math, not the old flat glyph-by-glyph rendering. This is a one-time human/agent judgment call, not an automated gate.

- [ ] **Step 4: Report to the user**

Summarize: bundle delta from Task 6 Step 4, `npm run verify` result, and the visual check's outcome (attach or describe the sample page). Do not commit anything further as part of this task — it is verification-only.

---

## Self-review notes

- **Spec coverage:** DSL→LaTeX translation (Task 2), headless MathJax rendering (Task 1), vector embedding in `pdf-lib` (Task 3), full replacement of the nine call sites' underlying behavior without touching their call sites (Task 4, via the stable `pdfMath.ts` API), bundle laziness (Task 6-7), offline/no-network (enforced throughout — `mathjax-full` is a local npm dependency, no `fetch` anywhere in the new modules).
- **Known, accepted regression:** formulas become vector *image* content in the PDF's content stream — no longer real PDF text. They stop being selectable/searchable/copiable, and `inspect-pdf.mjs`'s text-based QA can no longer see inside them (Task 7 Step 2 calls this out explicitly). The user confirmed visual fidelity takes priority over this during scoping.
- **Type consistency check:** `ParsedFormula`/`FormulaOp`/`AffineMatrix` (Task 1) are the only shapes `mathVector.ts` (Task 3) and `pdfMath.ts` (Task 4) consume — verified the field names (`ops`, `widthUnits`, `heightUnits`, `depthUnits`, `path`, `matrix`, `x`/`y`/`width`/`height` on the rect variant) are used identically across all three files above.
