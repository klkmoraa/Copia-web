import type { ProjectModel } from '../types';
import { normalizeProject } from '../data/migrate';
import { inspectPdf, type InspectPdfOptions } from './pdfImport';
import { parsePortablePayload } from './portablePayload';
import { readPortableBundle, type PortableBundleContents } from './portableBundle';
import type { PdfInspection, StructureCoPortablePayload } from './portableTypes';
import { assertWithinBudget, FILE_BUDGETS, hasSignature, readSignature } from './fileGuards';

interface PortableFileBase {
  fileName: string;
  size: number;
}

export type PortableFileInspection =
  | (PortableFileBase & { kind: 'native-pdf'; canRestoreProject: true; pdf: PdfInspection; payload: StructureCoPortablePayload })
  | (PortableFileBase & { kind: 'external-pdf' | 'scanned-pdf'; canRestoreProject: false; pdf: PdfInspection })
  | (PortableFileBase & { kind: 'bundle'; canRestoreProject: true; bundle: PortableBundleContents; payload: StructureCoPortablePayload })
  | (PortableFileBase & { kind: 'payload-json'; canRestoreProject: true; payload: StructureCoPortablePayload })
  | (PortableFileBase & { kind: 'project-json'; canRestoreProject: true; project: ProjectModel });

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46] as const;
const ZIP_SIGNATURE = [0x50, 0x4b] as const;
const JSON_SIGNATURE = [0x7b] as const;

type PortableFileKind = 'pdf' | 'bundle' | 'json';

/**
 * Decides what a file is from its first bytes plus its name and MIME type, so the
 * right budget can be applied before the file is read. A declared extension that
 * contradicts the signature loses: the signature is what the parsers will see.
 */
const classifyFile = (file: File, signature: Uint8Array): PortableFileKind => {
  const lowerName = file.name.toLowerCase();
  if (hasSignature(signature, PDF_SIGNATURE)) return 'pdf';
  if (hasSignature(signature, ZIP_SIGNATURE)) return 'bundle';
  if (hasSignature(signature, JSON_SIGNATURE)) return 'json';
  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (lowerName.endsWith('.structureco')) return 'bundle';
  if (lowerName.endsWith('.json') || file.type.includes('json')) return 'json';
  throw new Error('Formato no compatible. Usa PDF, .structureco o .structureco.json.');
};

const BUDGET_BY_KIND: Record<PortableFileKind, number> = {
  pdf: FILE_BUDGETS.pdfBytes,
  bundle: FILE_BUDGETS.bundleBytes,
  json: FILE_BUDGETS.jsonBytes,
};

const LABEL_BY_KIND: Record<PortableFileKind, string> = {
  pdf: 'PDF',
  bundle: '.structureco',
  json: 'JSON',
};

const inspectJson = async (bytes: Uint8Array, base: PortableFileBase): Promise<PortableFileInspection> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error('El archivo JSON no es valido.');
  }
  if (typeof parsed === 'object' && parsed !== null && 'format' in parsed && parsed.format === 'structureco-portable') {
    const payload = await parsePortablePayload(bytes);
    return { ...base, kind: 'payload-json', canRestoreProject: true, payload };
  }
  return { ...base, kind: 'project-json', canRestoreProject: true, project: normalizeProject(parsed) };
};

/** Single adapter for the import center: PDF, .structureco ZIP, or JSON. */
export const inspectPortableFile = async (
  file: File,
  options?: InspectPdfOptions,
): Promise<PortableFileInspection> => {
  // Reject before allocating: a coarse ceiling from `file.size`, then the file's own
  // signature, then the budget that actually applies to that kind. Only after all
  // three does the file get pulled into memory.
  assertWithinBudget(file.size, FILE_BUDGETS.unknownBytes, 'seleccionado');
  const kind = classifyFile(file, await readSignature(file));
  assertWithinBudget(file.size, BUDGET_BY_KIND[kind], LABEL_BY_KIND[kind]);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const base: PortableFileBase = { fileName: file.name, size: file.size };

  if (kind === 'pdf') {
    const pdf = await inspectPdf(bytes, { maxBytes: FILE_BUDGETS.pdfBytes, ...options });
    if (pdf.kind === 'native' && pdf.payload) {
      return { ...base, kind: 'native-pdf', canRestoreProject: true, pdf, payload: pdf.payload };
    }
    return { ...base, kind: pdf.kind === 'scanned' ? 'scanned-pdf' : 'external-pdf', canRestoreProject: false, pdf };
  }
  if (kind === 'bundle') {
    const bundle = await readPortableBundle(bytes);
    return { ...base, kind: 'bundle', canRestoreProject: true, bundle, payload: bundle.payload };
  }
  return inspectJson(bytes, base);
};
