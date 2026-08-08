import type { ProjectModel } from '../../types';
import { normalizeProject } from '../../data/migrate';
import { translate, type Language, type TranslationKey } from '../../i18n/catalogs';
import {
  inspectPortableFile,
  type PortableFileInspection,
} from '../../utils/portableFile';
import type {
  ImportCenterAdapter,
  ImportContentOption,
  ImportInspection,
  ImportOutcome,
} from './ImportCenterDialog';
import { formatFixed } from '../../utils/numberFormat';

const inspectedFiles = new WeakMap<File, PortableFileInspection>();

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

const projectContents = (
  project: ProjectModel,
  includeAnalysis: boolean,
  t: Translate,
): ImportContentOption[] => [
  {
    key: 'geometry',
    label: t('importCenter.geometry'),
    detail: t('importCenter.geometryCount', { nodes: project.nodes.length, members: project.members.length }),
    available: true,
    selectedByDefault: true,
  },
  {
    key: 'supports',
    label: t('importCenter.supports'),
    detail: t('importCenter.supportCount', { supports: project.nodes.filter((node) => node.support.type !== 'none').length }),
    available: true,
    selectedByDefault: true,
  },
  {
    key: 'loads',
    label: t('importCenter.portableLoads'),
    detail: t('importCenter.portableLoadCount', { loads: project.nodalLoads.length + project.memberLoads.length }),
    available: true,
    selectedByDefault: true,
  },
  {
    key: 'results',
    label: t('importCenter.results'),
    detail: includeAnalysis ? t('importCenter.portableResultsIncluded') : t('importCenter.portableResultsRecalculate'),
    available: includeAnalysis,
    selectedByDefault: includeAnalysis,
  },
  {
    key: 'diagrams',
    label: t('importCenter.diagrams'),
    detail: includeAnalysis ? t('importCenter.portableDiagramsIncluded') : t('importCenter.portableDiagramsGenerate'),
    available: includeAnalysis,
    selectedByDefault: includeAnalysis,
  },
  {
    key: 'procedures',
    label: t('importCenter.procedures'),
    detail: includeAnalysis ? t('importCenter.portableProceduresIncluded') : t('importCenter.portableProceduresGenerate'),
    available: includeAnalysis,
    selectedByDefault: includeAnalysis,
  },
  {
    key: 'attachments',
    label: t('importCenter.portableProvenance'),
    detail: includeAnalysis ? t('importCenter.portableProvenanceVerified') : t('importCenter.portableNoAttachments'),
    available: includeAnalysis,
    selectedByDefault: includeAnalysis,
  },
];

const referenceContents = (inspection: PortableFileInspection, t: Translate): ImportContentOption[] => {
  const pages = 'pdf' in inspection ? inspection.pdf.pageCount : 0;
  return [
    { key: 'geometry', label: t('importCenter.geometry'), detail: t('importCenter.referenceGeometry'), available: false },
    { key: 'supports', label: t('importCenter.supports'), detail: t('importCenter.referenceNotConfirmed'), available: false },
    { key: 'loads', label: t('importCenter.portableLoads'), detail: t('importCenter.referenceNotConfirmed'), available: false },
    { key: 'results', label: t('importCenter.referenceResults'), detail: t('importCenter.referenceResultsOnly'), available: false },
    { key: 'diagrams', label: t('importCenter.referenceDiagrams'), detail: t('importCenter.referenceDiagramsOnly'), available: false },
    { key: 'procedures', label: t('importCenter.referenceProcedures'), detail: t('importCenter.referencePages', { pages }), available: false },
    { key: 'attachments', label: t('importCenter.referenceOriginalPdf'), detail: t('importCenter.referencePdfStorage'), available: false },
  ];
};

const localizeWarnings = (warnings: string[], t: Translate): string[] => warnings.map((warning) => {
  const attachmentRecovery = warning.match(/^El adjunto (.+) no pudo recuperarse\.$/);
  if (attachmentRecovery) return t('importCenter.warningAttachmentRecovery', { filename: attachmentRecovery[1] });
  const attachmentInvalid = warning.match(/^El adjunto (.+) no es valido\.$/);
  if (attachmentInvalid) return t('importCenter.warningAttachmentInvalid', { filename: attachmentInvalid[1] });
  const previewLimit = warning.match(/^Vista previa limitada a (\d+) de (\d+) paginas\.$/);
  if (previewLimit) return t('importCenter.warningPreviewLimit', { shown: previewLimit[1], total: previewLimit[2] });
  if (warning.startsWith('PDF externo:')) return t('importCenter.warningExternalPdf');
  if (warning.startsWith('No se encontro texto suficiente;')) return t('importCenter.warningScannedPdf');
  return warning;
});

const localizeReaderError = (reason: unknown, language: Language, t: Translate): string => {
  if (!(reason instanceof Error)) return t('importCenter.inspectError');
  const exactKeys: Record<string, TranslationKey> = {
    'El archivo JSON no es valido.': 'importCenter.readerInvalidJson',
    'Formato no compatible. Usa PDF, .structureco o .structureco.json.': 'importCenter.readerUnsupportedFormat',
    'El PDF esta protegido con contrasena y no puede inspeccionarse.': 'importCenter.readerPdfPassword',
    'El archivo .structureco no es un paquete ZIP valido.': 'importCenter.readerInvalidBundle',
    'El paquete no contiene manifest.json.': 'importCenter.readerMissingManifest',
    'El paquete no tiene un manifest structureCo compatible.': 'importCenter.readerIncompatibleManifest',
    'El paquete structureCo esta incompleto.': 'importCenter.readerIncompleteBundle',
    'El checksum del manifest no coincide con el expediente.': 'importCenter.readerChecksumMismatch',
    'Los datos separados del paquete no coinciden con el expediente firmado.': 'importCenter.readerPackageMismatch',
    'Este navegador no ofrece SHA-256 para verificar el expediente.': 'importCenter.readerShaUnavailable',
    'El adjunto no es un expediente structureCo compatible.': 'importCenter.readerIncompatibleAttachment',
    'El adjunto structureCo no contiene JSON válido.': 'importCenter.readerInvalidAttachmentJson',
    'El expediente fue modificado o está dañado: el checksum no coincide.': 'importCenter.readerDamagedPackage',
  };
  const exactKey = exactKeys[reason.message];
  if (exactKey) return t(exactKey);
  const pdfLimit = reason.message.match(/^El PDF excede el limite de (\d+) MB\.$/);
  if (pdfLimit) return t('importCenter.readerPdfLimit', { limit: pdfLimit[1] });

  // Resource budgets (fileGuards). These carry the offending label/path, so they are
  // matched by shape rather than by exact text.
  const budgetPatterns: Array<[RegExp, TranslationKey, (match: RegExpMatchArray) => Record<string, string>]> = [
    [/^El archivo (.+) excede el limite de ([\d.]+) MB\.$/, 'importCenter.readerFileTooLarge', (m) => ({ label: m[1], limit: m[2] })],
    [/^El archivo (.+) esta vacio\.$/, 'importCenter.readerFileEmpty', (m) => ({ label: m[1] })],
    [/^El archivo (.+) no declara un tamano valido\.$/, 'importCenter.readerFileInvalidSize', (m) => ({ label: m[1] })],
    [/^El paquete supera las \d+ entradas permitidas\.$/, 'importCenter.readerArchiveEntries', () => ({})],
    [/^El paquete contiene una ruta interna insegura: (.+)$/, 'importCenter.readerArchiveUnsafePath', (m) => ({ name: m[1] })],
    [/^El paquete contiene una ruta demasiado profunda: (.+)$/, 'importCenter.readerArchiveDeepPath', (m) => ({ name: m[1] })],
    [/^El paquete repite la entrada (.+)\.$/, 'importCenter.readerArchiveDuplicate', (m) => ({ name: m[1] })],
    [/^La entrada .+ excede el limite de [\d.]+ MB descomprimidos\.$/, 'importCenter.readerArchiveTooLarge', () => ({})],
    [/^El paquete supera los [\d.]+ MB descomprimidos\.$/, 'importCenter.readerArchiveTooLarge', () => ({})],
    [/^La entrada .+ tiene una relacion de compresion sospechosa\.$/, 'importCenter.readerArchiveRatio', () => ({})],
    [/^El paquete contiene una ruta interna no valida\.$/, 'importCenter.readerArchiveInvalidPath', () => ({})],
  ];
  for (const [pattern, key, variables] of budgetPatterns) {
    const match = reason.message.match(pattern);
    if (match) return t(key, variables(match));
  }

  const pdfFailure = reason.message.match(/^No se pudo leer el PDF: (.+)$/);
  if (pdfFailure) return t('importCenter.readerPdfFailure', { message: pdfFailure[1] });
  return language === 'es' ? reason.message : t('importCenter.inspectError');
};

const mapInspection = (inspection: PortableFileInspection, t: Translate): ImportInspection => {
  const isPdf = inspection.kind.endsWith('-pdf');
  const kind: ImportInspection['kind'] = isPdf
    ? 'pdf'
    : inspection.kind === 'bundle'
      ? 'structureco'
      : 'json';

  if (!inspection.canRestoreProject) {
    return {
      kind,
      sourceLabel: inspection.kind === 'scanned-pdf' ? t('importCenter.sourceScannedPdf') : t('importCenter.sourceExternalPdf'),
      confidence: Math.round(inspection.pdf.confidence * 100),
      supported: false,
      summary: inspection.pdf.text
        ? t('importCenter.referenceTextSummary', { pages: inspection.pdf.pageCount })
        : t('importCenter.referenceScanSummary'),
      statistics: [
        { label: t('importCenter.pages'), value: inspection.pdf.pageCount },
        { label: t('importCenter.characters'), value: inspection.pdf.text.length },
        { label: t('importCenter.size'), value: `${formatFixed((inspection.size / 1024 / 1024), 2)} MB` },
      ],
      warnings: localizeWarnings(inspection.pdf.warnings, t),
      contents: referenceContents(inspection, t),
    };
  }

  const payload = 'payload' in inspection ? inspection.payload : undefined;
  const project = normalizeProject(inspection.kind === 'project-json' ? inspection.project : payload!.project);
  const includeAnalysis = Boolean(payload?.analysis);
  const sourceLabel = inspection.kind === 'native-pdf'
    ? t('importCenter.sourceNativePdf')
    : inspection.kind === 'bundle'
      ? t('importCenter.sourcePortableBundle')
      : inspection.kind === 'payload-json'
        ? t('importCenter.sourcePortableJson')
        : t('importCenter.sourceJson');
  const warnings = inspection.kind === 'native-pdf'
    ? localizeWarnings(inspection.pdf.warnings, t)
    : project.nodes.length === 0
      ? [t('importCenter.emptyNodesWarning')]
      : [];

  return {
    kind,
    sourceLabel,
    version: payload?.provenance.appVersion ?? String(project.schemaVersion),
    confidence: payload ? 99 : 100,
    supported: true,
    summary: payload
      ? t('importCenter.portableVerifiedSummary', { name: project.name })
      : t('importCenter.portableProjectSummary', { name: project.name }),
    statistics: [
      { label: t('importCenter.nodes'), value: project.nodes.length },
      { label: t('importCenter.members'), value: project.members.length },
      { label: t('importCenter.loadStatistic'), value: project.nodalLoads.length + project.memberLoads.length },
      { label: t('importCenter.procedureStatistic'), value: payload?.analysis.explanation.length ?? 0 },
    ],
    warnings,
    contents: projectContents(project, includeAnalysis, t),
    project,
    restoredAnalysis: payload?.analysis,
  };
};

export const createPortableImportCenterAdapter = (language: Language): ImportCenterAdapter => {
  const t: Translate = (key, variables) => translate(language, key, variables);
  const inspectFile = async (file: File) => {
    try {
      return await inspectPortableFile(file, { maxBytes: 25 * 1024 * 1024, maxPages: 120 });
    } catch (reason) {
      throw new Error(localizeReaderError(reason, language, t));
    }
  };
  return {
    inspect: async (file) => {
      const inspection = await inspectFile(file);
      inspectedFiles.set(file, inspection);
      return mapInspection(inspection, t);
    },
    importFile: async (file, inspection): Promise<ImportOutcome> => {
      const portable = inspectedFiles.get(file) ?? await inspectFile(file);
      if (!portable.canRestoreProject) {
        throw new Error(t('importCenter.referenceImportError'));
      }
      const payload = 'payload' in portable ? portable.payload : undefined;
      const project = normalizeProject(portable.kind === 'project-json' ? portable.project : payload!.project);
      return {
        project,
        restoredAnalysis: payload?.analysis,
        title: payload ? t('importCenter.portableRestoredTitle') : t('importCenter.portableImportedTitle'),
        message: payload
          ? t('importCenter.portableRestoredMessage')
          : t('importCenter.portableImportedMessage'),
        statistics: inspection.statistics,
        warnings: inspection.warnings,
      };
    },
  };
};

export const portableImportCenterAdapter = createPortableImportCenterAdapter('es');
