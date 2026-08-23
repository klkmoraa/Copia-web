import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion } from 'motion/react';
import App from './App';
import { preloadPreferredCatalog } from './i18n/languagePreference';

/* Antes de pintar: el catálogo del idioma probable se pide ya, en paralelo con
   la hidratación del proyecto. Ver `languagePreference.ts` — sin esto, un
   usuario en inglés vería un parpadeo de español en cada recarga. */
preloadPreferredCatalog();

const root = createRoot(document.getElementById('root')!);
const loadMotionFeatures = () => import('./design-system/motionFeatures').then((module) => module.default);

/**
 * `strict` makes a stray `motion.*` component throw instead of silently pulling the full
 * feature bundle back into the entry chunk — the regression this setup exists to prevent.
 */
const render = (content: ReactNode) => root.render(
  <StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>{content}</LazyMotion>
  </StrictMode>,
);

if (import.meta.env.DEV && window.location.pathname === '/__components') {
  void import('./design-system/lab/ComponentLab').then(({ ComponentLab }) => render(<ComponentLab />));
} else {
  render(<App />);
}
