import { useMemo, useState } from 'react';
import { Download, LocateFixed, TriangleAlert } from 'lucide-react';
import { Button } from '../../design-system/components/controls';
import { useI18n } from '../../i18n/useI18n';
import { useProjectModel } from '../../store/ProjectModelContext';
import { useWorkspaceUI } from '../../store/WorkspaceUIContext';
import type { ProjectModel } from '../../types';
import { emitWorkspaceCommand } from '../workspace/workspaceCommands';
import {
  buildStructuralBom,
  downloadStructuralBomCsv,
  type BomIdentityFilter,
  type BomMemberType,
  type StructuralBom,
} from './structuralBom';
import './structuralBom.css';

export interface BomContentProps {
  download?: (project: ProjectModel, bom: StructuralBom) => void;
  /** Degrades to `peek` instead of closing — "Localizar" never closes the sheet. */
  onPeek?: () => void;
}

const displayNumber = (value: number | null, language: 'es' | 'en'): string => {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
    maximumSignificantDigits: 6,
  }).format(value);
};

/**
 * El BOM estructural, como cuerpo de la pestaña «BOM» de la superficie
 * «Datos».
 *
 * No monta su propio `Drawer`: el cromo —título, cerrar, `peek` y
 * restaurar— lo pone `DataSurface` una sola vez para las cuatro pestañas. Lo
 * único que sigue siendo suyo es `onPeek`, porque «Localizar» degrada la
 * superficie en vez de cerrarla, igual que en la Hoja de datos y el Model
 * Doctor.
 */
export const BomContent = ({ download = downloadStructuralBomCsv, onPeek }: BomContentProps) => {
  const { project } = useProjectModel();
  const { setSelection } = useWorkspaceUI();
  const { language, t } = useI18n();
  const [memberTypes, setMemberTypes] = useState<ReadonlySet<BomMemberType>>(() => new Set(['frame', 'truss']));
  const [identity, setIdentity] = useState<BomIdentityFilter>('all');
  const orderedMemberTypes = useMemo(
    () => (['frame', 'truss'] as const).filter((candidate) => memberTypes.has(candidate)),
    [memberTypes],
  );
  const bom = useMemo(() => buildStructuralBom(project, {
    memberTypes: orderedMemberTypes,
    identity,
  }), [identity, orderedMemberTypes, project]);

  const toggleMemberType = (memberType: BomMemberType) => {
    setMemberTypes((current) => {
      const next = new Set(current);
      if (next.has(memberType)) next.delete(memberType);
      else next.add(memberType);
      return next;
    });
  };

  const locateMember = (memberId: string) => {
    setSelection({ kind: 'member', id: memberId });
    onPeek?.();
    window.requestAnimationFrame(() => emitWorkspaceCommand('focus-object', { kind: 'member', id: memberId }));
  };

  return <div className="structural-bom" data-testid="structural-bom" data-row-count={bom.rows.length}>
    <header className="structural-bom__scope">
      <div>
        <span className="structural-bom__eyebrow">{t('bom.eyebrow')}</span>
        <h3>{t('bom.geometricTitle')}</h3>
        <p>{t('bom.basis')}</p>
      </div>
      <div className="structural-bom__scope-notes">
        <span>{t('bom.allowance')}</span>
        <span>{t('bom.purchaseBoundary')}</span>
      </div>
    </header>

    <div className="structural-bom__toolbar">
      <div className="structural-bom__family-filter" role="group" aria-label={t('bom.familyFilter')}>
        {(['frame', 'truss'] as const).map((memberType) => <button
          key={memberType}
          type="button"
          aria-pressed={memberTypes.has(memberType)}
          className={memberTypes.has(memberType) ? 'active' : ''}
          onClick={() => toggleMemberType(memberType)}
        >{t(memberType === 'frame' ? 'bom.family.frame' : 'bom.family.truss')}</button>)}
      </div>
      <label className="structural-bom__identity-filter">
        <span>{t('bom.identity')}</span>
        <select value={identity} onChange={(event) => setIdentity(event.target.value as BomIdentityFilter)}>
          <option value="all">{t('bom.identity.all')}</option>
          <option value="catalog">{t('bom.identity.catalog')}</option>
          <option value="unresolved">{t('bom.identity.unresolved')}</option>
        </select>
      </label>
      <Button
        size="touch"
        variant="secondary"
        disabled={!bom.rows.length}
        onClick={() => download(project, bom)}
      ><Download size={17} aria-hidden="true" />{t('bom.exportCsv')}</Button>
    </div>

    <div className="structural-bom__metrics" aria-label={t('bom.summary')}>
      <div><span>{t('bom.rows')}</span><strong>{bom.totals.rowCount}</strong></div>
      <div><span>{t('bom.members')}</span><strong>{bom.totals.memberCount}</strong></div>
      <div data-testid="bom-total-length"><span>{t('bom.totalLength')}</span><strong>{displayNumber(bom.totals.totalLengthM, language)} m</strong></div>
      <div><span>{t('bom.totalMass')}</span><strong>{displayNumber(bom.totals.totalMassKg, language)} kg</strong></div>
    </div>

    {bom.rows.length ? <div className="structural-bom__table-wrap">
      <table aria-label={t('bom.tableLabel')}>
        <thead><tr>
          <th scope="col">{t('bom.column.material')}</th>
          <th scope="col">{t('bom.column.section')}</th>
          <th scope="col">{t('bom.column.family')}</th>
          <th scope="col">{t('bom.column.pieces')}</th>
          <th scope="col">{t('bom.column.length')}</th>
          <th scope="col">{t('bom.column.mass')}</th>
          <th scope="col">{t('bom.column.provenance')}</th>
        </tr></thead>
        <tbody>{bom.rows.map((row) => <tr key={row.rowId} data-identity-status={row.identityStatus}>
          <td data-label={t('bom.column.material')}>
            <strong>{row.materialName || t('bom.unidentified')}</strong>
            <small>{row.materialId || row.materialOrigin}</small>
          </td>
          <td data-label={t('bom.column.section')}>
            <strong>{row.sectionName || t('bom.unidentified')}</strong>
            <small>{row.sectionId || row.sectionOrigin}</small>
          </td>
          <td data-label={t('bom.column.family')}>{t(row.memberType === 'frame' ? 'bom.family.frame' : 'bom.family.truss')}</td>
          <td data-label={t('bom.column.pieces')}>{row.memberCount}</td>
          <td data-label={t('bom.column.length')}>{displayNumber(row.totalLengthM, language)} m</td>
          <td data-label={t('bom.column.mass')}>{displayNumber(row.totalMassKg, language)} kg</td>
          <td data-label={t('bom.column.provenance')}>
            <div className="structural-bom__provenance">
              {row.provenance.map((source) => <button
                key={source.memberId}
                type="button"
                aria-label={t('bom.locateMember', { id: source.memberId })}
                title={`${source.nodeI}–${source.nodeJ} · ${displayNumber(source.lengthM, language)} m`}
                onClick={() => locateMember(source.memberId)}
              ><LocateFixed size={14} aria-hidden="true" />{source.memberId}</button>)}
            </div>
            {row.warnings.length ? <small className="structural-bom__warning"><TriangleAlert size={13} aria-hidden="true" />{t('bom.identityWarning')}</small> : null}
          </td>
        </tr>)}</tbody>
      </table>
    </div> : <p className="structural-bom__empty">{t('bom.empty')}</p>}

    {bom.excluded.length ? <p className="structural-bom__excluded">
      {t('bom.excluded', { count: bom.excluded.length })}: {bom.excluded.map((item) => item.memberId).join(' · ')}
    </p> : null}
  </div>;
};

export default BomContent;
