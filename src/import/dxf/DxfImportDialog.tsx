import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileUp, ShieldCheck } from 'lucide-react';
import { Dialog } from '../../design-system/components/overlays';
import { Button } from '../../design-system/components/controls';
import { useProject } from '../../store/ProjectContext';
import { getProjectRepository, type ProjectRepository } from '../../storage/projectRepository';
import { usePhase2I18n } from '../../i18n/usePhase2I18n';
import { useI18n } from '../../i18n/useI18n';
import {
  buildDxfImportCommand,
  parseAsciiDxf,
  sourceUnitFromInsUnits,
  type DxfInspection,
  type DxfSourceUnit,
} from './dxfParser';
import './dxfImport.css';

export interface DxfImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  repository?: ProjectRepository;
  readFile?: (file: File) => Promise<string>;
}

const UNIT_OPTIONS: Array<{ value: DxfSourceUnit; label: string }> = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'm', label: 'm' },
  { value: 'in', label: 'in' },
  { value: 'ft', label: 'ft' },
  { value: 'us-ft', label: 'US survey ft' },
];

const previewGeometry = (inspection: DxfInspection | null) => {
  if (!inspection?.segments.length) return null;
  const points = inspection.segments.flatMap((segment) => [segment.start, segment.end]);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(maxX - minX, 1e-9);
  const height = Math.max(maxY - minY, 1e-9);
  const scale = Math.min(500 / width, 220 / height);
  return inspection.segments.map((segment) => ({
    ...segment,
    x1: 30 + (segment.start.x - minX) * scale,
    y1: 250 - (segment.start.y - minY) * scale,
    x2: 30 + (segment.end.x - minX) * scale,
    y2: 250 - (segment.end.y - minY) * scale,
  }));
};

export const DxfImportDialog = ({
  open,
  onOpenChange,
  onImported,
  repository,
  readFile = (file) => file.text(),
}: DxfImportDialogProps) => {
  const { project, executeProjectCommand } = useProject();
  const { language, t: baseT } = useI18n();
  const { t } = usePhase2I18n(language);
  const [inspection, setInspection] = useState<DxfInspection | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [sourceUnit, setSourceUnit] = useState<DxfSourceUnit | ''>('');
  const [templateMemberId, setTemplateMemberId] = useState(project.members[0]?.id ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const geometry = useMemo(() => previewGeometry(inspection), [inspection]);

  useEffect(() => {
    if (!project.members.some((member) => member.id === templateMemberId)) setTemplateMemberId(project.members[0]?.id ?? '');
  }, [project.members, templateMemberId]);

  useEffect(() => {
    if (!open) {
      setInspection(null);
      setSourceName('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  const inspectFile = async (file: File | undefined) => {
    setInspection(null);
    setError('');
    setSourceName(file?.name ?? '');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.dxf')) {
      setError(t('dxf.extensionError'));
      return;
    }
    try {
      const text = await readFile(file);
      if (text.includes('\0')) throw new Error(t('dxf.asciiOnly'));
      const next = parseAsciiDxf(text);
      setInspection(next);
      setSourceUnit(sourceUnitFromInsUnits(next.insertionUnits) ?? '');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('dxf.readError'));
    }
  };

  const confirm = async () => {
    if (!inspection?.canImport || !templateMemberId || !sourceUnit || busy) return;
    setBusy(true);
    setError('');
    try {
      const command = buildDxfImportCommand(project, inspection, { sourceName, sourceUnit, templateMemberId });
      await (repository ?? getProjectRepository()).createRecovery(project, 'dxf-import');
      await executeProjectCommand(command);
      onImported();
      onOpenChange(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('dxf.importError'));
    } finally {
      setBusy(false);
    }
  };

  const countLabel = inspection
    ? t(inspection.counts.accepted === 1 ? 'dxf.countOne' : 'dxf.countMany', { accepted: inspection.counts.accepted, rejected: inspection.counts.rejected })
    : '';

  return <Dialog
    open={open}
    onOpenChange={onOpenChange}
    title={t('dxf.title')}
    description={t('dxf.description')}
    closeLabel={baseT('toolbar.close')}
    className="dxf-import-dialog"
    footer={<>
      <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('dxf.cancel')}</Button>
      <Button variant="primary" loading={busy} loadingLabel={t('dxf.importing')} disabled={!inspection?.canImport || !templateMemberId || !sourceUnit} onClick={() => void confirm()}>{t('dxf.confirm')}</Button>
    </>}
  >
    <div className="dxf-experimental-note"><AlertTriangle size={18} /><span><strong>{t('dxf.experimental')}</strong>{t('dxf.subset')}</span></div>
    <label className="dxf-file-field">
      <span>{t('dxf.file')}</span>
      <input type="file" accept=".dxf,text/plain,application/dxf" onChange={(event) => void inspectFile(event.target.files?.[0])} />
    </label>

    {inspection ? <>
      <div className="dxf-import-controls">
        <label><span>{t('dxf.sourceUnit')}</span><select value={sourceUnit} onChange={(event) => setSourceUnit(event.target.value as DxfSourceUnit | '')}>
          <option value="" disabled>{t('dxf.selectUnit')}</option>
          {UNIT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select></label>
        <label><span>{t('dxf.template')}</span><select value={templateMemberId} onChange={(event) => setTemplateMemberId(event.target.value)} disabled={!project.members.length}>
          {!project.members.length ? <option value="">{t('dxf.noTemplate')}</option> : null}
          {project.members.map((member) => <option value={member.id} key={member.id}>{member.id}{member.label ? ` · ${member.label}` : ''}</option>)}
        </select></label>
      </div>
      <div className="dxf-preview-summary">
        <strong>{countLabel}</strong>
        <span>{t('dxf.layers')}: {inspection.layers.length ? inspection.layers.join(', ') : '—'}</span>
        <small>{t('dxf.header', { version: inspection.acadVersion ?? '—', units: inspection.insertionUnits ?? '—' })}</small>
      </div>
      {geometry ? <svg className="dxf-preview" viewBox="0 0 560 280" role="img" aria-label={t('dxf.preview')}>
        <rect x="1" y="1" width="558" height="278" rx="12" />
        {geometry.map((segment) => <line key={segment.id} x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} />)}
      </svg> : null}
      {inspection.diagnostics.length ? <ul className="dxf-diagnostics" aria-label={t('dxf.diagnostics')}>
        {inspection.diagnostics.map((diagnostic, index) => <li className={diagnostic.severity} key={`${diagnostic.code}-${diagnostic.line ?? index}`}><AlertTriangle size={15} /><span>{diagnostic.message}</span></li>)}
      </ul> : null}
      {!project.members.length ? <p className="dxf-blocking-message" role="alert">{t('dxf.templateRequired')}</p> : null}
      <div className="dxf-recovery-note"><ShieldCheck size={17} /><span>{t('dxf.recovery')}</span></div>
    </> : <div className="dxf-empty-state"><FileUp size={28} /><p>{t('dxf.chooseFile')}</p></div>}
    {error ? <p className="dxf-blocking-message" role="alert">{error}</p> : null}
  </Dialog>;
};
