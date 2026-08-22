import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { useI18n } from '../../i18n/useI18n';
import { onWorkspaceCommand } from './workspaceCommands';

export interface ToastItem {
  id: string;
  message: string;
  description?: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  durationMs: number;
}

/** Non-intrusive confirmation for fire-and-forget actions (export, copy). Max 4 concurrent. */
export const ToastNotification = () => {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const reducedMotion = useReducedMotion();
  /* Los temporizadores de retirada se guardaban en ningún sitio, así que
     desmontar la mesa dejaba hasta cuatro `setTimeout` vivos apuntando a un
     `setState` de un componente que ya no existe. */
  const timersRef = useRef(new Set<number>());
  useEffect(() => () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  useEffect(() => onWorkspaceCommand('show-toast', (payload) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: ToastItem = {
      id,
      message: payload.message,
      description: payload.description,
      tone: payload.tone ?? 'success',
      durationMs: payload.durationMs ?? 3200,
    };

    setToasts((previous) => [...previous.slice(-3), toast]);

    if (toast.durationMs > 0) {
      const timer = window.setTimeout(() => {
        timersRef.current.delete(timer);
        setToasts((current) => current.filter((item) => item.id !== id));
      }, toast.durationMs);
      timersRef.current.add(timer);
    }
  }), []);

  return (
    <div className="sc-toast-container" role="region" aria-label={t('toast.regionLabel')} aria-live="polite" aria-atomic="false">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2
            : toast.tone === 'warning' ? TriangleAlert
              : toast.tone === 'error' ? CircleAlert
                : Info;
          return (
            <m.div
              key={toast.id}
              layout
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.94 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -10 }}
              transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 420, damping: 28 }}
              className={`sc-toast-card sc-toast-card--${toast.tone}`}
              /* Sin `role="status"` propio: la región viva es el contenedor
                 estable de arriba, que ya está en el documento cuando la
                 tarjeta entra. Una región creada en el mismo momento que su
                 contenido no se anuncia. */
              aria-atomic="true"
            >
              <span className="sc-toast-card__icon" aria-hidden="true"><Icon size={18} /></span>
              <div className="sc-toast-card__content">
                <strong className="sc-toast-card__title">{toast.message}</strong>
                {toast.description ? <p className="sc-toast-card__desc">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                className="sc-toast-card__close"
                aria-label={t('toast.dismiss')}
                onClick={() => setToasts((previous) => previous.filter((item) => item.id !== toast.id))}
              >
                <X size={14} />
              </button>
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
