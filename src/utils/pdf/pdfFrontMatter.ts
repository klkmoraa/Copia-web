/**
 * Front matter: what the cover says.
 *
 * The cover is an identity page — what this document is, of what project, under which scenario,
 * produced when, by what version, and the hash that ties it to the attached file — and the
 * contents page is a real contents page with room for every part and for the sections inside
 * it, indented under their part and leadered to a real folio.
 *
 * Neither is drawn here any more. Drawing them needs the one thing this side cannot know: the
 * page each part landed on. So this module now states the cover's *content*, the renderer
 * composes both sheets (`cover.py`, `contents.py`), and the contents list is built from the
 * `sections` the layout collected as the body was written.
 */
import { pdfText } from './pdfGlyphs';
import type { CoverPage } from './reportDocument';
import type { ReportContext } from './reportContext';

const formatStamp = (value: string): string => {
  const stamp = new Date(value);
  if (Number.isNaN(stamp.valueOf())) return value;
  return `${stamp.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
};

/** The cover's identity block, in the order it is read. */
export const buildCoverPage = (
  context: ReportContext,
  documentTitle: string,
  professionalNote: string,
): CoverPage => {
  const { project, payload, options } = context;
  // Every string on this page is transliterated here rather than at the renderer, for the same
  // reason the rest of the document is: the standard faces carry WinAnsi, and a project named
  // with an en dash or a Greek letter has to read the same on the cover as in the running head.
  const facts: [string, string][] = [
    ['Escenario', options.scenarioName ?? 'Análisis activo'],
    ['Modelo', `${project.nodes.length} nodos · ${project.members.length} miembros · ${payload.metadata.loadCount} acciones`],
    ['Generado', formatStamp(payload.provenance.generatedAt)],
    ['Versión de la aplicación', payload.provenance.appVersion],
    ['Integridad SHA-256', payload.checksum.value],
  ];
  return {
    documentTitle: pdfText(documentTitle),
    projectName: pdfText(project.name),
    facts: facts.map(([label, value]) => [pdfText(label), pdfText(value)] as const),
    noticeTitle: pdfText('Aviso profesional'),
    notice: pdfText(professionalNote),
  };
};
