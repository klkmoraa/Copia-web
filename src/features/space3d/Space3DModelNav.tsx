/**
 * Panel «Modelo / Vistas» de Space 3D.
 *
 * Navegación y resumen, no edición: elegir una fila decide qué tabla se ve en
 * el Inspector; elegir una vista mueve la cámara real, la misma que gobierna
 * el selector del lienzo, porque son el mismo estado. «Propiedades del
 * modelo» sólo despliega datos que el proyecto ya tiene — nada se inventa.
 */
import { ChevronRight } from 'lucide-react';
import type { Space3DViewPreset } from '../../space3d/view/cameraModel';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DEditorTarget } from './Space3DEntityEditor';

export type Space3DModelFocus = Space3DEditorTarget['kind'];

export interface Space3DModelCounts {
  readonly nodes: number;
  readonly members: number;
  readonly supports: number;
  readonly loads: number;
  readonly loadCases: number;
  readonly combinations: number;
}

export interface Space3DModelProperties {
  readonly id: string;
  readonly target: string;
  readonly dofTotal: number;
  readonly dofFree: number;
  readonly dofRestrained: number;
}

export interface Space3DModelNavProps {
  readonly t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  readonly counts: Space3DModelCounts;
  readonly focus: Space3DModelFocus;
  readonly onFocusChange: (focus: Space3DModelFocus) => void;
  readonly views: readonly Space3DViewPreset[];
  readonly viewLabels: Readonly<Record<Space3DViewPreset, string>>;
  readonly activeView: Space3DViewPreset;
  readonly onViewChange: (preset: Space3DViewPreset) => void;
  readonly properties: Space3DModelProperties;
  readonly propertiesOpen: boolean;
  readonly onToggleProperties: () => void;
}

const MODEL_ROWS: readonly { readonly focus: Space3DModelFocus; readonly key: TranslationKey; readonly countKey: keyof Space3DModelCounts }[] = [
  { focus: 'node', key: 'space3d.nodes', countKey: 'nodes' },
  { focus: 'member', key: 'space3d.members', countKey: 'members' },
  { focus: 'load', key: 'space3d.loads', countKey: 'loads' },
];

export const Space3DModelNav = ({
  t, counts, focus, onFocusChange, views, viewLabels, activeView, onViewChange,
  properties, propertiesOpen, onToggleProperties,
}: Space3DModelNavProps) => <div className="space3d-model-nav">
  <section aria-label={t('space3d.modelSection')}>
    <h2 className="space3d-model-nav-heading">{t('space3d.modelSection')}</h2>
    <ul className="space3d-model-nav-list">
      {MODEL_ROWS.map((row) => <li key={row.focus}>
        <button
          type="button"
          className="space3d-model-nav-row"
          aria-current={focus === row.focus}
          onClick={() => onFocusChange(row.focus)}
        >
          <span>{t(row.key)}</span>
          <span className="space3d-model-nav-count">{counts[row.countKey]}</span>
        </button>
      </li>)}
      <li className="space3d-model-nav-static">
        <span>{t('space3d.supports')}</span>
        <span className="space3d-model-nav-count">{counts.supports}</span>
      </li>
      <li className="space3d-model-nav-static">
        <span>{t('space3d.loadCasesCount')}</span>
        <span className="space3d-model-nav-count">{counts.loadCases}</span>
      </li>
      <li className="space3d-model-nav-static">
        <span>{t('space3d.combinationsCount')}</span>
        <span className="space3d-model-nav-count">{counts.combinations}</span>
      </li>
    </ul>
  </section>

  <section aria-label={t('space3d.viewsSection')}>
    <h2 className="space3d-model-nav-heading">{t('space3d.viewsSection')}</h2>
    <ul className="space3d-model-nav-list">
      {views.map((preset) => <li key={preset}>
        <button
          type="button"
          className="space3d-model-nav-row"
          aria-current={activeView === preset}
          onClick={() => onViewChange(preset)}
        >
          <span>{viewLabels[preset]}</span>
        </button>
      </li>)}
    </ul>
  </section>

  <section aria-label={t('space3d.modelInfoSection')}>
    <h2 className="space3d-model-nav-heading">{t('space3d.modelInfoSection')}</h2>
    <dl className="space3d-model-nav-info">
      <div><dt>{t('space3d.nodes')}</dt><dd>{counts.nodes}</dd></div>
      <div><dt>{t('space3d.members')}</dt><dd>{counts.members}</dd></div>
      <div><dt>{t('space3d.supports')}</dt><dd>{counts.supports}</dd></div>
      <div><dt>{t('space3d.loads')}</dt><dd>{counts.loads}</dd></div>
    </dl>
    <button
      type="button"
      className="space3d-model-nav-properties"
      aria-expanded={propertiesOpen}
      onClick={onToggleProperties}
    >
      <span>{t('space3d.modelProperties')}</span>
      <ChevronRight size={16} aria-hidden="true" className={propertiesOpen ? 'is-open' : undefined} />
    </button>
    {propertiesOpen ? <dl className="space3d-model-nav-info space3d-model-nav-properties-body">
      <div><dt>{t('space3d.modelIdLabel')}</dt><dd>{properties.id}</dd></div>
      <div><dt>{t('space3d.modelTargetLabel')}</dt><dd>{properties.target}</dd></div>
      <div><dt>{t('space3d.modelDofLabel')}</dt><dd>{properties.dofTotal}</dd></div>
      <div><dt>{t('space3d.freeDofCount')}</dt><dd>{properties.dofFree}</dd></div>
      <div><dt>{t('space3d.restrainedDofCount')}</dt><dd>{properties.dofRestrained}</dd></div>
    </dl> : null}
  </section>
</div>;
