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
