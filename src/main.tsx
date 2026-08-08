import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion } from 'motion/react';
import App from './App';

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
