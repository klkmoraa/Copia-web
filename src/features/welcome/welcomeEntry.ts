import { useEffect, useState } from 'react';
import type { ProjectRepository } from '../../storage/projectRepository';

/**
 * CRI-104 · ¿Quién está abriendo StructureCo?
 *
 * La decisión "quien regresa entra directo a la Mesa" se toma leyendo el
 * repositorio IndexedDB QUE YA EXISTE — `listProjects()` y `listRecoveries()`,
 * las dos lecturas que `ProjectHub` ya hace — y nada más. No se escribe una
 * preferencia nueva, no se toca `localStorage`, no se migra un solo registro:
 * si el usuario borra su biblioteca, vuelve a ser un usuario nuevo, que es
 * exactamente lo que debe pasar.
 *
 * El módulo del repositorio se carga con `import()` dinámico a propósito:
 * `WelcomeScreen` NO es `lazy` (vive en el chunk de entrada), y `ProjectHub`
 * ya arrastra `storage/projectRepository` en su propio chunk perezoso. Traerlo
 * aquí de forma estática lo subiría al arranque de todos los usuarios para
 * responder una pregunta que sólo importa después del primer pintado.
 */

export type WelcomeEntryStatus =
  /** Todavía no se sabe: la lectura del repositorio no ha terminado. */
  | 'unknown'
  /** Sin proyectos guardados. La bienvenida se muestra entera. */
  | 'new'
  /** Hay proyectos guardados de verdad. */
  | 'returning';

export interface WelcomeEntry {
  status: WelcomeEntryStatus;
  projects: number;
  recoveries: number;
}

const PENDING: WelcomeEntry = { status: 'unknown', projects: 0, recoveries: 0 };
const FRESH: WelcomeEntry = { status: 'new', projects: 0, recoveries: 0 };

/**
 * Lee el inventario real. Ante cualquier fallo —IndexedDB no disponible, una
 * base bloqueada, un registro corrupto— devuelve `new`: el coste de enseñar la
 * bienvenida a alguien que ya la conocía es una pantalla de más; el de saltarla
 * por un error de lectura sería esconderle su propia biblioteca.
 */
export const readWelcomeEntry = async (repository?: ProjectRepository): Promise<WelcomeEntry> => {
  try {
    const active = repository
      ?? (typeof indexedDB === 'undefined' ? null : (await import('../../storage/projectRepository')).getProjectRepository());
    if (!active) return FRESH;
    const [projects, recoveries] = await Promise.all([active.listProjects(), active.listRecoveries()]);
    return {
      status: projects.length > 0 ? 'returning' : 'new',
      projects: projects.length,
      recoveries: recoveries.length,
    };
  } catch {
    return FRESH;
  }
};

export const useWelcomeEntry = (repository?: ProjectRepository): WelcomeEntry => {
  const [entry, setEntry] = useState<WelcomeEntry>(PENDING);

  useEffect(() => {
    let alive = true;
    void readWelcomeEntry(repository).then((next) => { if (alive) setEntry(next); });
    return () => { alive = false; };
  }, [repository]);

  return entry;
};

/**
 * El salto directo a la Mesa.
 *
 * Dos condiciones, las dos observables y las dos derivadas del repositorio:
 *
 * 1. **Hay proyectos guardados.** Quien no tiene nada guardado no se salta la
 *    bienvenida: no tendría a dónde saltar.
 * 2. **No hay copias de recuperación pendientes.** `RecoveryRecord` es un
 *    mecanismo de seguridad de datos: si existe una copia recuperable, la
 *    bienvenida —donde vive la recuperación— tiene que verse. Saltársela
 *    dejaría el trabajo protegido fuera de la vista, que es justo el riesgo
 *    que el contrato de CRI-104 marca como inaceptable.
 */
export const shouldResumeDirectly = (entry: WelcomeEntry): boolean =>
  entry.status === 'returning' && entry.recoveries === 0;
