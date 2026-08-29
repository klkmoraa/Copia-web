/**
 * Where a typeset glyph lands.
 *
 * MathJax hands over a size-independent tree in TeX design units; `mathVector.ts` places it at
 * a chosen size and baseline, and the renderer does no more than stroke what comes out. That
 * makes this module the last place a sign error can hide — and it *has* hidden one: the outline
 * data is authored y-down while the composed matrix already carries MathJax's own `scale(1,-1)`,
 * so exactly one flip has to be written down. Before the ReportLab migration it was supplied
 * implicitly by `pdf-lib`'s `drawSvgPath`, which hard-codes `scale(s, -s)`; the first render
 * without it printed every digit upside down.
 *
 * These assertions are on the marks themselves — the numbers the renderer receives — rather
 * than on a content stream, because the marks *are* the contract now.
 */
import { describe, expect, it } from 'vitest';
import { typesetLatex } from './mathTypeset';
import { formulaToMarks, measureFormula } from './mathVector';

describe('measureFormula', () => {
  it('scales the parsed formula\'s natural box linearly with font size', () => {
    const parsed = typesetLatex('M(x)');
    const small = measureFormula(parsed, 10);
    const large = measureFormula(parsed, 20);
    expect(large.widthPt).toBeCloseTo(small.widthPt * 2, 5);
    expect(large.heightPt).toBeCloseTo(small.heightPt * 2, 5);
  });
});

describe('formulaToMarks', () => {
  it('emits one glyph mark per path op and one rectangle for the fraction bar', () => {
    const parsed = typesetLatex('\\frac{a}{b}');
    const x = 40;
    const baseline = 100;
    const fontSizePt = 24;
    const unitScale = fontSizePt / 1000;
    const marks = formulaToMarks(parsed, x, baseline, fontSizePt, 'ink');

    const pathOps = parsed.ops.filter((op) => op.kind === 'path');
    const rectOp = parsed.ops.find((op) => op.kind === 'rect');
    expect(pathOps.length).toBeGreaterThan(0);
    if (rectOp?.kind !== 'rect') throw new Error('expected a rect op');

    expect(marks.filter((mark) => mark.t === 'glyph')).toHaveLength(pathOps.length);
    const rects = marks.filter((mark) => mark.t === 'rect');
    expect(rects).toHaveLength(1);

    // The expected corners are re-derived here from the parsed op, independently of the code
    // under test, so a sign flip in `formulaMarks` changes what is emitted without changing
    // what this expects.
    const corner = (localX: number, localY: number) => ({
      x: x + unitScale * (rectOp.matrix.a * localX + rectOp.matrix.e),
      y: baseline + unitScale * (-rectOp.matrix.d * localY - rectOp.matrix.f),
    });
    const first = corner(rectOp.x, rectOp.y);
    const second = corner(rectOp.x + rectOp.width, rectOp.y + rectOp.height);
    const bar = rects[0];
    if (bar.t !== 'rect') throw new Error('expected a rect mark');
    expect(bar.rect.x).toBeCloseTo(Math.min(first.x, second.x), 6);
    expect(bar.rect.y).toBeCloseTo(Math.min(first.y, second.y), 6);
    expect(bar.rect.width).toBeCloseTo(Math.abs(second.x - first.x), 6);
    expect(bar.rect.height).toBeCloseTo(Math.abs(second.y - first.y), 6);
    // A fraction bar has zero height in design units but must keep a real width: a degenerate
    // box means the corner math collapsed, e.g. an `x`/`y` vs `x+width`/`y+height` mixup.
    expect(bar.rect.width).toBeGreaterThan(0);
    expect(bar.fill).toBe('ink');
  });

  it('places a single glyph exactly where the transform predicts, right way up', () => {
    const parsed = typesetLatex('M');
    // Lock in the shape this test's hand-derived math depends on; if MathJax's output for a
    // single glyph ever stops being one `path` op with this matrix, fail loudly here rather
    // than silently computing nonsense below.
    expect(parsed.ops).toHaveLength(1);
    const [glyphOp] = parsed.ops;
    if (glyphOp.kind !== 'path') throw new Error('expected a path op');
    expect(glyphOp.matrix).toEqual({ a: 1, b: 0, c: 0, d: -1, e: 0, f: 0 });

    const x = 40;
    const baseline = 100;
    const fontSizePt = 100; // unitScale = 0.1: round numbers, easy to hand-verify
    const [mark] = formulaToMarks(parsed, x, baseline, fontSizePt, 'ink');
    if (mark.t !== 'glyph') throw new Error('expected a glyph mark');
    const [a, b, c, d, tx, ty] = mark.matrix;

    expect(b).toBe(0);
    expect(c).toBe(0);
    expect(a).toBeCloseTo(0.1, 10); // fontSizePt/1000 * matrix.a (1)
    // The sign that matters: MathJax's `d` is -1 and the outline is authored y-down, so the
    // vertical scale the renderer receives is *positive*. Negative here means upside down.
    expect(d).toBeCloseTo(0.1, 10);
    expect(tx).toBeCloseTo(x, 10);
    expect(ty).toBeCloseTo(baseline, 10);

    // Where a real point of the glyph's own path data lands once the matrix is applied.
    const firstPoint = /^M(-?[\d.]+) (-?[\d.]+)/.exec(glyphOp.path);
    expect(firstPoint).not.toBeNull();
    const rawX = Number(firstPoint![1]);
    const rawY = Number(firstPoint![2]);
    const pageX = a * rawX + tx;
    const pageY = d * rawY + ty;

    // An 'M' has zero depth (`mathTypeset`'s `depthUnits` is 0 for it): its ink must land at
    // or above the baseline, never mirrored below it.
    expect(pageY).toBeGreaterThan(baseline);
    // Matches `mathTypeset`'s own size-independent contract: the font's design-unit Y maps
    // onto PDF's y-up page space with no extra sign left over.
    expect(pageY).toBeCloseTo(baseline + fontSizePt / 1000 * rawY, 10);
    // The glyph must not be mirrored left/right either.
    expect(pageX).toBeGreaterThan(x);
  });
});
