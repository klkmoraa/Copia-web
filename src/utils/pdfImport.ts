import {
  STRUCTURECO_PAYLOAD_FILENAME,
  type PdfImportKind,
  type PdfInspection,
  type StructureCoPortablePayload,
} from './portableTypes';
import { parsePortablePayload } from './portablePayload';
import { FILE_BUDGETS, PDF_BUDGETS } from './fileGuards';
import { loadPdfjs } from './pdfjsRuntime';

export interface InspectPdfOptions {
  maxBytes?: number;
  maxPages?: number;
}

const normalizeText = (text: string): string => text
  .replace(/[\t\u00A0]+/g, ' ')
  .replace(/ +\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const titleFromText = (text: string): string =>
  text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length >= 3)?.slice(0, 100)
  ?? 'Documento PDF';

export const classifyPdfContent = (
  textByPage: string[],
  payload?: StructureCoPortablePayload,
): { kind: PdfImportKind; confidence: number } => {
  if (payload) return { kind: 'native', confidence: 0.99 };
  const meaningfulCharacters = textByPage.join('').replace(/\s/g, '').length;
  const scannedThreshold = Math.max(40, textByPage.length * 30);
  if (meaningfulCharacters < scannedThreshold) return { kind: 'scanned', confidence: 0.35 };
  const density = meaningfulCharacters / Math.max(1, textByPage.length);
  return { kind: 'external', confidence: Math.min(0.9, 0.58 + density / 2500) };
};

/**
 * Reads native attachments and visible text without OCR. Heavy PDF.js code is
 * fetched only after the user selects a PDF.
 */
export const inspectPdf = async (
  input: ArrayBuffer | Uint8Array | Blob,
  options: InspectPdfOptions = {},
): Promise<PdfInspection> => {
  const maxBytes = options.maxBytes ?? FILE_BUDGETS.pdfBytes;
  const tooLarge = () => new Error(`El PDF excede el limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  // A Blob knows its size without being read; checking first keeps an oversized PDF
  // from being materialized just to be rejected.
  if (input instanceof Blob && input.size > maxBytes) throw tooLarge();
  const source = input instanceof Blob
    ? new Uint8Array(await input.arrayBuffer())
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  if (source.byteLength > maxBytes) throw tooLarge();

  const pdfjs = await loadPdfjs();

  let documentProxy: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    const loadingTask = pdfjs.getDocument({ data: source.slice(), useWorkerFetch: false });
    documentProxy = await loadingTask.promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/password/i.test(message)) throw new Error('El PDF esta protegido con contrasena y no puede inspeccionarse.');
    throw new Error(`No se pudo leer el PDF: ${message}`);
  }

  const warnings: string[] = [];
  let payload: StructureCoPortablePayload | undefined;
  let attachmentName: string | undefined;
  const attachments = await documentProxy.getAttachments();
  if (attachments) {
    let examined = 0;
    for (const [key, attachment] of attachments) {
      const filename = attachment.filename || key;
      if (filename.toLowerCase() !== STRUCTURECO_PAYLOAD_FILENAME && !filename.toLowerCase().endsWith('.structureco.json')) continue;
      examined += 1;
      if (examined > PDF_BUDGETS.maxAttachments) {
        warnings.push(`Solo se examinaron los primeros ${PDF_BUDGETS.maxAttachments} adjuntos.`);
        break;
      }
      const content = attachment.content ?? await documentProxy.getAttachmentContent(key);
      if (!content) {
        warnings.push(`El adjunto ${filename} no pudo recuperarse.`);
        continue;
      }
      if (content.byteLength > PDF_BUDGETS.maxAttachmentBytes) {
        warnings.push(`El adjunto ${filename} excede el limite y se omitio.`);
        continue;
      }
      try {
        payload = await parsePortablePayload(content);
        attachmentName = filename;
        break;
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : `El adjunto ${filename} no es valido.`);
      }
    }
  }

  const pageLimit = Math.min(documentProxy.numPages, options.maxPages ?? PDF_BUDGETS.maxPages);
  const textByPage: string[] = [];
  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await documentProxy.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => 'str' in item ? item.str : '')
      .filter(Boolean)
      .join(' ');
    textByPage.push(normalizeText(pageText));
    page.cleanup();
  }
  if (pageLimit < documentProxy.numPages) warnings.push(`Vista previa limitada a ${pageLimit} de ${documentProxy.numPages} paginas.`);
  await documentProxy.cleanup();

  const text = normalizeText(textByPage.join('\n\n'));
  const classification = classifyPdfContent(textByPage, payload);
  if (classification.kind === 'external') {
    warnings.push('PDF externo: la geometria y los resultados extraidos deben confirmarse y recalcularse.');
  } else if (classification.kind === 'scanned') {
    warnings.push('No se encontro texto suficiente; el documento parece escaneado y requiere OCR/revision manual.');
  }

  return {
    kind: classification.kind,
    confidence: classification.confidence,
    pageCount: documentProxy.numPages,
    text,
    textByPage,
    ...(payload ? { payload } : {}),
    ...(attachmentName ? { attachmentName } : {}),
    warnings,
    summary: payload
      ? {
          title: payload.metadata.projectName,
          nodeCount: payload.metadata.nodeCount,
          memberCount: payload.metadata.memberCount,
          loadCount: payload.metadata.loadCount,
        }
      : { title: titleFromText(text) },
  };
};
