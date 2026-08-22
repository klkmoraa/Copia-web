import { useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Lightbulb,
  LocateFixed,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { Button } from '../../design-system/components/controls';
import { projectCommandSnapshot } from '../../commands/projectCommand';
import { Drawer } from '../../design-system/components/overlays';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import type { SurfaceExtent, SurfacePresentation } from '../workspace/surfacePresentation';
import { buildModelDoctorReport, type ModelDoctorFinding, type ModelDoctorSeverity } from './modelDoctorDiagnostics';
import { getModelDoctorCopy } from './modelDoctorCopy';
import { presentModelDoctorFinding } from './modelDoctorPresentation';
import { prepareTopologyRepair, type TopologyRepairPreview } from './topologyRepairPreview';
import './modelDoctor.css';

export interface ModelDoctorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSurfaceReady?: (ready: boolean) => void;
  acknowledgedIds?: ReadonlySet<string>;
  onAcknowledgedIdsChange?: (ids: Set<string>) => void;
  /** Test seam for proving the lazy surface does not diagnose while unmounted. */
  buildReport?: typeof buildModelDoctorReport;
  returnFocusTo?: HTMLElement | null;
  presentation?: Extract<SurfacePresentation, 'drawer' | 'fullscreen'>;
  /** `default` | `peek` (CRI-102). The broker owns this; the panel only renders it. */
  extent?: SurfaceExtent;
  /** Degrades to `peek` instead of closing — "Localizar" never closes the Doctor. */
  onPeek?: () => void;
  /** Restores from `peek` back to `default`. */
  onRestore?: () => void;
}

type FindingFilter = 'all' | ModelDoctorSeverity;

const SEVERITY_ICONS = {
  critical: ShieldAlert,
  warning: CircleAlert,
  suggestion: Lightbulb,
};

const technicalValue = (value: unknown): string => {
  if (value === undefined) return '—';
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (typeof value === 'object' && value !== null) {
    return `{ ${Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}=${technicalValue(item)}`).join(', ')} }`;
  }
  return String(value);
};

const referenceLabel = (value: unknown, empty: string, copy: ReturnType<typeof getModelDoctorCopy>): string => {
  if (!value || typeof value !== 'object') return empty;
  const entity = value as Record<string, unknown>;
  const fields = (names: string[]) => names
    .filter((name) => Object.prototype.hasOwnProperty.call(entity, name))
    .map((name) => `${copy.previewField[name as keyof typeof copy.previewField] ?? name}=${technicalValue(entity[name])}`)
    .join('; ');
  if (typeof entity.nodeId === 'string') return fields(['nodeId', 'caseId', 'component', 'value', 'fx', 'fy', 'mz']);
  if (typeof entity.memberId === 'string') {
    return fields([
      'memberId', 'caseId', 'type', 'coordinateSystem', 'lengthBasis', 'start', 'end', 'position',
      'px', 'py', 'moment', 'qxStart', 'qxEnd', 'qyStart', 'qyEnd',
      'alpha', 'deltaT', 'gradient', 'axialStrain', 'curvature',
    ]);
  }
  if (typeof entity.x === 'number' && typeof entity.y === 'number') return fields(['x', 'y', 'support', 'internalHinge']);
  if (typeof entity.i === 'string' && typeof entity.j === 'string') return fields([
    'i', 'j', 'type', 'releases', 'rotationalSpringI', 'rotationalSpringJ', 'rigidOffsetI', 'rigidOffsetJ',
  ]);
  return empty;
};

const RepairPreview = ({
  preview,
  stale,
  applying,
  error,
  copy,
  onRegenerate,
  onApply,
  onCancel,
}: {
  preview: TopologyRepairPreview;
  stale: boolean;
  applying: boolean;
  error: string;
  copy: ReturnType<typeof getModelDoctorCopy>;
  onRegenerate: () => void;
  onApply: () => void;
  onCancel: () => void;
}) => {
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => backRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const referenceGroups = [
    [copy.objectKind.nodalLoad, preview.changes.nodalLoads],
    [copy.objectKind.memberLoad, preview.changes.memberLoads],
    [copy.previewPrescribed, preview.changes.prescribedDisplacements],
    [copy.previewInitialEffect, preview.changes.memberInitialEffects],
  ] as const;
  return <section className="model-doctor-preview" aria-labelledby="model-doctor-preview-title">
    <div className="model-doctor-preview__heading">
      <button ref={backRef} type="button" className="model-doctor-preview__back" onClick={onCancel} aria-label={copy.previewCancel}>
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <div>
        <h3 id="model-doctor-preview-title">{copy.previewTitle}</h3>
        <p>{copy.previewDescription}</p>
      </div>
    </div>

    {stale ? <div className="model-doctor-preview__stale" role="alert">
      <strong>{copy.previewStaleTitle}</strong>
      <p>{copy.previewStaleBody}</p>
    </div> : null}
    {error ? <p className="model-doctor-preview__error" role="alert">{error}</p> : null}

    {!preview.hasChanges ? <p className="model-doctor-preview__empty">{copy.previewNone}</p> : null}
    {preview.hasChanges || preview.changes.skippedCoincidentPairs.length || preview.changes.unresolvedTopology.length ? <div className="model-doctor-preview__groups">
      {preview.changes.mergedNodes.length ? <section>
        <h4>{copy.previewMerge}</h4>
        <ul>{preview.changes.mergedNodes.map((merge) => <li key={`${merge.keptNodeId}-${merge.removedNodeId}`}>
          <strong>{merge.removedNodeId} → {merge.keptNodeId}</strong>
          <span>{copy.previewKeepRemove(merge.keptNodeId, merge.removedNodeId)}</span>
          {projectCommandSnapshot(merge.keptBefore.support) !== projectCommandSnapshot(merge.keptAfter.support)
            ? <small>{copy.previewSupport}: {technicalValue(merge.keptBefore.support)} → {technicalValue(merge.keptAfter.support)}</small> : null}
          {!merge.keptBefore.internalHinge && merge.keptAfter.internalHinge ? <small>{copy.previewInternalHingePreserved}</small> : null}
        </li>)}</ul>
      </section> : null}

      {preview.changes.splitMembers.length ? <section>
        <h4>{copy.previewSplit}</h4>
        <ul>{preview.changes.splitMembers.map((split) => <li key={split.originalMember.id}>
          <strong>{split.originalMember.id}: {split.originalMember.i}–{split.originalMember.j}</strong>
          <span>{copy.previewSplitResult(
            split.originalMember.id,
            split.resultingMembers.map((member) => `${member.id} (${member.i}–${member.j})`).join(', '),
            split.splitNodeIds.join(', '),
          )}</span>
          <small>{split.resultingMembers.map((member) => [
            member.releases?.iMoment ? copy.previewRelease(member.id, 'i') : '',
            member.releases?.jMoment ? copy.previewRelease(member.id, 'j') : '',
            member.rotationalSpringI !== undefined ? `${member.id} kθi=${member.rotationalSpringI}` : '',
            member.rotationalSpringJ !== undefined ? `${member.id} kθj=${member.rotationalSpringJ}` : '',
            member.rigidOffsetI ? copy.previewOffset(member.id, 'i', member.rigidOffsetI) : '',
            member.rigidOffsetJ ? copy.previewOffset(member.id, 'j', member.rigidOffsetJ) : '',
          ].filter(Boolean).join(' · ')).filter(Boolean).join(' · ')}</small>
        </li>)}</ul>
      </section> : null}

      {preview.changes.members.length ? <section>
        <h4>{copy.previewMembers}</h4>
        <ul>{preview.changes.members.map((change) => <li key={`member-${change.id}`}>
          <span>{copy.previewMemberChange(
            change.id,
            referenceLabel(change.before, copy.previewCreated, copy),
            referenceLabel(change.after, copy.previewRemoved, copy),
          )}</span>
        </li>)}</ul>
      </section> : null}

      {preview.changes.nodes.length ? <section>
        <h4>{copy.previewNodes}</h4>
        <ul>{preview.changes.nodes.map((change) => <li key={`node-${change.id}`}>
          <strong>{copy.objectKind.node} {change.id}</strong>
          <span>{referenceLabel(change.before, copy.previewCreated, copy)} → {referenceLabel(change.after, copy.previewRemoved, copy)}</span>
        </li>)}</ul>
      </section> : null}

      {referenceGroups.some(([, changes]) => changes.length) ? <section>
        <h4>{copy.previewReferences}</h4>
        <ul>{referenceGroups.flatMap(([kind, changes]) => changes.map((change) => <li key={`${kind}-${change.id}-${change.disposition}`}>
          <strong>{kind} {change.id}</strong>
          <span>{referenceLabel(change.before, copy.previewCreated, copy)} → {referenceLabel(change.after, copy.previewRemoved, copy)}</span>
          {change.disposition ? <small>{copy.previewDisposition[change.disposition]}</small> : null}
        </li>))}</ul>
      </section> : null}
      {preview.changes.skippedCoincidentPairs.length ? <section>
        <h4>{copy.previewSkipped}</h4>
        <ul>{preview.changes.skippedCoincidentPairs.map((pair) => <li key={`${pair.firstNodeId}-${pair.secondNodeId}`}>
          <strong>{pair.firstNodeId} ↔ {pair.secondNodeId}</strong>
          <span>{copy.previewSkippedPair(pair.firstNodeId, pair.secondNodeId)}</span>
        </li>)}</ul>
      </section> : null}
      {preview.changes.unresolvedTopology.length ? <section>
        <h4>{copy.previewUnresolved}</h4>
        <ul>{preview.changes.unresolvedTopology.map((finding) => {
          const presented = presentModelDoctorFinding(finding, preview.prepared.repairedProject.settings.language);
          const objects = finding.affectedObjects.map((object) => object.id).join(' · ');
          return <li key={`unresolved-${finding.id}`}>
            <strong>{objects || presented.title}</strong>
            <span>{presented.explanation}</span>
            <small>{copy.previewUnresolvedAction}</small>
          </li>;
        })}</ul>
      </section> : null}
    </div> : null}

    <footer className="model-doctor-preview__actions">
      {stale ? <Button size="touch" onClick={onRegenerate}>{copy.previewRegenerate}</Button> : null}
      <Button size="touch" variant="ghost" onClick={onCancel}>{copy.previewCancel}</Button>
      <Button
        size="touch"
        variant="primary"
        disabled={stale || !preview.hasChanges}
        loading={applying}
        loadingLabel={copy.previewApplying}
        onClick={onApply}
      >{copy.previewApply}</Button>
    </footer>
  </section>;
};

export const ModelDoctor = ({
  open,
  onOpenChange,
  onSurfaceReady,
  acknowledgedIds,
  onAcknowledgedIdsChange,
  buildReport = buildModelDoctorReport,
  returnFocusTo,
  presentation = 'drawer',
  extent = 'default',
  onPeek,
  onRestore,
}: ModelDoctorProps) => {
  const { project, executePreparedTopologyRepair } = useProjectModel();
  const { setActiveTool, setSelection } = useWorkspaceUI();
  const copy = getModelDoctorCopy(project.settings.language);
  const report = useMemo(() => buildReport(project), [buildReport, project]);
  const [filter, setFilter] = useState<FindingFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [localAcknowledged, setLocalAcknowledged] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<TopologyRepairPreview | null>(null);
  const [repairError, setRepairError] = useState('');
  const [applyingRepair, setApplyingRepair] = useState(false);
  const [repairApplied, setRepairApplied] = useState(false);
  const [previewReturnId, setPreviewReturnId] = useState<string | null>(null);
  const appliedStatusRef = useRef<HTMLParagraphElement>(null);
  const idScope = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const acknowledged = acknowledgedIds ?? localAcknowledged;
  useEffect(() => {
    const current = new Set(report.findings.map((finding) => finding.id));
    setExpanded((previous) => new Set([...previous].filter((id) => current.has(id))));
    const nextAcknowledged = new Set([...acknowledged].filter((id) => current.has(id)));
    if (onAcknowledgedIdsChange) onAcknowledgedIdsChange(nextAcknowledged);
    else setLocalAcknowledged(nextAcknowledged);
    // Los IDs estables del reporte, no la identidad de un Set controlado,
    // determinan cuándo hay que depurar reconocimientos que ya no existen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  useEffect(() => {
    if (preview || !previewReturnId) return;
    const timer = window.setTimeout(() => {
      const returnTarget = document.getElementById(previewReturnId);
      if (returnTarget instanceof HTMLElement) returnTarget.focus();
      setPreviewReturnId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [preview, previewReturnId]);

  useEffect(() => {
    if (!repairApplied || preview) return undefined;
    const timer = window.setTimeout(() => appliedStatusRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [preview, repairApplied]);

  const visible = filter === 'all'
    ? report.findings
    : report.findings.filter((finding) => finding.severity === filter);

  const toggleInSet = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) => {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAcknowledged = (id: string) => {
    const next = new Set(acknowledged);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (onAcknowledgedIdsChange) onAcknowledgedIdsChange(next);
    else setLocalAcknowledged(next);
  };

  const locate = (finding: ModelDoctorFinding) => {
    const target = finding.target;
    if (!target) return;
    setSelection(target);
    // Localizar degrada a `peek`, nunca cierra (CRI-102 / D-11): la lista de
    // hallazgos y el hallazgo activo siguen montados exactamente como estaban.
    onPeek?.();
    window.requestAnimationFrame(() => emitWorkspaceCommand('focus-object', target));
  };

  const openRepairPreview = (returnId?: string) => {
    try {
      if (returnId) setPreviewReturnId(returnId);
      setPreview(prepareTopologyRepair(project));
      setRepairError('');
      setRepairApplied(false);
    } catch (cause) {
      setRepairError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const previewStale = preview !== null
    && projectCommandSnapshot(project) !== preview.prepared.command.sourceSnapshot;
  const applyRepair = async () => {
    if (!preview || previewStale) return;
    setApplyingRepair(true);
    setRepairError('');
    try {
      await executePreparedTopologyRepair(preview.prepared);
      setPreview(null);
      setPreviewReturnId(null);
      setRepairApplied(true);
    } catch (cause) {
      setRepairError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setApplyingRepair(false);
    }
  };

  const filters: ReadonlyArray<{ value: FindingFilter; label: string; count: number }> = [
    { value: 'all', label: copy.all, count: report.total },
    { value: 'critical', label: copy.critical, count: report.counts.critical },
    { value: 'warning', label: copy.warning, count: report.counts.warning },
    { value: 'suggestion', label: copy.suggestion, count: report.counts.suggestion },
  ];

  return <Drawer
    open={open}
    onOpenChange={onOpenChange}
    title="Model Doctor"
    description={copy.description}
    closeLabel={copy.close}
    side="right"
    presentation={presentation}
    className="model-doctor-surface"
    returnFocusTo={returnFocusTo}
    restoreFocus={!onSurfaceReady}
    surfaceId="doctor"
    onSurfaceReady={onSurfaceReady}
    extent={extent}
    onRestore={onRestore}
    restoreLabel={copy.restore}
  >
    {preview ? <RepairPreview
      preview={preview}
      stale={previewStale}
      applying={applyingRepair}
      error={repairError}
      copy={copy}
      onRegenerate={() => openRepairPreview()}
      onApply={() => { void applyRepair(); }}
      onCancel={() => { setPreview(null); setRepairError(''); }}
    /> : <><section className="model-doctor-health" aria-label={copy.healthLabel}>
      <div className="model-doctor-health__icon" aria-hidden="true"><ShieldAlert size={22} /></div>
      <div>
        <strong>{copy.summary(report.counts.critical, report.counts.warning, report.counts.suggestion)}</strong>
        <span>{report.total === 0 ? copy.allClearBody : copy.description}</span>
      </div>
    </section>

    {repairApplied ? <p ref={appliedStatusRef} className="model-doctor-repair-applied" role="status" tabIndex={-1}><CheckCircle2 size={16} aria-hidden="true" /> {copy.repairApplied}</p> : null}
    {repairError ? <p className="model-doctor-preview__error" role="alert">{repairError}</p> : null}
    {report.total === 0 ? <section className="model-doctor-all-clear">
      <CheckCircle2 size={32} aria-hidden="true" />
      <div>
        <h3>{copy.allClearTitle}</h3>
        <p>{copy.allClearBody}</p>
      </div>
    </section> : <>
      <div className="model-doctor-filters" role="group" aria-label={copy.filtersLabel}>
        {filters.map((item) => <button
          type="button"
          key={item.value}
          aria-pressed={filter === item.value}
          onClick={() => setFilter(item.value)}
        >{item.label} <span>{item.count}</span></button>)}
      </div>

      <div className="model-doctor-findings">
        {visible.length === 0 ? <p className="model-doctor-empty-filter">{copy.noFiltered}</p> : null}
        {visible.map((finding) => {
          const Icon = SEVERITY_ICONS[finding.severity];
          const isExpanded = expanded.has(finding.id);
          const isAcknowledged = acknowledged.has(finding.id);
          const safeFindingId = Array.from(finding.id, (character) => character.codePointAt(0)!.toString(16)).join('-');
          const titleId = `model-doctor-${idScope}-title-${safeFindingId}`;
          const severityId = `model-doctor-${idScope}-severity-${safeFindingId}`;
          const detailId = `model-doctor-${idScope}-detail-${safeFindingId}`;
          const previewActionId = `model-doctor-${idScope}-preview-${safeFindingId}`;
          const presented = presentModelDoctorFinding(finding, project.settings.language);
          const affectedLabel = finding.affectedObjects
            .map((object) => object.kind ? `${copy.objectKind[object.kind]} ${object.id}` : object.id)
            .join(' · ');
          return <article
            key={finding.id}
            className={`model-doctor-finding model-doctor-finding--${finding.severity}${isAcknowledged ? ' is-acknowledged' : ''}`}
            aria-labelledby={`${severityId} ${titleId}`}
          >
            <header className="model-doctor-finding__header">
              <span className="model-doctor-finding__severity" aria-hidden="true"><Icon size={18} /></span>
              <div>
                <span id={severityId} className="model-doctor-finding__eyebrow">{copy.severity[finding.severity]} · {copy.category[finding.category]}</span>
                <h3 id={titleId}>{presented.title}</h3>
              </div>
            </header>

            <p>{presented.explanation}</p>
            {finding.affectedObjects.length ? <p className="model-doctor-finding__objects">
              <strong>{copy.affected}:</strong> {affectedLabel}
            </p> : null}

            <button
              type="button"
              className="model-doctor-explain"
              aria-label={`${isExpanded ? copy.collapse : copy.explain}: ${presented.title}`}
              aria-expanded={isExpanded}
              aria-controls={detailId}
              onClick={() => toggleInSet(setExpanded, finding.id)}
            >
              {isExpanded ? copy.collapse : copy.explain}
              {isExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </button>

            {isExpanded ? <div id={detailId} className="model-doctor-finding__detail">
              <section><h4>{copy.detected}</h4><p>{presented.explanation}</p></section>
              <section><h4>{copy.why}</h4><p>{presented.whyItMatters}</p></section>
              <section><h4>{copy.action}</h4><p>{presented.suggestedAction}</p></section>
            </div> : null}

            {finding.repair && !finding.repair.available ? <p className="model-doctor-repair-note">{copy.ambiguousRepair}</p> : null}

            <footer className="model-doctor-finding__actions">
              {finding.canLocate ? <Button aria-label={`${copy.locate}: ${presented.title}`} size="touch" leadingIcon={<LocateFixed />} onClick={() => locate(finding)}>{copy.locate}</Button>
                : <span className="model-doctor-location-unavailable">{copy.unavailableLocation}</span>}
              {finding.suggestedTool ? <Button aria-label={`${copy.useTool}: ${presented.title}`} size="touch" variant="ghost" leadingIcon={<Wrench />} onClick={() => {
                setActiveTool(finding.suggestedTool!);
                onOpenChange(false);
              }}>{copy.useTool}</Button> : null}
              {finding.repair?.available ? <Button id={previewActionId} aria-label={`${copy.previewAction}: ${presented.title}`} size="touch" leadingIcon={<Wrench />} onClick={() => openRepairPreview(previewActionId)}>{copy.previewAction}</Button> : null}
              {finding.canAcknowledge ? <Button aria-label={`${isAcknowledged ? copy.unacknowledge : copy.acknowledge}: ${presented.title}`} size="touch" variant="ghost" onClick={() => toggleAcknowledged(finding.id)}>
                {isAcknowledged ? copy.unacknowledge : copy.acknowledge}
              </Button> : null}
            </footer>
            {isAcknowledged ? <span className="model-doctor-acknowledged"><CheckCircle2 size={15} aria-hidden="true" /> {copy.acknowledged}</span> : null}
          </article>;
        })}
      </div>
    </>}</>}
  </Drawer>;
};

export default ModelDoctor;
