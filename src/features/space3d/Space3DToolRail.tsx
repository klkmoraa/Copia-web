/**
 * Carril vertical de herramientas de Space 3D.
 *
 * Traduce el carril de mesa del brandbook a las acciones reales de la
 * superficie: no hay «Medir» porque el dominio espacial no tiene medición
 * todavía, y «Apoyo» edita las restricciones de un nudo existente en vez de
 * crear una entidad nueva, porque en S3D-1 el apoyo es un atributo del nudo.
 */
import {
  Box, CircleDot, MousePointer2, Redo2, Spline, Trash2, Triangle, Undo2, Weight,
} from 'lucide-react';
import type { TranslationKey } from '../../i18n/catalogs';

export type Space3DActiveTool = 'select' | 'node' | 'member' | 'load';

export interface Space3DToolRailProps {
  readonly t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  readonly activeTool: Space3DActiveTool;
  readonly onSelectTool: () => void;
  readonly onNewNode: () => void;
  readonly onNewMember: () => void;
  readonly onNewLoad: () => void;
  readonly onEditSupport: () => void;
  readonly canNewMember: boolean;
  readonly canNewLoad: boolean;
  readonly canEditSupport: boolean;
  /** «Vista»: avanza al siguiente preset de cámara (mismo estado que el selector del lienzo y la lista Vistas). */
  readonly onCycleView: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly canDelete: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDelete: () => void;
}

export const Space3DToolRail = ({
  t, activeTool, onSelectTool, onNewNode, onNewMember, onNewLoad, onEditSupport,
  canNewMember, canNewLoad, canEditSupport, onCycleView,
  canUndo, canRedo, canDelete, onUndo, onRedo, onDelete,
}: Space3DToolRailProps) => <nav className="space3d-rail-vertical" aria-label={t('space3d.toolRailLabel')}>
  <div className="space3d-rail-vertical-group" role="group" aria-label={t('space3d.toolRailLabel')}>
    <button
      type="button"
      className="space3d-rail-button"
      aria-pressed={activeTool === 'select'}
      onClick={onSelectTool}
      title={t('space3d.toolSelect')}
    >
      <MousePointer2 size={19} aria-hidden="true" />
      <span>{t('space3d.toolSelect')}</span>
    </button>
    <button
      type="button"
      className="space3d-rail-button"
      aria-pressed={activeTool === 'node'}
      onClick={onNewNode}
      aria-label={t('space3d.newNode')}
      title={t('space3d.newNode')}
    >
      <CircleDot size={19} aria-hidden="true" />
      <span aria-hidden="true">{t('space3d.node')}</span>
    </button>
    <button
      type="button"
      className="space3d-rail-button"
      aria-pressed={activeTool === 'member'}
      onClick={onNewMember}
      disabled={!canNewMember}
      aria-label={t('space3d.newMember')}
      title={t('space3d.newMember')}
    >
      <Spline size={19} aria-hidden="true" />
      <span aria-hidden="true">{t('space3d.member')}</span>
    </button>
    <button
      type="button"
      className="space3d-rail-button"
      aria-pressed={activeTool === 'load'}
      onClick={onNewLoad}
      disabled={!canNewLoad}
      aria-label={t('space3d.newLoad')}
      title={t('space3d.newLoad')}
    >
      <Weight size={19} aria-hidden="true" />
      <span aria-hidden="true">{t('space3d.load')}</span>
    </button>
    <button
      type="button"
      className="space3d-rail-button"
      onClick={onEditSupport}
      disabled={!canEditSupport}
      aria-label={t('space3d.newSupport')}
      title={canEditSupport ? t('space3d.newSupport') : t('space3d.newSupportHint')}
    >
      <Triangle size={19} aria-hidden="true" />
      <span aria-hidden="true">{t('space3d.supports')}</span>
    </button>
    <button
      type="button"
      className="space3d-rail-button"
      onClick={onCycleView}
      title={t('space3d.toolbarView')}
    >
      <Box size={19} aria-hidden="true" />
      <span>{t('space3d.toolbarView')}</span>
    </button>
  </div>

  <div className="space3d-rail-vertical-group space3d-rail-vertical-group--history" role="group" aria-label={t('space3d.toolbarProject')}>
    <button type="button" className="space3d-rail-button" onClick={onUndo} disabled={!canUndo} title={t('space3d.undo')}>
      <Undo2 size={18} aria-hidden="true" />
      <span className="space3d-visually-hidden">{t('space3d.undo')}</span>
    </button>
    <button type="button" className="space3d-rail-button" onClick={onRedo} disabled={!canRedo} title={t('space3d.redo')}>
      <Redo2 size={18} aria-hidden="true" />
      <span className="space3d-visually-hidden">{t('space3d.redo')}</span>
    </button>
    <button type="button" className="space3d-rail-button space3d-rail-button--danger" onClick={onDelete} disabled={!canDelete} title={t('space3d.deleteSelected')}>
      <Trash2 size={18} aria-hidden="true" />
      <span className="space3d-visually-hidden">{t('space3d.deleteSelected')}</span>
    </button>
  </div>
</nav>;
