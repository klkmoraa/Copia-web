import { useEffect, useRef, useState, type ReactNode } from 'react';
import { commitShellComposition, resolveShellComposition, type ShellViewport } from './shellComposition';
import { ShellCompositionContext, readShellViewport } from './useShellComposition';

/**
 * Ventana de quietud antes de commitear un tamaño nuevo (T-INV-5: el resolutor
 * «sólo commitea sobre tamaño estable»). Un arrastre continuo de split-screen
 * genera decenas de `resize` por segundo y ninguno commitea hasta que el tamaño
 * se queda quieto.
 */
export const SHELL_STABLE_COMMIT_MS = 120;

/**
 * La máquina de estados que publica la clase de composición, una sola vez para
 * toda la mesa. Sólo emite cuando la composición CAMBIA —no en cada `resize`—,
 * porque el commit devuelve la misma identidad cuando nada cambió y React corta
 * el re-render ahí.
 *
 * No escucha `visualViewport`: el teclado virtual ajusta, nunca recompone.
 */
export const ShellCompositionProvider = ({ children }: { children: ReactNode }) => {
  const [composition, setComposition] = useState(() => resolveShellComposition(readShellViewport()));
  const pendingRef = useRef<ShellViewport>({ width: 0, height: 0 });

  useEffect(() => {
    let timer = 0;
    const commit = () => setComposition((previous) => commitShellComposition(previous, pendingRef.current));
    const schedule = () => {
      const viewport = readShellViewport();
      // Un `resize` que no cambia el tamaño no reinicia la ventana de quietud:
      // si ya había un commit programado, el tamaño lleva quieto todo ese rato.
      if (viewport.width === pendingRef.current.width && viewport.height === pendingRef.current.height) return;
      pendingRef.current = viewport;
      window.clearTimeout(timer);
      timer = window.setTimeout(commit, SHELL_STABLE_COMMIT_MS);
    };
    // El shell puede montarse después de un redimensionado que nadie escuchó.
    pendingRef.current = readShellViewport();
    commit();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, []);

  return <ShellCompositionContext.Provider value={composition}>{children}</ShellCompositionContext.Provider>;
};
