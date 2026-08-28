import { describe, expect, it } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { typesetLatex } from './mathTypeset';
import { drawFormula, measureFormula } from './mathVector';

/**
 * `pdf-lib` has no public way to read back the operators queued on a page (only to write
 * them), so the geometry tests below reach into `PDFPage`'s internal, undocumented-but-stable
 * `getContentStream` to assert on the *actual* drawn transform/path/rectangle numbers — not
 * just that some content stream exists. This is test-only introspection; app code never does
 * this.
 */
interface RawOperator {
  name: string;
  args: unknown[];
}
const readOperators = (page: PDFPage): RawOperator[] =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (page as any).getContentStream(true).operators as RawOperator[];
const num = (arg: unknown): number => Number(String(arg));

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

  it('emits one filled path per glyph op and one correctly-positioned rectangle for the fraction bar', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 200]);
    const parsed = typesetLatex('\\frac{a}{b}');
    const x = 40;
    const baseline = 100;
    const fontSizePt = 24;
    drawFormula(page, parsed, x, baseline, fontSizePt, rgb(0, 0, 0));
    const unitScale = fontSizePt / 1000;

    const pathOps = parsed.ops.filter((op) => op.kind === 'path');
    const rectOp = parsed.ops.find((op) => op.kind === 'rect');
    expect(pathOps.length).toBeGreaterThan(0);
    expect(rectOp).toBeDefined();
    if (rectOp?.kind !== 'rect') throw new Error('expected a rect op');

    const ops = readOperators(page);

    // One outer `q`/`cm` pair per glyph path, exactly as `drawPathOp` pushes manually.
    const outerConcats = ops.filter((op) => op.name === 'cm').map((op) => op.args.map(num));
    expect(outerConcats.length).toBeGreaterThanOrEqual(pathOps.length);

    // `drawRectOp`'s expected absolute corners, re-derived here independently of
    // `pdfPoint`/`drawRectOp` in `mathVector.ts` — so a sign flip in that code changes what's
    // *drawn* without changing what this test *expects*, and the assertions below catch it.
    const expectedCorner = (localX: number, localY: number) => ({
      x: x + unitScale * (rectOp.matrix.a * localX + rectOp.matrix.e),
      y: baseline + unitScale * (-rectOp.matrix.d * localY - rectOp.matrix.f),
    });
    const c1 = expectedCorner(rectOp.x, rectOp.y);
    const c2 = expectedCorner(rectOp.x + rectOp.width, rectOp.y + rectOp.height);
    const expectedRectX = Math.min(c1.x, c2.x);
    const expectedRectY = Math.min(c1.y, c2.y);
    const expectedRectW = Math.abs(c2.x - c1.x);
    const expectedRectH = Math.abs(c2.y - c1.y);

    // `page.drawRectangle` (called unmodified by `drawRectOp`, with pre-computed absolute
    // page coordinates) always emits: a translate-only `cm`, then identity `cm`s for its
    // (unused, zero) rotate/skew options, then `m 0,0` and three `l`s tracing the box, then
    // `h` (close). Find it structurally — by operator names/shape, not string regex.
    let drawnRect: { tx: number; ty: number; w: number; h: number } | undefined;
    for (let i = 0; i < ops.length; i += 1) {
      if (ops[i].name !== 'cm') continue;
      const [a, b, c, d, tx, ty] = ops[i].args.map(num);
      if (!(a === 1 && b === 0 && c === 0 && d === 1 && (tx !== 0 || ty !== 0))) continue;
      let j = i + 1;
      while (ops[j]?.name === 'cm') j += 1; // skip the identity rotate/skew `cm`s
      if (ops[j]?.name !== 'm' || ops[j + 1]?.name !== 'l' || ops[j + 2]?.name !== 'l' || ops[j + 3]?.name !== 'l' || ops[j + 4]?.name !== 'h') continue;
      drawnRect = { tx, ty, w: num(ops[j + 3].args[0]), h: num(ops[j + 1].args[1]) };
      break;
    }
    expect(drawnRect).toBeDefined();
    expect(drawnRect?.tx).toBeCloseTo(expectedRectX, 6);
    expect(drawnRect?.ty).toBeCloseTo(expectedRectY, 6);
    expect(drawnRect?.w).toBeCloseTo(expectedRectW, 6);
    expect(drawnRect?.h).toBeCloseTo(expectedRectH, 6);
    // A fraction bar has zero height in font design units (it's a hairline rect at a fixed
    // y) but must have real, positive width — a degenerate (zero-area) box would mean the
    // corner math collapsed, e.g. from an `x`/`y` vs `x+width`/`y+height` mixup.
    expect(drawnRect!.w).toBeGreaterThan(0);
  });

  it('places a single glyph at the exact page position the transform predicts', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 200]);
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
    drawFormula(page, parsed, x, baseline, fontSizePt, rgb(0, 0, 0));

    const ops = readOperators(page);
    // The first two operators pushed are `drawPathOp`'s own manual `pushGraphicsState()` +
    // `concatTransformationMatrix(sx, 0, 0, sy, tx, ty)` — the outer transform this whole
    // module exists to get right.
    expect(ops[0].name).toBe('q');
    expect(ops[1].name).toBe('cm');
    const [sx, b, c, sy, tx, ty] = ops[1].args.map(num);
    expect(b).toBe(0);
    expect(c).toBe(0);
    expect(sx).toBeCloseTo(0.1, 10); // fontSizePt/1000 * matrix.a (1)
    expect(sy).toBeCloseTo(-0.1, 10); // fontSizePt/1000 * matrix.d (-1) -- the sign that matters
    expect(tx).toBeCloseTo(x, 10);
    expect(ty).toBeCloseTo(baseline, 10);

    // Confirm `pdf-lib`'s own hard-coded `drawSvgPath` flip is really present (so `drawPathOp`
    // is not redundantly cancelling it a second time), then fold both transforms together and
    // check where a real point from the glyph's own path data actually lands on the page.
    const flip = ops.find((op) => op.name === 'cm' && op.args.map(num).join(',') === '1,0,0,-1,0,0');
    expect(flip).toBeDefined();

    const firstPoint = /^M(-?[\d.]+) (-?[\d.]+)/.exec(glyphOp.path);
    expect(firstPoint).not.toBeNull();
    const rawX = Number(firstPoint![1]);
    const rawY = Number(firstPoint![2]);
    const pageX = sx * rawX + tx; // drawSvgPath's internal flip only touches Y
    const pageY = sy * -rawY + ty; // -rawY: pdf-lib's internal `scale(1,-1)`

    // An 'M' has zero depth (`mathTypeset`'s `depthUnits` is 0 for it): its ink must land at
    // or above the baseline, never mirrored below it.
    expect(pageY).toBeGreaterThan(baseline);
    // Matches `mathTypeset`'s own size-independent contract directly: once both flips
    // cancel, the font's design-unit Y maps onto PDF's y-up page space with no extra sign.
    expect(pageY).toBeCloseTo(baseline + fontSizePt / 1000 * rawY, 10);
    // The glyph must not be mirrored left/right either.
    expect(pageX).toBeGreaterThan(x);
  });
});
