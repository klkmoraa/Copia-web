/**
 * PDFs that did *not* come from structureCo, written by hand for the import path's tests.
 *
 * `pdfImport.ts` sorts a dropped file into three kinds — a structureCo document with its payload
 * attached, a digital PDF from some other program, and a scan with no text at all — and the
 * last two cannot be produced by this repository's own renderer, which always writes a
 * structureCo document with a cover on it. They are the reason a PDF *writer* still exists in
 * this codebase at all, and it is deliberately this: forty lines of PDF syntax, no dependency,
 * and only ever reachable from a test or a QA script.
 *
 * The output is the smallest thing the specification allows: a catalogue, a page tree, one
 * page, and — when there is text — one content stream in Helvetica. Cross-reference offsets are
 * computed as the file is assembled rather than written down, which is the only part a person
 * could plausibly get wrong.
 */

const HEADER = '%PDF-1.4\n';

/** Assembles numbered objects into a file with a correct cross-reference table. */
const assemble = (objects: readonly string[]): Uint8Array => {
  const encoder = new TextEncoder();
  let body = HEADER;
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(body).byteLength);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = encoder.encode(body).byteLength;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return encoder.encode(body + xref);
};

/** Escapes the three characters a PDF literal string cannot carry raw. */
const literal = (text: string): string => text.replace(/[\\()]/g, (character) => `\\${character}`);

/** A one-page PDF carrying `text` and nothing else: a calculation report from another program. */
export const foreignPdf = (text: string): Uint8Array => {
  const stream = `BT /F1 12 Tf 40 700 Td (${literal(text)}) Tj ET`;
  return assemble([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] '
      + '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]);
};

/** A one-page PDF with no text at all: what a scan looks like to a text extractor. */
export const blankPdf = (): Uint8Array => assemble([
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
]);
