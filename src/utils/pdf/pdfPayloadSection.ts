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
  const attachment = new TextEncoder().encode(serializePortablePayload(payload, true));
  const attachmentDate = new Date(payload.provenance.generatedAt);
  await pdf.attach(attachment, STRUCTURECO_PAYLOAD_FILENAME, {
    mimeType: STRUCTURECO_PAYLOAD_MIME,
    description: 'Proyecto y resultados exactos para reimportacion en structureCo',
    creationDate: Number.isNaN(attachmentDate.valueOf()) ? new Date() : attachmentDate,
    modificationDate: Number.isNaN(attachmentDate.valueOf()) ? new Date() : attachmentDate,
  });
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
};
