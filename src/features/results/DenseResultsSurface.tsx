import { lazy, Suspense, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Drawer } from '../../design-system/components/overlays';
import { useI18n } from '../../i18n/useI18n';
import { useProject } from '../../store/ProjectContext';
import type { SurfacePresentation } from '../workspace/surfacePresentation';
import { DENSE_RESULT_VIEWS, preloadInfluenceLineView, type DenseResultView } from './denseResults';
import { LearnView } from './LearnView';
import { ReactionsView } from './ReactionsView';

const LazyInfluenceLineView = lazy(() => preloadInfluenceLineView());

/**
 * La superficie `dense` de Results (CRI-101).
 *
 * **Invocada, nunca residente**: no existe en el árbol hasta que alguien la
 * pide, y al cerrarse desaparece devolviendo el foco a quien la abrió —de eso
 * se encarga el broker, por eso `restoreFocus` queda desactivado cuando hay
 * `onSurfaceReady`. El broker también elige cómo se presenta: `drawer` en
 * X2/M1, `fullscreen` en K0, y admite `peek` por ser modal en las tres.
 *
 * Aquí viven las tres vistas densas —reacciones, influencia y «Entender»—.
 * Ninguna recalcula nada: `dense` es proyección del mismo análisis, igual que
 * el panel del que salieron.
 */
export interface DenseResultsSurfaceProps {
  open: boolean;
  view: DenseResultView;
  onViewChange: (view: DenseResultView) => void;
  onOpenChange: (open: boolean) => void;
  presentation?: Extract<SurfacePresentation, 'drawer' | 'fullscreen'>;
  onSurfaceReady?: (ready: boolean) => void;
}

export const DenseResultsSurface = ({
  open,
  view,
  onViewChange,
  onOpenChange,
  presentation = 'drawer',
  onSurfaceReady,
}: DenseResultsSurfaceProps) => {
  const { t } = useI18n();
  const { project, selection, setInfluenceCanvasState } = useProject();
  const tabsRef = useRef<HTMLDivElement>(null);

  const viewLabel: Record<DenseResultView, string> = {
    reactions: t('results.reactions'),
    influence: t('results.influence'),
    learn: t('results.learn'),
  };

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowLeft') next = (index - 1 + DENSE_RESULT_VIEWS.length) % DENSE_RESULT_VIEWS.length;
    else if (event.key === 'ArrowRight') next = (index + 1) % DENSE_RESULT_VIEWS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = DENSE_RESULT_VIEWS.length - 1;
    else return;
    event.preventDefault();
    const target = DENSE_RESULT_VIEWS[next];
    if (target === 'influence') void preloadInfluenceLineView();
    onViewChange(target);
    window.requestAnimationFrame(() => {
      tabsRef.current?.querySelector<HTMLButtonElement>(`[data-dense-view="${target}"]`)?.focus();
    });
  };

  return <Drawer
    open={open}
    onOpenChange={onOpenChange}
    title={t('results.denseTitle')}
    description={t('results.denseSubtitle')}
    closeLabel={t('results.denseClose')}
    presentation={presentation}
    side="right"
    className="dense-results-surface"
    surfaceId="dense"
    restoreFocus={!onSurfaceReady}
    onSurfaceReady={onSurfaceReady}
  >
    <div className="dense-results-tabs" role="tablist" aria-label={t('results.denseViews')} ref={tabsRef}>
      {DENSE_RESULT_VIEWS.map((candidate, index) => <button
        key={candidate}
        type="button"
        role="tab"
        data-dense-view={candidate}
        id={`dense-view-tab-${candidate}`}
        aria-selected={view === candidate}
        aria-controls="dense-view-panel"
        tabIndex={view === candidate ? 0 : -1}
        className={view === candidate ? 'active' : ''}
        onFocus={() => { if (candidate === 'influence') void preloadInfluenceLineView(); }}
        onPointerEnter={() => { if (candidate === 'influence') void preloadInfluenceLineView(); }}
        onClick={() => onViewChange(candidate)}
        onKeyDown={(event) => onTabKeyDown(event, index)}
      >{viewLabel[candidate]}</button>)}
    </div>
    <div
      id="dense-view-panel"
      className="dense-results-panel"
      role="tabpanel"
      aria-labelledby={`dense-view-tab-${view}`}
    >
      {view === 'reactions' ? <ReactionsView /> : null}
      {view === 'influence' ? <Suspense fallback={<div className="results-view-loading" role="status" aria-label={t('results.loadingInfluence')}><LoaderCircle className="spin" size={20} aria-hidden="true" /><span>{t('results.loadingInfluence')}</span></div>}>
        <LazyInfluenceLineView project={project} selection={selection ?? undefined} onCanvasStateChange={setInfluenceCanvasState} />
      </Suspense> : null}
      {view === 'learn' ? <LearnView /> : null}
    </div>
  </Drawer>;
};
