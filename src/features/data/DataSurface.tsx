import { lazy, Suspense, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Drawer } from '../../design-system/components/overlays';
import { useI18n } from '../../i18n/useI18n';
import type { SurfaceExtent, SurfacePresentation } from '../workspace/surfacePresentation';
import { DATA_SURFACE_TABS, DATA_SURFACE_TAB_LABEL_KEY, type DataSurfaceTab } from './dataSurface';
import { RetainedStateProvider } from './retainedState';

/**
 * Las cuatro pestañas viajan en su propio chunk. Fundir el cromo no puede
 * costar el troceado: abrir «Datos» en Resultados no debe descargar la Hoja de
 * datos, el Doctor ni el BOM.
 */
const LazyResultsContent = lazy(() => import('../results/ResultsContent').then((module) => ({ default: module.ResultsContent })));
const LazyDatasheetContent = lazy(() => import('../datasheet/DatasheetContent').then((module) => ({ default: module.DatasheetContent })));
const LazyModelDoctorContent = lazy(() => import('../model-doctor/ModelDoctorContent').then((module) => ({ default: module.ModelDoctorContent })));
const LazyBomContent = lazy(() => import('../bom/BomContent').then((module) => ({ default: module.BomContent })));

export interface DataSurfaceProps {
  open: boolean;
  tab: DataSurfaceTab;
  onTabChange: (tab: DataSurfaceTab) => void;
  onOpenChange: (open: boolean) => void;
  presentation?: Extract<SurfacePresentation, 'drawer' | 'fullscreen'>;
  onSurfaceReady?: (ready: boolean) => void;
  extent?: SurfaceExtent;
  /** Degrada a `peek` en vez de cerrar: «Localizar» nunca cierra la superficie. */
  onPeek?: () => void;
  onRestore?: () => void;
  acknowledgedIds?: ReadonlySet<string>;
  onAcknowledgedIdsChange?: (ids: Set<string>) => void;
}

/**
 * La superficie «Datos»: un cromo, cuatro pestañas.
 *
 * QUE SUSTITUYE. Cuatro superficies densas con cuatro cromos y cuatro
 * lanzadores: el dock inferior de Resultados, la superficie invocada `dense`,
 * la Hoja de datos y el Model Doctor. El broker ya las obligaba a ser
 * mutuamente excluyentes —«drawer y fullscreen son mutuamente exclusivos», en
 * `validateSurfaceCombination`—, así que en pantalla nunca hubo más de una a la
 * vez. Esto no cambia lo que se puede tener abierto: le da a esa restricción
 * una sola superficie, un solo título, un solo botón de cerrar y un solo
 * `peek`. El BOM estructural se sumó después como cuarta pestaña en vez de
 * como una quinta superficie invocada con su propio cromo.
 *
 * LO QUE MUERE CON EL DOCK. Resultados era un dock inferior redimensionable
 * con tres modos, tirador de arrastre, altura persistida y su propia trampa de
 * `Escape`. Todo eso existía para negociar alto con el lienzo. Aquí no hay nada
 * que negociar, y el lienzo recupera ese alto entero en X2/M1.
 */
export const DataSurface = ({
  open,
  tab,
  onTabChange,
  onOpenChange,
  presentation = 'drawer',
  onSurfaceReady,
  extent = 'default',
  onPeek,
  onRestore,
  acknowledgedIds,
  onAcknowledgedIdsChange,
}: DataSurfaceProps) => {
  const { t } = useI18n();
  const tabsRef = useRef<HTMLDivElement>(null);

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowLeft') next = (index - 1 + DATA_SURFACE_TABS.length) % DATA_SURFACE_TABS.length;
    else if (event.key === 'ArrowRight') next = (index + 1) % DATA_SURFACE_TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = DATA_SURFACE_TABS.length - 1;
    else return;
    event.preventDefault();
    const target = DATA_SURFACE_TABS[next];
    onTabChange(target);
    window.requestAnimationFrame(() => {
      tabsRef.current?.querySelector<HTMLButtonElement>(`[data-data-tab="${target}"]`)?.focus();
    });
  };

  return <RetainedStateProvider><Drawer
    open={open}
    onOpenChange={onOpenChange}
    title={t('data.title')}
    description={t('data.description')}
    closeLabel={t('data.close')}
    presentation={presentation}
    side="right"
    className="data-surface"
    surfaceId="data"
    restoreFocus={!onSurfaceReady}
    onSurfaceReady={onSurfaceReady}
    extent={extent}
    onRestore={onRestore}
    restoreLabel={t('data.restore')}
  >
    <div className="data-surface-tabs" role="tablist" aria-label={t('data.tabs')} ref={tabsRef}>
      {DATA_SURFACE_TABS.map((candidate, index) => <button
        key={candidate}
        type="button"
        role="tab"
        data-data-tab={candidate}
        id={`data-tab-${candidate}`}
        aria-selected={tab === candidate}
        aria-controls="data-surface-panel"
        tabIndex={tab === candidate ? 0 : -1}
        className={tab === candidate ? 'active' : ''}
        onClick={() => onTabChange(candidate)}
        onKeyDown={(event) => onTabKeyDown(event, index)}
      >{t(DATA_SURFACE_TAB_LABEL_KEY[candidate])}</button>)}
    </div>
    <div
      id="data-surface-panel"
      className="data-surface-panel"
      role="tabpanel"
      aria-labelledby={`data-tab-${tab}`}
      data-data-tab={tab}
    >
      <Suspense fallback={<span className="sr-only" role="status">{t('results.denseLoading')}</span>}>
        {tab === 'results' ? <LazyResultsContent /> : null}
        {tab === 'table' ? <LazyDatasheetContent onPeek={onPeek} /> : null}
        {tab === 'review' ? <LazyModelDoctorContent
          acknowledgedIds={acknowledgedIds}
          onAcknowledgedIdsChange={onAcknowledgedIdsChange}
          onPeek={onPeek}
          onClose={() => onOpenChange(false)}
        /> : null}
        {tab === 'bom' ? <LazyBomContent onPeek={onPeek} /> : null}
      </Suspense>
    </div>
  </Drawer></RetainedStateProvider>;
};

export default DataSurface;
