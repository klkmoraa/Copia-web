/**
 * Document metadata and the embedded portable payload.
 *
 * The attachment is what makes the report re-importable without OCR: `ImportCenterDialog`
 * looks the file up by `STRUCTURECO_PAYLOAD_FILENAME`. Its name, MIME type, serialisation and
 * dates are part of the file format — changing any of them silently breaks re-import, so this
 * module is deliberately the only place that writes them.
 */
import { STRUCTURECO_PAYLOAD_FILENAME, STRUCTURECO_PAYLOAD_MIME } from '../portableTypes';
import { serializePortablePayload } from '../portablePayload';
import { pdfText } from './pdfGlyphs';
import type { ReportContext } from './reportContext';

export const attachPortablePayload = async (context: ReportContext): Promise<Uint8Array> => {
  const { layout, project, payload } = context;
  const pdf = layout.doc;
  pdf.setTitle(pdfText(`${project.name} - memoria de cálculo structureCo`));
  pdf.setAuthor('structureCo');
  pdf.setSubject('Modelo, DCL, diagramas N-V-M, resultados y procedimiento estructural');
  pdf.setKeywords(['structureCo', 'cálculo estructural', 'DCL', 'NVM', payload.checksum.value]);
  pdf.setProducer(`structureCo ${payload.provenance.appVersion ?? ''}`.trim());
  pdf.setCreator('structureCo');
  pdf.setLanguage(project.settings.language === 'en' ? 'en' : 'es');

  // Every date in the file comes from the payload's own `generatedAt`, never from the clock.
  // pdf-lib otherwise stamps the moment of export, so two exports of an unchanged model
  // differed byte for byte and the payload checksum described the contents but not the file.
  // Anchoring them makes the report reproducible — and lets a reader compare two PDFs the
  // same way they would compare two checksums.
  const stampedAt = new Date(payload.provenance.generatedAt);
  const stamp = Number.isNaN(stampedAt.valueOf()) ? new Date() : stampedAt;
  pdf.setCreationDate(stamp);
  pdf.setModificationDate(stamp);

  const attachment = new TextEncoder().encode(serializePortablePayload(payload, true));
  await pdf.attach(attachment, STRUCTURECO_PAYLOAD_FILENAME, {
    mimeType: STRUCTURECO_PAYLOAD_MIME,
    description: 'Proyecto y resultados exactos para reimportación en structureCo',
    creationDate: stamp,
    modificationDate: stamp,
  });
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
};
