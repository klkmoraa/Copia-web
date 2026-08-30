import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ErrorBoundary } from '../../design-system/components/errorBoundary';
import { useI18n } from '../../i18n/useI18n';

/**
 * Una frontera diferida que falla donde está, no en toda la aplicación.
 *
 * Hasta aquí el único `ErrorBoundary` del producto estaba en la raíz
 * (`main.tsx`), con quince superficies diferidas colgando de él y ni un
 * `.catch()` en sus `import()`. Si un chunk no llegaba —un corte de red, o el
 * service worker sirviendo un `index.html` cacheado que apunta a hashes que ya
 * no existen tras un despliegue— la promesa de `lazy()` se rechazaba, subía
 * hasta la raíz, y la aplicación entera se sustituía por la pantalla de error.
 * El usuario perdía de vista su modelo porque no cargó un panel lateral.
 *
 * Eso importa más en un producto local-first: lo que hay en pantalla puede ser
 * trabajo que todavía no se ha guardado en ningún sitio.
 *
 * Aquí el fallo se queda en su hueco y el resto de la Mesa sigue en pie, con el
 * modelo a la vista y exportable. Recargar sigue estando —es la única salida
 * real cuando el módulo no está— pero pasa a ser decisión del usuario y no algo
 * que ocurra encima de su trabajo.
 */
export const LazySurface = ({ pending = null, children }: {
  /** Qué se pinta mientras el chunk viaja. */
  pending?: ReactNode;
  children: ReactNode;
}) => {
  const { t } = useI18n();
  return (
    <ErrorBoundary
      fallback={
        <div className="sc-surface-error" role="alert">
          <span className="sc-surface-error__icon" aria-hidden="true"><TriangleAlert size={16} /></span>
          <span>{t('surface.loadFailed')}</span>
          <button type="button" onClick={() => window.location.reload()}>{t('surface.reload')}</button>
        </div>
      }
    >
      <Suspense fallback={pending}>{children}</Suspense>
    </ErrorBoundary>
  );
};
