import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileArchive,
  FileJson,
  FileText,
  LoaderCircle,
  Save,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { TranslationKey } from '../../i18n/catalogs';
import { useI18n } from '../../i18n/useI18n';
import type { AnalysisResult, ProjectModel } from '../../types';
import { useModalFocus } from '../../design-system/components/modalFocus';
import { importProjectJson } from '../../utils/export';
import { formatFixed } from '../../utils/numberFormat';

export type ImportContentKey =
  | 'geometry'
  | 'supports'
  | 'loads'
  | 'results'
  | 'diagrams'
  | 'procedures'
  | 'attachments';

export type ImportMode = 'new' | 'replace';

export interface ImportContentOption {
  key: ImportContentKey;
  label: string;
  detail: string;
  available: boolean;
  selectedByDefault?: boolean;
}

export interface ImportInspection {
  kind: 'json' | 'pdf' | 'structureco';
  sourceLabel: string;
  version?: string;
  confidence: number;
  supported: boolean;
  summary: string;
  statistics: Array<{ label: string; value: number | string }>;
  warnings: string[];
  contents: ImportContentOption[];
  project?: ProjectModel;
  restoredAnalysis?: AnalysisResult;
}

export interface ImportOptions {
  mode: ImportMode;
  content: ImportContentKey[];
  saveCurrent: boolean;
}

export interface ImportOutcome {
  project: ProjectModel;
  restoredAnalysis?: AnalysisResult;
  title?: string;
  message?: string;
  statistics?: Array<{ label: string; value: number | string }>;
  warnings?: string[];
}

export interface ImportCenterAdapter {
  inspect: (file: File) => Promise<ImportInspection>;
  importFile: (file: File, inspection: ImportInspection, options: ImportOptions) => Promise<ImportOutcome>;
}

export interface ImportCenterDialogProps {
  open: boolean;
  currentProjectName: string;
  onClose: () => void;
  onImported: (outcome: ImportOutcome) => void;
  onSaveCurrent?: () => void | Promise<void>;
  adapter?: ImportCenterAdapter;
}

type ImportStage = 'select' | 'inspect' | 'content' | 'conflicts' | 'confirm' | 'result';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

const stages: Array<{ id: ImportStage; labelKey: TranslationKey }> = [
  { id: 'select', labelKey: 'importCenter.stageFile' },
  { id: 'inspect', labelKey: 'importCenter.stageInspection' },
  { id: 'content', labelKey: 'importCenter.stageContent' },
  { id: 'conflicts', labelKey: 'importCenter.stageDestination' },
  { id: 'confirm', labelKey: 'importCenter.stageConfirm' },
  { id: 'result', labelKey: 'importCenter.stageResult' },
];

const defaultContents = (project: ProjectModel, t: Translate): ImportContentOption[] => [
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
    label: t('importCenter.loads'),
    detail: t('importCenter.loadCount', {
      loads: project.nodalLoads.length + project.memberLoads.length,
      combinations: project.combinations.length,
    }),
    available: true,
    selectedByDefault: true,
  },
  { key: 'results', label: t('importCenter.results'), detail: t('importCenter.notIncludedJson'), available: false },
  { key: 'diagrams', label: t('importCenter.diagrams'), detail: t('importCenter.notIncludedJson'), available: false },
  { key: 'procedures', label: t('importCenter.procedures'), detail: t('importCenter.notIncludedJson'), available: false },
  { key: 'attachments', label: t('importCenter.attachments'), detail: t('importCenter.notIncludedJson'), available: false },
];

const classifyFile = (file: File): ImportInspection['kind'] => {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.structureco')) return 'structureco';
  return 'json';
};

const inspectWithJsonFallback = async (file: File, t: Translate): Promise<ImportInspection> => {
  const kind = classifyFile(file);
  if (kind !== 'json') {
    return {
      kind,
      sourceLabel: kind === 'pdf' ? t('importCenter.sourcePdf') : t('importCenter.sourceBundle'),
      confidence: 0,
      supported: false,
      summary: kind === 'pdf'
        ? t('importCenter.pdfUnsupportedSummary')
        : t('importCenter.bundleUnsupportedSummary'),
      statistics: [{ label: t('importCenter.size'), value: formatBytes(file.size) }],
      warnings: [t('importCenter.adapterWarning')],
      contents: [
        { key: 'geometry', label: t('importCenter.geometry'), detail: t('importCenter.pendingInspection'), available: false },
        { key: 'supports', label: t('importCenter.supports'), detail: t('importCenter.pendingInspection'), available: false },
        { key: 'loads', label: t('importCenter.loads'), detail: t('importCenter.pendingInspection'), available: false },
        { key: 'results', label: t('importCenter.results'), detail: t('importCenter.pendingInspection'), available: false },
        { key: 'diagrams', label: t('importCenter.diagrams'), detail: t('importCenter.pendingInspection'), available: false },
        { key: 'procedures', label: t('importCenter.procedures'), detail: t('importCenter.pendingInspection'), available: false },
        { key: 'attachments', label: t('importCenter.attachments'), detail: t('importCenter.pendingInspection'), available: false },
      ],
    };
  }

  const project = await importProjectJson(file);
  const loads = project.nodalLoads.length + project.memberLoads.length;
  return {
    kind,
    sourceLabel: t('importCenter.sourceJson'),
    version: String(project.schemaVersion),
    confidence: 100,
    supported: true,
    summary: t('importCenter.projectValidated', { name: project.name }),
    statistics: [
      { label: t('importCenter.nodes'), value: project.nodes.length },
      { label: t('importCenter.members'), value: project.members.length },
      { label: t('importCenter.loadStatistic'), value: loads },
      { label: t('importCenter.cases'), value: project.loadCases.length },
    ],
    warnings: project.nodes.length === 0 ? [t('importCenter.emptyNodesWarning')] : [],
    contents: defaultContents(project, t),
    project,
  };
};

const createJsonImportCenterAdapter = (t: Translate): ImportCenterAdapter => ({
  inspect: (file) => inspectWithJsonFallback(file, t),
  importFile: async (_file, inspection) => {
    if (!inspection.project) throw new Error(t('importCenter.noValidatedProject'));
    return {
      project: inspection.project,
      title: t('importCenter.readyTitle'),
      message: t('importCenter.readyMessage'),
      statistics: inspection.statistics,
      warnings: inspection.warnings,
    };
  },
});

const formatBytes =(bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatFixed((bytes / 1024), 1)} KB`;
  return `${formatFixed((bytes / (1024 * 1024)), 1)} MB`;
};

const getFileIcon = (kind?: ImportInspection['kind']) => {
  if (kind === 'pdf') return FileText;
  if (kind === 'structureco') return FileArchive;
  return FileJson;
};

export const ImportCenterDialog = ({
  open,
  currentProjectName,
  onClose,
  onImported,
  onSaveCurrent,
  adapter,
}: ImportCenterDialogProps) => {
  const { t } = useI18n();
  const activeAdapter = adapter ?? createJsonImportCenterAdapter(t);
  const [stage, setStage] = useState<ImportStage>('select');
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<ImportInspection | null>(null);
  const [selectedContent, setSelectedContent] = useState<ImportContentKey[]>([]);
  const [mode, setMode] = useState<ImportMode>('new');
  const [saveCurrent, setSaveCurrent] = useState(Boolean(onSaveCurrent));
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  /**
   * `stage === 'inspect'` covers two different waits: reading the just-selected file, and
   * committing the confirmed import. They need different copy ("Inspeccionando…" vs.
   * "Preparando el resultado…") and only the first is safe to cancel — walking away mid
   * inspection discards nothing, walking away mid commit could leave the project half
   * replaced. `busyPhase` is what tells them apart; `outcome` cannot, because it is only
   * ever set at the very end of the commit, after which the stage has already moved to
   * 'result'.
   */
  const [busyPhase, setBusyPhase] = useState<'inspecting' | 'importing' | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * Bumped on every new inspection and on cancel, so a slow, abandoned inspection can never
   * apply its result after the user has moved on to a different file — the requirement is
   * explicit: "una inspección anterior no debe reemplazar el resultado de una selección más
   * reciente". The visible flow already serializes file selection (the dropzone unmounts
   * during 'inspect'), so this is defense in depth rather than a reachable race today.
   */
  const inspectionRequestRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setStage('select');
    setFile(null);
    setInspection(null);
    setSelectedContent([]);
    setMode('new');
    setSaveCurrent(Boolean(onSaveCurrent));
    setDragging(false);
    setError(null);
    setOutcome(null);
    setBusyPhase(null);
    inspectionRequestRef.current += 1;
  }, [onSaveCurrent, open]);

  useModalFocus({
    open,
    containerRef: dialogRef,
    onEscape: onClose,
    initialFocus: (dialog) => (
      dialog.querySelector<HTMLElement>('[data-import-stage-focus="select"]')
      ?? dialog.querySelector<HTMLElement>('.import-center-close')
    ),
  });

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.querySelector<HTMLElement>(`[data-import-stage-focus="${stage}"]`)?.focus();
  }, [open, stage]);

  if (!open) return null;

  const inspectFile = async (nextFile: File) => {
    const requestId = (inspectionRequestRef.current += 1);
    setFile(nextFile);
    setInspection(null);
    setOutcome(null);
    setError(null);
    setBusyPhase('inspecting');
    setStage('inspect');
    try {
      const nextInspection = await activeAdapter.inspect(nextFile);
      if (inspectionRequestRef.current !== requestId) return;
      setInspection(nextInspection);
      setSelectedContent(nextInspection.contents.filter((item) => item.available && item.selectedByDefault !== false).map((item) => item.key));
      setBusyPhase(null);
      setStage('content');
    } catch (reason) {
      if (inspectionRequestRef.current !== requestId) return;
      setError(reason instanceof Error ? reason.message : t('importCenter.inspectError'));
      setBusyPhase(null);
      setStage('select');
    }
  };

  /** Abandons an in-flight inspection. Its eventual result, if any, is discarded on arrival. */
  const cancelInspection = () => {
    inspectionRequestRef.current += 1;
    setBusyPhase(null);
    setFile(null);
    setInspection(null);
    setError(null);
    setStage('select');
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) void inspectFile(nextFile);
  };

  const runImport = async () => {
    if (!file || !inspection) return;
    setError(null);
    setBusyPhase('importing');
    setStage('inspect');
    try {
      if (mode === 'replace' && saveCurrent && onSaveCurrent) await onSaveCurrent();
      const nextOutcome = await activeAdapter.importFile(file, inspection, { mode, content: selectedContent, saveCurrent });
      setOutcome(nextOutcome);
      setBusyPhase(null);
      setStage('result');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('importCenter.importError'));
      setBusyPhase(null);
      setStage('confirm');
    }
  };

  const activeIndex = stages.findIndex((item) => item.id === stage);
  const FileIcon = getFileIcon(inspection?.kind ?? (file ? classifyFile(file) : undefined));
  const onModeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const options = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('.import-mode-options [role="radio"]:not(:disabled)') ?? [])];
    const index = options.indexOf(event.currentTarget);
    if (index < 0 || options.length === 0) return;
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % options.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + options.length) % options.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = options.length - 1;
    else return;
    event.preventDefault();
    const next = options[nextIndex];
    const nextMode = next.dataset.importMode;
    if (nextMode === 'new' || nextMode === 'replace') setMode(nextMode);
    next.focus();
  };

  return (
    <div className="import-center-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="import-center-dialog" role="dialog" aria-modal="true" aria-labelledby="import-center-title" aria-describedby="import-center-subtitle">
        <header className="import-center-header">
          <div>
            <p className="import-center-eyebrow">{t('importCenter.eyebrow')}</p>
            <h2 id="import-center-title">{t('importCenter.title')}</h2>
            <p id="import-center-subtitle">{t('importCenter.subtitle')}</p>
          </div>
          <button type="button" className="import-center-close" aria-label={t('importCenter.close')} onClick={onClose}><X size={20} /></button>
        </header>

        <nav className="import-center-steps" aria-label={t('importCenter.progress')}>
          {stages.map((item, index) => (
            <span key={item.id} className={index === activeIndex ? 'active' : index < activeIndex ? 'complete' : ''} aria-current={index === activeIndex ? 'step' : undefined}>
              <i>{index < activeIndex ? <Check size={12} /> : index + 1}</i><em>{t(item.labelKey)}</em>
            </span>
          ))}
        </nav>

        <div className="import-center-body">
          {stage === 'select' ? (
            <section className="import-center-section" aria-labelledby="import-select-title">
              <div className="import-section-heading"><p>{t('importCenter.step', { step: 1 })}</p><h3 id="import-select-title">{t('importCenter.selectTitle')}</h3><span>{t('importCenter.selectFormats')}</span></div>
              <div
                className={`import-dropzone ${dragging ? 'dragging' : ''}`}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
                onDrop={handleDrop}
              >
                <span className="import-dropzone-icon"><Upload size={26} /></span>
                <strong>{t('importCenter.dropTitle')}</strong>
                <span>{t('importCenter.dropHint')}</span>
                <button type="button" data-import-stage-focus="select" onClick={() => fileInputRef.current?.click()}>{t('importCenter.chooseFile')}</button>
                <input
                  ref={fileInputRef}
                  className="import-file-input"
                  type="file"
                  tabIndex={-1}
                  accept="application/json,application/pdf,.json,.pdf,.structureco,.structureco.json"
                  aria-label={t('importCenter.fileInput')}
                  onChange={(event) => {
                    const nextFile = event.currentTarget.files?.[0];
                    if (nextFile) void inspectFile(nextFile);
                    event.currentTarget.value = '';
                  }}
                />
              </div>
              <div className="import-format-grid" aria-label={t('importCenter.formatsLabel')}>
                <article><FileJson size={19} /><div><strong>{t('importCenter.jsonTitle')}</strong><span>{t('importCenter.jsonDetail')}</span></div><b>{t('importCenter.available')}</b></article>
                <article><FileText size={19} /><div><strong>{t('importCenter.pdfTitle')}</strong><span>{t('importCenter.pdfDetail')}</span></div><b>{t('importCenter.withAdapter')}</b></article>
                <article><FileArchive size={19} /><div><strong>{t('importCenter.bundleTitle')}</strong><span>{t('importCenter.bundleDetail')}</span></div><b>{t('importCenter.withAdapter')}</b></article>
              </div>
            </section>
          ) : null}

          {stage === 'inspect' ? (
            <section className="import-center-loading" aria-live="polite">
              <LoaderCircle className="spin" size={31} />
              <h3 tabIndex={-1} data-import-stage-focus="inspect">{busyPhase === 'importing' ? t('importCenter.loadingResult') : t('importCenter.loadingInspect')}</h3>
              <p>{busyPhase === 'importing' ? t('importCenter.loadingImportingBody') : t('importCenter.loadingBody')}</p>
            </section>
          ) : null}

          {stage === 'content' && file && inspection ? (
            <section className="import-center-section" aria-labelledby="import-content-title">
              <div className="import-file-summary">
                <span className="import-file-icon"><FileIcon size={26} /></span>
                <div><strong>{file.name}</strong><span>{inspection.sourceLabel} · {formatBytes(file.size)}{inspection.version ? ` · ${t('importCenter.schema', { version: inspection.version })}` : ''}</span></div>
                <span className={`import-confidence ${inspection.confidence >= 80 ? 'high' : inspection.confidence > 0 ? 'medium' : 'unknown'}`}>{inspection.confidence > 0 ? t('importCenter.confidence', { confidence: inspection.confidence }) : t('importCenter.reviewPending')}</span>
              </div>
              <div className="import-section-heading"><p>{t('importCenter.step', { step: 3 })}</p><h3 id="import-content-title" tabIndex={-1} data-import-stage-focus="content">{t('importCenter.contentTitle')}</h3><span>{inspection.summary}</span></div>
              {inspection.statistics.length ? <dl className="import-stat-grid">{inspection.statistics.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl> : null}
              {inspection.warnings.length ? <div className="import-warning-list" role="status">{inspection.warnings.map((warning) => <p key={warning}><AlertTriangle size={16} />{warning}</p>)}</div> : null}
              <fieldset className="import-content-list">
                <legend className="sr-only">{t('importCenter.contentLegend')}</legend>
                {inspection.contents.map((item) => {
                  const checked = selectedContent.includes(item.key);
                  return (
                    <label key={item.key} className={item.available ? '' : 'unavailable'}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!item.available}
                        onChange={() => setSelectedContent((current) => checked ? current.filter((key) => key !== item.key) : [...current, item.key])}
                      />
                      <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                      <em>{item.available ? (checked ? t('importCenter.include') : t('importCenter.omit')) : t('importCenter.notDetected')}</em>
                    </label>
                  );
                })}
              </fieldset>
              {!inspection.supported ? <div className="import-blocked-message" role="alert"><AlertTriangle size={18} /><span><strong>{t('importCenter.portableRequired')}</strong>{inspection.summary}</span></div> : null}
            </section>
          ) : null}

          {stage === 'conflicts' && inspection ? (
            <section className="import-center-section" aria-labelledby="import-destination-title">
              <div className="import-section-heading"><p>{t('importCenter.step', { step: 4 })}</p><h3 id="import-destination-title" tabIndex={-1} data-import-stage-focus="conflicts">{t('importCenter.destinationTitle')}</h3><span>{t('importCenter.currentProject', { name: currentProjectName })}</span></div>
              <div className="import-mode-options" role="radiogroup" aria-label={t('importCenter.destinationLabel')}>
                <button type="button" role="radio" aria-checked={mode === 'new'} tabIndex={mode === 'new' ? 0 : -1} data-import-mode="new" className={mode === 'new' ? 'selected' : ''} onClick={() => setMode('new')} onKeyDown={onModeKeyDown}>
                  <span className="import-radio" /><span><strong>{t('importCenter.newModeTitle')}</strong><small>{t('importCenter.newModeDescription')}</small></span><b>{t('importCenter.recommended')}</b>
                </button>
                <button type="button" role="radio" aria-checked={mode === 'replace'} tabIndex={mode === 'replace' ? 0 : -1} data-import-mode="replace" className={mode === 'replace' ? 'selected danger' : ''} onClick={() => setMode('replace')} onKeyDown={onModeKeyDown}>
                  <span className="import-radio" /><span><strong>{t('importCenter.replaceModeTitle')}</strong><small>{t('importCenter.replaceModeDescription')}</small></span>
                </button>
                <button type="button" role="radio" aria-checked="false" disabled aria-describedby="merge-import-help">
                  <span className="import-radio" /><span><strong>{t('importCenter.mergeModeTitle')}</strong></span>
                </button>
              </div>
              <p id="merge-import-help" className="field-help">{t('importCenter.mergeHelp')}</p>
              {mode === 'replace' ? (
                <label className={`import-save-option ${onSaveCurrent ? '' : 'disabled'}`}>
                  <input type="checkbox" checked={saveCurrent && Boolean(onSaveCurrent)} disabled={!onSaveCurrent} onChange={(event) => setSaveCurrent(event.currentTarget.checked)} />
                  <Save size={19} />
                  <span><strong>{t('importCenter.saveCopyTitle')}</strong><small>{onSaveCurrent ? t('importCenter.saveCopyAvailable') : t('importCenter.saveCopyUnavailable')}</small></span>
                </label>
              ) : null}
            </section>
          ) : null}

          {stage === 'confirm' && file && inspection ? (
            <section className="import-center-section" aria-labelledby="import-confirm-title">
              <div className="import-section-heading"><p>{t('importCenter.step', { step: 5 })}</p><h3 id="import-confirm-title" tabIndex={-1} data-import-stage-focus="confirm">{t('importCenter.confirmTitle')}</h3><span>{t('importCenter.confirmDescription')}</span></div>
              <div className="import-confirm-card">
                <div><FileIcon size={24} /><span><strong>{file.name}</strong><small>{inspection.sourceLabel} · {formatBytes(file.size)}</small></span></div>
                <dl>
                  <div><dt>{t('importCenter.destinationTerm')}</dt><dd>{mode === 'new' ? t('importCenter.newProject') : t('importCenter.replaceProject', { name: currentProjectName })}</dd></div>
                  <div><dt>{t('importCenter.contentTerm')}</dt><dd>{t('importCenter.contentCount', { selected: selectedContent.length, total: inspection.contents.filter((item) => item.available).length })}</dd></div>
                  <div><dt>{t('importCenter.previousCopyTerm')}</dt><dd>{mode === 'replace' && saveCurrent && onSaveCurrent ? t('importCenter.downloadJson') : t('importCenter.notNeeded')}</dd></div>
                </dl>
              </div>
              <div className="import-safety-note"><ShieldCheck size={20} /><span><strong>{t('importCenter.reversibleTitle')}</strong>{t('importCenter.reversibleBody')}</span></div>
            </section>
          ) : null}

          {stage === 'result' && outcome ? (
            <section className="import-center-result" aria-labelledby="import-result-title" aria-live="polite">
              <span className="import-result-icon"><CheckCircle2 size={32} /></span>
              <p>{t('importCenter.step', { step: 6 })}</p>
              <h3 id="import-result-title" tabIndex={-1} data-import-stage-focus="result">{outcome.title ?? t('importCenter.completedTitle')}</h3>
              <span>{outcome.message ?? t('importCenter.completedBody')}</span>
              {outcome.statistics?.length ? <dl className="import-stat-grid">{outcome.statistics.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl> : null}
              {outcome.warnings?.length ? <div className="import-warning-list">{outcome.warnings.map((warning) => <p key={warning}><AlertTriangle size={16} />{warning}</p>)}</div> : null}
            </section>
          ) : null}

          {error ? <div className="import-error-message" role="alert"><AlertTriangle size={18} /><span><strong>{t('importCenter.errorTitle')}</strong>{error}</span></div> : null}
        </div>

        <footer className="import-center-footer">
          <button type="button" className="import-button-secondary" onClick={() => {
            if (stage === 'inspect') { if (busyPhase === 'inspecting') cancelInspection(); return; }
            if (stage === 'select' || stage === 'result') onClose();
            else if (stage === 'content') setStage('select');
            else if (stage === 'conflicts') setStage('content');
            else if (stage === 'confirm') setStage('conflicts');
          }} disabled={stage === 'inspect' && busyPhase !== 'inspecting'}>
            {stage === 'select' || stage === 'result' || (stage === 'inspect' && busyPhase === 'inspecting') ? <X size={17} /> : <ArrowLeft size={17} />}
            {stage === 'select' || (stage === 'inspect' && busyPhase === 'inspecting') ? t('importCenter.cancel') : stage === 'result' ? t('importCenter.closeAction') : t('importCenter.back')}
          </button>
          {stage === 'content' ? <button type="button" className="import-button-primary" disabled={!inspection?.supported || selectedContent.length === 0} onClick={() => setStage('conflicts')}>{t('importCenter.continue')} <ArrowRight size={17} /></button> : null}
          {stage === 'conflicts' ? <button type="button" className="import-button-primary" onClick={() => setStage('confirm')}>{t('importCenter.review')} <ArrowRight size={17} /></button> : null}
          {stage === 'confirm' ? <button type="button" className="import-button-primary" onClick={() => void runImport()}><Upload size={17} /> {t('importCenter.importNow')}</button> : null}
          {stage === 'result' ? <button type="button" className="import-button-primary" onClick={() => onImported(outcome!)}>{t('importCenter.openProject')} <ArrowRight size={17} /></button> : null}
        </footer>
      </div>
    </div>
  );
};
