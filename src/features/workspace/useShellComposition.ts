import { createContext, useContext } from 'react';
import { resolveShellComposition, type ShellComposition, type ShellViewport } from './shellComposition';

/**
 * CRI-89 · Lectura de la clase de composición.
 *
 * Contexto PROPIO y ESTRECHO, deliberadamente separado de `WorkspaceUIContext`:
 * la clase es estado de altísima frecuencia potencial y no puede compartir
 * proveedor con la selección o el tema, o cada resize arrastraría a las dos.
 * Quien lo alimenta es `ShellCompositionProvider`.
 */

/**
 * El viewport de LAYOUT, nunca `visualViewport` (T-INV-4). El teclado virtual
 * encoge el viewport visual y no debe recomponer: leyendo `innerWidth`/
 * `innerHeight` no puede hacerlo. En Compact, además, la clase se decide por
 * ancho, así que ni siquiera un navegador que encoja la altura de layout al
 * abrir el teclado puede cambiarla.
 */
export const readShellViewport = (): ShellViewport => (typeof window === 'undefined'
  ? { width: 0, height: 0 }
  : { width: window.innerWidth, height: window.innerHeight });

export const ShellCompositionContext = createContext<ShellComposition | null>(null);

/**
 * Lee la composición vigente. Ninguna superficie guarda la clase en estado
 * local: duplicarla es el antipatrón que este slice viene a eliminar.
 *
 * Sin proveedor —sólo ocurre al montar una superficie aislada en una prueba— la
 * clase se resuelve del viewport actual con la misma función pura. Sigue
 * habiendo una única fuente; lo que falta entonces es el seguimiento del
 * `resize`, que en producción siempre lo aporta el shell.
 */
export const useShellComposition = (): ShellComposition => useContext(ShellCompositionContext)
  ?? resolveShellComposition(readShellViewport());
