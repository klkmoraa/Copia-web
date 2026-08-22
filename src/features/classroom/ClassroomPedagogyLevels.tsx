import { useMemo, useState } from 'react';
import { buildClassroomPedagogy, type ClassroomPedagogyLevelId, type ClassroomStructureKind } from '../../education/classroomPedagogy';
import { useI18n } from '../../i18n/useI18n';
import type { TranslationKey } from '../../i18n/catalogs';
import { useProject } from '../../store/ProjectContext';
import { resolveExplanationAnchor } from '../results/provenance';

const levelCopy: Record<ClassroomPedagogyLevelId, TranslationKey> = {
  fundamentals: 'classroom.levelFundamentals',
  procedure: 'classroom.levelProcedure',
  verification: 'classroom.levelVerification',
};

const kindCopy: Record<ClassroomStructureKind, TranslationKey> = {
  beam: 'classroom.kindBeam',
  truss: 'classroom.kindTruss',
  frame: 'classroom.kindFrame',
};

const bodyCopy: Record<ClassroomStructureKind, Record<ClassroomPedagogyLevelId, TranslationKey>> = {
  beam: { fundamentals: 'classroom.beamFundamentals', procedure: 'classroom.beamProcedure', verification: 'classroom.beamVerification' },
  truss: { fundamentals: 'classroom.trussFundamentals', procedure: 'classroom.trussProcedure', verification: 'classroom.trussVerification' },
  frame: { fundamentals: 'classroom.frameFundamentals', procedure: 'classroom.frameProcedure', verification: 'classroom.frameVerification' },
};

export const ClassroomPedagogyLevels = () => {
  const { analysis, project, selectedCombinationId } = useProject();
  const { t } = useI18n();
  const [level, setLevel] = useState<ClassroomPedagogyLevelId>('procedure');
  const pedagogy = useMemo(() => buildClassroomPedagogy(project), [project]);
  const anchor = useMemo(() => {
    if (!analysis) return null;
    const member = analysis.memberResults[0];
    const point = member?.diagram[0];
    if (member && point) return resolveExplanationAnchor(analysis, {
      quantity: pedagogy.kind === 'truss' ? 'N' : 'M',
      entity: { kind: 'member', id: member.memberId },
      caseOrCombinationId: selectedCombinationId || project.loadCases[0]?.id || '—',
      signConvention: pedagogy.kind === 'truss' ? t('results.signAxial') : t('results.signMoment'),
      position: { x: point.x, side: point.side },
    });
    const node = analysis.nodeResults[0];
    return node ? resolveExplanationAnchor(analysis, {
      quantity: 'R',
      entity: { kind: 'node', id: node.nodeId },
      component: 'y',
      caseOrCombinationId: selectedCombinationId || project.loadCases[0]?.id || '—',
      signConvention: t('results.signGlobalY'),
    }) : null;
  }, [analysis, pedagogy.kind, project.loadCases, selectedCombinationId, t]);

  return <section className="classroom-pedagogy" aria-label={t('classroom.pedagogyLevels')}>
    <div className="classroom-pedagogy-levels" role="group" aria-label={t('classroom.pedagogyLevels')}>
      {pedagogy.levels.map((item) => <button key={item.id} type="button" aria-pressed={level === item.id} onClick={() => setLevel(item.id)}>{t(levelCopy[item.id])}</button>)}
    </div>
    <div className="classroom-pedagogy-card" aria-live="polite">
      <strong>{t(kindCopy[pedagogy.kind])} · {t(levelCopy[level])}</strong>
      <p>{t(bodyCopy[pedagogy.kind][level])}</p>
      {level === 'verification' ? <small>{anchor?.status === 'resolved' ? t('classroom.anchorEvidence', { source: anchor.source ?? '—' }) : t('classroom.anchorLimitation')}</small> : null}
    </div>
  </section>;
};
