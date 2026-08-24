import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion } from 'motion/react';
import App from './App';
import { ErrorBoundary } from './design-system/components/errorBoundary';
import { preloadPreferredCatalog } from './i18n/languagePreference';
import { startLaunchQueue } from './platform/launchedFile';

/* Antes de pintar: el catálogo del idioma probable se pide ya, en paralelo con
   la hidratación del proyecto. Ver `languagePreference.ts` — sin esto, un
   usuario en inglés vería un parpadeo de español en cada recarga. */
preloadPreferredCatalog();

/* La cola de lanzamiento se atiende antes de montar React: si no se consume
   pronto, el navegador puede darla por desatendida y un doble clic sobre un
   `.structureco` abriría un modelo vacío. El archivo queda en el buzón hasta que
   la pantalla que sabe importarlo lo reclame. */
startLaunchQueue();

const root = createRoot(document.getElementById('root')!);
const loadMotionFeatures = () => import('./design-system/motionFeatures').then((module) => module.default);

/**
 * `strict` makes a stray `motion.*` component throw instead of silently pulling the full
 * feature bundle back into the entry chunk — the regression this setup exists to prevent.
 */
const render = (content: ReactNode) => root.render(
  <ErrorBoundary>
    <StrictMode>
      <LazyMotion features={loadMotionFeatures} strict>{content}</LazyMotion>
    </StrictMode>
  </ErrorBoundary>,
);

if (import.meta.env.DEV && window.location.pathname === '/__components') {
  void import('./design-system/lab/ComponentLab').then(({ ComponentLab }) => render(<ComponentLab />));
} else {
  render(<App />);
}
