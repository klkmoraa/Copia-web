/**
 * Buzón del archivo con el que el sistema operativo abrió la aplicación.
 *
 * `consumeLaunchQueue` tiene que llamarse **en el arranque**, antes de que React
 * monte nada: si la cola no se atiende pronto, el navegador puede darla por
 * desatendida. Pero quien sabe qué hacer con un expediente es la pantalla de
 * inicio, que aparece después. Este buzón resuelve ese desfase sin obligar a
 * `main.tsx` a conocer la ruta de importación.
 *
 * Es de un solo uso a propósito: un archivo de lanzamiento se abre una vez. Si
 * quedara guardado, volver a Inicio lo reabriría y el usuario perdería lo que
 * estuviera haciendo.
 */
import { consumeLaunchQueue, type LaunchedFile } from './fileSystem';

let pending: LaunchedFile | null = null;
const listeners = new Set<(launched: LaunchedFile) => void>();

/** Empieza a escuchar la cola del sistema operativo. Idempotente. */
let started = false;
export const startLaunchQueue = (): void => {
  if (started) return;
  started = true;
  consumeLaunchQueue((launched) => {
    if (listeners.size) {
      for (const listener of listeners) listener(launched);
      return;
    }
    pending = launched;
  });
};

/**
 * Reclama el archivo pendiente, si lo hay, y lo retira del buzón.
 *
 * Devuelve `null` cuando la aplicación se abrió normalmente, que es el caso
 * común y no es un error.
 */
export const claimLaunchedFile = (): LaunchedFile | null => {
  const claimed = pending;
  pending = null;
  return claimed;
};

/** Avisa de un lanzamiento que llegue **después** del arranque, con la aplicación ya abierta. */
export const onLaunchedFile = (listener: (launched: LaunchedFile) => void): (() => void) => {
  listeners.add(listener);
  const waiting = claimLaunchedFile();
  if (waiting) listener(waiting);
  return () => { listeners.delete(listener); };
};

/** Sólo para pruebas: devuelve el buzón a su estado inicial. */
export const resetLaunchQueueForTests = (): void => {
  pending = null;
  listeners.clear();
  started = false;
};
