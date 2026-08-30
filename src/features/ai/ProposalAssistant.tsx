import { useState } from 'react';
import type { DiffChangeKind, DiffEntityKind } from '../../data/projectDiff';
import { standardMaterials } from '../../data/standardMaterials';
import { standardSections } from '../../data/standardSections';
import type { ProposalRequest } from '../../ai/commandProposal';
import { createLocalProposalProvider } from '../../ai/localProposalProvider';
import { validateCommandProposal } from '../../ai/proposalValidation';
import { confirmProposal, prepareProposal, type PreparedProposal } from '../../ai/proposalCompiler';
import { projectChecksum } from '../../storage/projectRepository';
import { useProjectModel } from '../../store/ProjectContext';
import { useI18n } from '../../i18n/useI18n';
import { usePhase2I18n } from '../../i18n/usePhase2I18n';
import type { Phase2TranslationKey } from '../../i18n/phase2Catalogs';
import { Dialog } from '../../design-system/components/overlays';
import { Button } from '../../design-system/components/controls';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import { diffCounts, formatDiffValue, groupChangesByKind, limitChanges } from '../project-hub/projectDiffSummary';
import '../project-hub/projectHub.css';
import './proposalAssistant.css';

/**
 * Entrada de UI para el contrato `CommandProposalV1` (`src/ai/**`).
 *
 * El paquete ya sabía compilar una propuesta sobre un clon, calcular su diff y
 * exigir una confirmación atada a la huella exacta que se revisó; lo único que
 * faltaba era quien lo llamara. Sigue sin haber proveedor de red ni IA: el
 * único proveedor es `createLocalProposalProvider`, determinista y sin
 * conexión — este diálogo es la puerta a esa mitad local, no una IA nueva.
 *
 * Reutiliza las claves `hub.diff*` de `projectDiffSummary`/`ProjectVersions`:
 * son vocabulario de un diff estructural, no texto propio de la biblioteca de
 * proyectos, y duplicarlas en español e inglés sólo por vivir en otra pantalla
 * no dejaría nada más claro.
 */

const ENTITY_LABEL_KEYS: Readonly<Record<DiffEntityKind, Phase2TranslationKey>> = {
  node: 'hub.diffKindNode',
  member: 'hub.diffKindMember',
  nodalLoad: 'hub.diffKindNodalLoad',
  memberLoad: 'hub.diffKindMemberLoad',
  prescribedDisplacement: 'hub.diffKindPrescribed',
  memberInitialEffect: 'hub.diffKindInitialEffect',
  loadCase: 'hub.diffKindLoadCase',
  combination: 'hub.diffKindCombination',
  settings: 'hub.diffKindSettings',
};

const CHANGE_COUNT_KEYS: Readonly<Record<DiffChangeKind, Phase2TranslationKey>> = {
  added: 'hub.diffAdded',
  modified: 'hub.diffModified',
  removed: 'hub.diffRemoved',
};

const CHANGE_BADGE_KEYS: Readonly<Record<DiffChangeKind, Phase2TranslationKey>> = {
  added: 'hub.diffBadgeAdded',
  modified: 'hub.diffBadgeModified',
  removed: 'hub.diffBadgeRemoved',
};

const MAX_SHOWN_CHANGES = 40;

export interface ProposalAssistantProps {
  open: boolean;
  onClose: () => void;
}

export const ProposalAssistant = ({ open, onClose }: ProposalAssistantProps) => {
  const { project, executeProjectCommand } = useProjectModel();
  const { language } = useI18n();
  const { t } = usePhase2I18n(language);
  const [intentText, setIntentText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; message: string } | null>(null);
  const [prepared, setPrepared] = useState<PreparedProposal | null>(null);

  const reset = () => {
    setIntentText('');
    setBusy(false);
    setNotice(null);
    setPrepared(null);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePropose = async () => {
    const intent = intentText.trim();
    if (!intent) return;
    setBusy(true);
    setNotice(null);
    try {
      const snapshotHash = await projectChecksum(project);
      const request: ProposalRequest = {
        intent,
        snapshotHash,
        memberIds: project.members.map((member) => member.id),
        sectionIds: standardSections.map((section) => section.id),
        materialIds: standardMaterials.map((material) => material.id),
      };
      const raw = await createLocalProposalProvider().propose(request);
      const validated = validateCommandProposal(raw);
      if (!validated.ok) { setNotice({ tone: 'error', message: t(validated.key, validated.params) }); return; }
      const proposal = validated.value;
      if (proposal.status === 'needs-clarification') { setNotice({ tone: 'info', message: proposal.question }); return; }
      if (proposal.status === 'rejected') { setNotice({ tone: 'error', message: proposal.reason }); return; }
      const outcome = prepareProposal(project, snapshotHash, proposal);
      if (!outcome.ok) { setNotice({ tone: 'error', message: t(outcome.key, outcome.params) }); return; }
      setPrepared(outcome.prepared);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!prepared) return;
    setBusy(true);
    try {
      const currentSnapshotHash = await projectChecksum(project);
      const outcome = confirmProposal(prepared, { proposalId: prepared.proposalId, snapshotHash: prepared.snapshotHash }, currentSnapshotHash);
      if (!outcome.ok) {
        setNotice({ tone: 'error', message: t(outcome.key, outcome.params) });
        setPrepared(null);
        return;
      }
      await executeProjectCommand(outcome.command);
      emitWorkspaceCommand('show-toast', { message: t('proposal.applied'), description: prepared.summary, tone: 'success' });
      handleClose();
    } finally {
      setBusy(false);
    }
  };

  const valueLabels = { absent: t('hub.diffAbsent'), yes: t('hub.yes'), no: t('hub.no') };

  return <Dialog
    open={open}
    onOpenChange={(next) => { if (!next) handleClose(); }}
    title={t('proposal.dialogTitle')}
    description={t('proposal.dialogDescription')}
    closeLabel={t('proposal.close')}
    footer={prepared ? <>
      <Button variant="secondary" onClick={() => { setPrepared(null); setNotice(null); }} disabled={busy}>{t('proposal.cancel')}</Button>
      <Button variant="primary" onClick={() => void handleConfirm()} loading={busy} loadingLabel={t('proposal.applying')}>{t('proposal.confirm')}</Button>
    </> : <Button
      variant="primary"
      onClick={() => void handlePropose()}
      disabled={!intentText.trim()}
      loading={busy}
      loadingLabel={t('proposal.proposing')}
    >{t('proposal.propose')}</Button>}
  >
    {prepared ? <div className="proposal-review">
      <p className="proposal-review__title">{t('proposal.reviewTitle')}</p>
      <p className="proposal-review__summary">{prepared.summary}</p>
      <p className="project-hub__diff-counts">
        {diffCounts(prepared.diff).map((entry) => t(CHANGE_COUNT_KEYS[entry.change], { count: entry.count })).join(' · ')}
      </p>
      <p className="project-hub__versions-note">{t('hub.diffBaseUnits')}</p>
      {groupChangesByKind(prepared.diff).map((group) => {
        const limited = limitChanges(group.changes, MAX_SHOWN_CHANGES);
        return <section key={group.kind} className="project-hub__diff-group">
          <h4>{t(ENTITY_LABEL_KEYS[group.kind])}</h4>
          <ul>
            {limited.shown.map((change) => <li key={`${change.kind}:${change.id}`} data-change={change.change}>
              <span className="project-hub__diff-badge">{t(CHANGE_BADGE_KEYS[change.change])}</span>
              <code>{change.id}</code>
              {change.fields.length ? <span className="project-hub__diff-fields">
                {change.fields.map((field) => `${field.field}: ${formatDiffValue(field.before, valueLabels)} → ${formatDiffValue(field.after, valueLabels)}`).join(' · ')}
              </span> : null}
            </li>)}
          </ul>
          {limited.hidden ? <p className="project-hub__diff-more">{t('hub.diffMore', { count: limited.hidden })}</p> : null}
        </section>;
      })}
    </div> : <div className="proposal-intent">
      {notice ? <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`proposal-notice proposal-notice--${notice.tone}`}>{notice.message}</p> : null}
      <label htmlFor="proposal-intent-input">{t('proposal.intentLabel')}</label>
      <textarea
        id="proposal-intent-input"
        rows={3}
        value={intentText}
        onChange={(event) => setIntentText(event.target.value)}
        placeholder={t('proposal.intentPlaceholder')}
        disabled={busy}
      />
    </div>}
  </Dialog>;
};
