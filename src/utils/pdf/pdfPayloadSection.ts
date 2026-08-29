/**
 * Document metadata and the embedded portable payload.
 *
 * The attachment is what makes the report re-importable without OCR: `ImportCenterDialog`
 * looks the file up by `STRUCTURECO_PAYLOAD_FILENAME`. Its name, MIME type, serialisation and
 * dates are part of the file format — changing any of them silently breaks re-import, so this
 * module is deliberately the only place that writes them.
 *
 * Every date in the file comes from the payload's own `generatedAt`, never from the clock. A
 * renderer left to its own devices stamps the moment of export, so two exports of an unchanged
 * model differed byte for byte and the payload checksum described the contents but not the
 * file. Anchoring them makes the report reproducible — and lets a reader compare two PDFs the
 * same way they would compare two checksums.
 */
import { STRUCTURECO_PAYLOAD_FILENAME, STRUCTURECO_PAYLOAD_MIME } from '../portableTypes';
import { serializePortablePayload } from '../portablePayload';
import { pdfText } from './pdfGlyphs';
import type { DocumentAttachment, DocumentMetadata } from './reportDocument';
import type { ReportContext } from './reportContext';

export const buildDocumentMetadata = (context: ReportContext): DocumentMetadata => {
  const { project, payload } = context;
  const stampedAt = new Date(payload.provenance.generatedAt);
  const stamp = Number.isNaN(stampedAt.valueOf()) ? new Date() : stampedAt;
  return {
    title: pdfText(`${project.name} - memoria de cálculo structureCo`),
    author: 'structureCo',
    subject: 'Modelo, DCL, diagramas N-V-M, resultados y procedimiento estructural',
    keywords: ['structureCo', 'cálculo estructural', 'DCL', 'NVM', payload.checksum.value],
    producer: `structureCo ${payload.provenance.appVersion ?? ''}`.trim(),
    creator: 'structureCo',
    language: project.settings.language === 'en' ? 'en' : 'es',
    stampedAt: stamp.toISOString(),
  };
};

export const buildPortableAttachment = (context: ReportContext): DocumentAttachment => ({
  filename: STRUCTURECO_PAYLOAD_FILENAME,
  mimeType: STRUCTURECO_PAYLOAD_MIME,
  description: 'Proyecto y resultados exactos para reimportación en structureCo',
  text: serializePortablePayload(context.payload, true),
});
